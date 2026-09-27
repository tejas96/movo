"""Brochure raster plan -> colour regions -> polygons in BLCS (mm).
Fit: lift shaft inner box measured in pixels; origin = outer SW corner of lift shaft; scale px/m."""
import sys, json, math
import numpy as np
from PIL import Image, ImageDraw
from collections import deque, Counter
S="/private/tmp/claude-501/-Volumes-works-space-movo/7376b897-dd79-4404-9121-d7b8a17d4b18/scratchpad"
PAL={ 'purple':(208,192,240),'purple2':(192,176,240),'orange':(240,224,176),'pink':(240,176,192),'green':(208,240,192),
      'blue':(192,224,240),'grey':(208,208,208),'lgrey':(224,224,224),'white':(240,240,240),'road':(192,192,192),'black':(0,0,0)}
CLASS_OF={'purple':'purple','purple2':'purple','orange':'orange','pink':'pink','green':'green','blue':'blue','grey':'grey','lgrey':'lgrey','white':'white','road':'road','black':'black'}
def classify(img):
    a=img.astype(int); names=list(PAL.keys()); cols=np.array([PAL[n] for n in names])
    d=((a[:,:,None,:]-cols[None,None,:,:])**2).sum(-1)   # H,W,K
    k=d.argmin(-1); dm=d.min(-1)
    out=np.array([CLASS_OF[n] for n in names])[k]
    out[dm>3*22**2]='other'
    return out
def components(mask,minpx):
    H,W=mask.shape; lab=np.zeros((H,W),dtype=np.int32); cur=0; regs=[]
    for y in range(H):
        row=mask[y]
        for x in np.nonzero(row)[0]:
            if lab[y,x]: continue
            cur+=1; q=deque([(y,x)]); lab[y,x]=cur; n=0; sx=sy=0; minx=maxx=x; miny=maxy=y
            while q:
                cy,cx=q.popleft(); n+=1; sx+=cx; sy+=cy
                minx=min(minx,cx); maxx=max(maxx,cx); miny=min(miny,cy); maxy=max(maxy,cy)
                for ny,nx in ((cy-1,cx),(cy+1,cx),(cy,cx-1),(cy,cx+1)):
                    if 0<=ny<H and 0<=nx<W and mask[ny,nx] and lab[ny,nx]==0: lab[ny,nx]=cur; q.append((ny,nx))
            if n>=minpx: regs.append(dict(id=cur,n=n,cx=sx/n,cy=sy/n,bbox=(minx,miny,maxx+1,maxy+1)))
            else: lab[lab==cur]=0
    return lab,regs
def outline_px(m):
    """closed rectilinear polygon (pixel corners) around the largest blob of m."""
    ys,xs=np.nonzero(m)
    if len(ys)==0: return None
    H,W=m.shape; pad=np.zeros((H+2,W+2),dtype=bool); pad[1:-1,1:-1]=m
    nxt={}
    for y,x in zip(ys,xs):
        Y,X=y+1,x+1
        if not pad[Y-1,X]: nxt.setdefault((x,y),[]).append((x+1,y))
        if not pad[Y,X+1]: nxt.setdefault((x+1,y),[]).append((x+1,y+1))
        if not pad[Y+1,X]: nxt.setdefault((x+1,y+1),[]).append((x,y+1))
        if not pad[Y,X-1]: nxt.setdefault((x,y+1),[]).append((x,y))
    y0=ys.min(); x0=xs[ys==y0].min(); start=(x0,y0); loop=[start]; cur=start; prev=None
    while True:
        c=nxt.get(cur,[])
        if not c: break
        if len(c)==1: n=c[0]
        else:
            if prev is None: n=c[0]
            else:
                dx,dy=cur[0]-prev[0],cur[1]-prev[1]; want=(cur[0]-dy,cur[1]+dx); n=want if want in c else c[0]
        nxt[cur].remove(n); prev,cur=cur,n
        if cur==start: break
        loop.append(cur)
        if len(loop)>400000: break
    P=[]
    for i,p in enumerate(loop):
        a=loop[i-1]; b=loop[(i+1)%len(loop)]
        if (p[0]-a[0])*(b[1]-p[1])-(p[1]-a[1])*(b[0]-p[0])==0: continue
        P.append(p)
    return P
def simplify_rect(P,tol):
    P=[tuple(p) for p in P]; changed=True
    while changed and len(P)>4:
        changed=False; n=len(P)
        for i in range(n):
            a=P[i]; b=P[(i+1)%n]
            if abs(a[0]-b[0])+abs(a[1]-b[1])>=tol: continue
            p=P[(i-1)%n]; q=P[(i+2)%n]
            if a[0]==b[0]:
                y=a[1] if abs(p[0]-a[0])>=abs(q[0]-b[0]) else b[1]; P[(i-1)%n]=(p[0],y); P[(i+2)%n]=(q[0],y)
            else:
                x=a[0] if abs(p[1]-a[1])>=abs(q[1]-b[1]) else b[0]; P[(i-1)%n]=(x,p[1]); P[(i+2)%n]=(x,q[1])
            for idx in sorted([i,(i+1)%n],reverse=True): P.pop(idx)
            changed=True; break
        Q=[]
        for i,pt in enumerate(P):
            a=P[i-1]; b=P[(i+1)%len(P)]
            if (pt[0]-a[0])*(b[1]-pt[1])-(pt[1]-a[1])*(b[0]-pt[0])==0: continue
            Q.append(pt)
        if len(Q)>=4: P=Q
    return P
def run(name,imgfile,ox,oy,ppm,classes,minpx,outprefix,grow_px=2):
    img=np.array(Image.open(S+"/bro/"+imgfile).convert("RGB"))
    cl=classify(img)
    def to_blcs(px,py): return [int(round((px-ox)/ppm*1000)), int(round((oy-py)/ppm*1000))]
    result=[]; lab_all=np.zeros(cl.shape,dtype=np.int32); nid=0
    for c in classes:
        mask=(cl==c)
        lab,regs=components(mask,minpx)
        for r in regs:
            m=(lab==r['id'])
            # grow by grow_px to reach wall faces (fills the thin anti-aliased fringe)
            g=m.copy()
            for _ in range(grow_px):
                p=g.copy(); p[1:,:]|=g[:-1,:]; p[:-1,:]|=g[1:,:]; p[:,1:]|=g[:,:-1]; p[:,:-1]|=g[:,1:]; g=p
            P=outline_px(g)
            if not P: continue
            P=simplify_rect(P,max(3,int(0.06*ppm)))   # drop jogs < 60 mm
            poly=[to_blcs(x,y) for x,y in P]
            A=abs(0.5*sum(poly[i][0]*poly[(i+1)%len(poly)][1]-poly[(i+1)%len(poly)][0]*poly[i][1] for i in range(len(poly))))/1e6
            if A<0.3: continue
            nid+=1; lab_all[m]=nid
            bb=r['bbox']; result.append(dict(id=nid,cls=c,areaM2=round(A,2),px=[float(r['cx']),float(r['cy'])],c=to_blcs(r['cx'],r['cy']),
                                             bbox=[to_blcs(bb[0],bb[3]),to_blcs(bb[2],bb[1])],poly=poly))
    json.dump(dict(name=name,img=imgfile,ox=ox,oy=oy,ppm=ppm,regions=result),open(S+"/%s_regions.json"%outprefix,"w"))
    # map image
    im=Image.fromarray(img).convert("RGB"); d=ImageDraw.Draw(im)
    for r in result:
        pts=[((x/1000*ppm)+ox,oy-(y/1000*ppm)) for x,y in r['poly']]
        d.line(pts+[pts[0]],fill=(255,0,0),width=2); d.text((r['px'][0]-8,r['px'][1]-6),str(r['id']),fill=(0,0,0))
    # metre grid
    W,H=im.size
    for mx in range(-25,15):
        x=ox+mx*ppm
        if 0<=x<W: d.line([(x,0),(x,H)],fill=(255,150,150)); d.text((x+2,2),str(mx),fill=(200,0,0))
    for my in range(-12,14):
        y=oy-my*ppm
        if 0<=y<H: d.line([(0,y),(W,y)],fill=(150,150,255)); d.text((2,y+2),str(my),fill=(0,0,200))
    im.save(S+"/%s_map.png"%outprefix)
    print(name,"regions:",len(result),Counter(r['cls'] for r in result))
    return result
if __name__=='__main__':
    which=sys.argv[1]
    if which=='f1':
        run("First floor (check)","p-004.png",1615.5,719.5,76.0,['purple','orange','pink','green','blue','grey'],300,"f1")
    if which=='f6':
        run("Sixth floor","p-016.png",1610.4,714.6,76.0,['purple','orange','green','blue','grey','lgrey','white'],300,"f6")
    if which=='gf':
        run("Ground floor","p-000.png",1707.0,702.0,52.2,['purple','grey','lgrey','white','blue'],200,"gf")
