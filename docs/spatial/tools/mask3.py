"""Typical floor: wall mask -> rooms (regions). Input segs.json (mm, page coords). Output regions.json, labels.npy, region_map.png, tiles."""
import json, math
from collections import defaultdict, deque, Counter
import numpy as np
from PIL import Image, ImageDraw
S="/private/tmp/claude-501/-Volumes-works-space-movo/7376b897-dd79-4404-9121-d7b8a17d4b18/scratchpad"
segs=json.load(open(S+"/segs.json"))
G46='rgb(46.273804%, 46.273804%, 46.273804%)'; G59='rgb(59.606934%, 59.606934%, 59.606934%)'; BLK='rgb(0%, 0%, 0%)'; G72='rgb(72.940063%, 72.940063%, 72.940063%)'
OX,OY=20790,12522           # BLCS origin in page mm (outer SW corner of lift shaft)
MM=20; X0,X1,Y0,Y1=-20000,11000,-9000,10500
W=(X1-X0)//MM; H=(Y1-Y0)//MM
MAXGAP=200; MAXROWS=22

def cls(s):
    a=s['ang']; axis=(a<1.5 or a>178.5 or 88.5<=a<=91.5); diag=(43<=a<=47 or 133<=a<=137)
    c=s['color']; w=s['w']
    if c==G46 and abs(w-12.7)<0.5 and diag and s['len']<260: return 'hatch'
    if c==G46 and abs(w-12.7)<0.5 and axis: return 'g46axis'
    if c==G46 and abs(w-28.6)<0.5: return 'g46thick'
    if c==G59 and w>18: return 'g59thick'
    if c==G72: return 'g72'
    return 'other'
for s in segs: s['cls']=cls(s)

# ---------- columns (from thick rectangles) + labels ----------
LABELS=['C3','C2','C1','C6','C8','C4','C7','C9','C5','C10','C13','C15','C11','C14','C12','C18','C17','C16','LC1','LC2','C21','C19','C20','C23','C22','C24','LC3','LC4','C25','C26','C30','C29','C31','C27','C28','C33','C35','C34','C32','C36','C37']
labels=json.load(open(S+"/labels_raw.json"))
thick=[s for s in segs if s['cls']=='g46thick' and (s['ang']<1.5 or s['ang']>178.5 or 88.5<=s['ang']<=91.5)]
bypid=defaultdict(list)
for s in thick: bypid[s['pid']].append(s)
rects=[]
for pid,ss in bypid.items():
    xs=[p for s in ss for p in (s['x1'],s['x2'])]; ys=[p for s in ss for p in (s['y1'],s['y2'])]
    w=max(xs)-min(xs); h=max(ys)-min(ys)
    if len(ss)>=3 and 120<=w<=900 and 120<=h<=900:
        rects.append(dict(x0=round(min(xs)-OX),y0=round(min(ys)-OY),x1=round(max(xs)-OX),y1=round(max(ys)-OY)))
used=set(); cols=[]
for r in rects:
    cx=(r['x0']+r['x1'])/2; cy=(r['y0']+r['y1'])/2; best=None
    for i,l in enumerate(labels):
        if i in used: continue
        lx=(l['x0']+l['x1'])/2-OX; ly=(l['y0']+l['y1'])/2-OY; dd=math.hypot(lx-cx,ly-cy)
        if best is None or dd<best[0]: best=(dd,i)
    used.add(best[1]); cols.append(dict(code=LABELS[best[1]],x0=r['x0'],y0=r['y0'],x1=r['x1'],y1=r['y1'],w=r['x1']-r['x0'],h=r['y1']-r['y0']))
cols.sort(key=lambda c:(c['code'][0]!='C', int(''.join(ch for ch in c['code'] if ch.isdigit()))))
json.dump(cols,open(S+"/columns.json","w"),indent=1)

# ---------- raw wall mask ----------
def P(x,y): return ((x-X0)/MM,(Y1-y)/MM)
imH=Image.new('L',(W,H),0); dH=ImageDraw.Draw(imH)
imF=Image.new('L',(W,H),0); dF=ImageDraw.Draw(imF)
for s in segs:
    c=s['cls']
    if c=='hatch': dH.line([P(s['x1']-OX,s['y1']-OY),P(s['x2']-OX,s['y2']-OY)],fill=255,width=3)
    elif c in ('g46thick','g59thick','g72'): dF.line([P(s['x1']-OX,s['y1']-OY),P(s['x2']-OX,s['y2']-OY)],fill=255,width=2)
for r in rects: dF.rectangle([P(r['x0'],r['y1']),P(r['x1'],r['y0'])],fill=255)
hat=np.array(imH)>0; fac=np.array(imF)>0

def dil(m,n=1):
    o=m.copy()
    for _ in range(n):
        p=o.copy(); p[1:,:]|=o[:-1,:]; p[:-1,:]|=o[1:,:]; p[:,1:]|=o[:,:-1]; p[:,:-1]|=o[:,1:]; o=p
    return o
def ero(m,n=1):
    o=m.copy()
    for _ in range(n):
        p=o.copy(); p[1:,:]&=o[:-1,:]; p[:-1,:]&=o[1:,:]; p[:,1:]&=o[:,:-1]; p[:,:-1]&=o[:,1:]; o=p
    return o
hat_closed=ero(dil(hat,3),3)
THICK=10                                   # 200 mm: anything thicker than a wall band is floor hatch
thick=dil(ero(hat_closed,THICK),THICK)
raw=(hat & ~thick) | fac
np.save(S+"/floorhatch.npy",thick)
print("floor-hatch area removed from walls: %.1f m2"%(thick.sum()*MM*MM/1e6))
solid=ero(dil(raw,3),3)          # morphological closing 7x7: hatch gaps become solid wall

def close_gaps(m):
    """Fill door/window gaps: free runs bounded by wall within MAXGAP, tracked across rows by overlap;
    fill a group if it spans <=MAXROWS rows and its flanks are thick (>=5px perpendicular) on most rows."""
    Hh,Ww=m.shape; fill=np.zeros_like(m); active=[]; nfilled=0
    for y in range(Hh+1):
        gaps=[]
        if y<Hh:
            row=m[y]; x=1
            while x<Ww:
                if not row[x] and row[x-1]:
                    xe=x
                    while xe<Ww and not row[xe]: xe+=1
                    if xe<Ww and (xe-x)<=MAXGAP:
                        ya,yb=max(0,y-2),min(Hh,y+3)
                        thick=bool(m[ya:yb,x-1].all() and m[ya:yb,xe].all())
                        gaps.append((x,xe,thick))
                    x=xe
                else: x+=1
        nxt=[]; used=set()
        for g in gaps:
            best=None; bo=0.0
            for i,a in enumerate(active):
                if i in used: continue
                ov=min(a['xe'],g[1])-max(a['x'],g[0])
                if ov<=0: continue
                r=ov/max(a['xe']-a['x'],g[1]-g[0])
                if r>=0.8 and r>bo: best=i; bo=r
            if best is None: nxt.append(dict(x=g[0],xe=g[1],rows=[(y,g[0],g[1],g[2])]))
            else:
                a=active[best]; used.add(best); a['x'],a['xe']=g[0],g[1]; a['rows'].append((y,g[0],g[1],g[2])); nxt.append(a)
        for i,a in enumerate(active):
            if i in used: continue
            rows=a['rows']
            if 4<=len(rows)<=MAXROWS:
                for yy,xx,xxe,_ in rows: fill[yy,xx:xxe]=True
                nfilled+=1
        active=nxt
    return m|fill,nfilled
closedH,nh=close_gaps(solid)
closedV,nv=close_gaps(solid.T); closedV=closedV.T
closed=closedH|closedV
print("solid frac %.3f  gap groups filled: H %d  V %d"%(solid.mean(),nh,nv))
barrier=dil(closed,1)

# ---------- regions ----------
lab=np.zeros((H,W),dtype=np.int32); cur=0; regions=[]; free=~barrier
for y in range(H):
    for x in range(W):
        if free[y,x] and lab[y,x]==0:
            cur+=1; q=deque([(y,x)]); lab[y,x]=cur; cnt=0; sx=sy=0; minx=maxx=x; miny=maxy=y; border=False
            while q:
                cy,cx=q.popleft(); cnt+=1; sx+=cx; sy+=cy
                minx=min(minx,cx); maxx=max(maxx,cx); miny=min(miny,cy); maxy=max(maxy,cy)
                if cx==0 or cy==0 or cx==W-1 or cy==H-1: border=True
                for ny,nx in ((cy-1,cx),(cy+1,cx),(cy,cx-1),(cy,cx+1)):
                    if 0<=ny<H and 0<=nx<W and free[ny,nx] and lab[ny,nx]==0:
                        lab[ny,nx]=cur; q.append((ny,nx))
            regions.append(dict(id=cur,area_m2=round(cnt*MM*MM/1e6,2),border=border,cx=round(X0+(sx/cnt+0.5)*MM),cy=round(Y1-(sy/cnt+0.5)*MM),
                                bbox=[X0+minx*MM,Y1-(maxy+1)*MM,X0+(maxx+1)*MM,Y1-miny*MM]))
keep=[r for r in regions if r['area_m2']>=0.3 and not r['border']]
print("regions total",len(regions),"kept",len(keep))
np.save(S+"/labels.npy",lab); np.save(S+"/closed.npy",closed)
json.dump(dict(MM=MM,X0=X0,X1=X1,Y0=Y0,Y1=Y1,regions=keep),open(S+"/regions.json","w"))

# ---------- map + tiles ----------
rng=np.random.default_rng(7); pal=rng.integers(100,245,size=(cur+1,3)); pal[0]=(255,255,255)
rgb=pal[lab]; rgb[barrier]=(40,40,40)
for b in [r['id'] for r in regions if r['border']]: rgb[lab==b]=(255,255,255)
out=Image.fromarray(rgb.astype('uint8')).resize((W*2,H*2),Image.NEAREST); do=ImageDraw.Draw(out)
for r in keep:
    px,py=P(r['cx'],r['cy']); do.text((px*2-8,py*2-6),str(r['id']),fill=(0,0,0))
for c in cols:
    px,py=P((c['x0']+c['x1'])/2,(c['y0']+c['y1'])/2); do.text((px*2-8,py*2-16),c['code'],fill=(200,0,200))
for mx in range(-20,12):
    px=P(mx*1000,0)[0]*2; do.line([(px,0),(px,H*2)],fill=(255,180,180)); do.text((px+2,2),str(mx),fill=(200,0,0))
for my in range(-9,11):
    py=P(0,my*1000)[1]*2; do.line([(0,py),(W*2,py)],fill=(255,180,180)); do.text((2,py+2),str(my),fill=(200,0,0))
out.save(S+"/region_map.png")
Wm,Hm=out.size; cw,ch=1150,1050
for r_,y0 in enumerate((0,Hm-ch)):
    for c_,x0 in enumerate((0,(Wm-cw)//2,Wm-cw)): out.crop((x0,y0,x0+cw,y0+ch)).save(S+"/rm_%d%d.png"%(r_,c_))
for r in sorted(keep,key=lambda r:-r['area_m2'])[:45]: print(r['id'],r['area_m2'],'m2 c=(%d,%d)'%(r['cx'],r['cy']),'bbox',r['bbox'])
