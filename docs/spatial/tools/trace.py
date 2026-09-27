"""Trace rectilinear outline polygons from label masks (20 mm/px)."""
import numpy as np, json
S="/private/tmp/claude-501/-Volumes-works-space-movo/7376b897-dd79-4404-9121-d7b8a17d4b18/scratchpad"
meta=json.load(open(S+"/regions.json")); MM=meta['MM']; X0=meta['X0']; Y1=meta['Y1']
lab=np.load(S+"/labels.npy")
def mask_of(ids):
    m=np.zeros(lab.shape,dtype=bool)
    for i in ids: m|=(lab==i)
    return m
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
def outline(m, grow_px=0, bridge_px=18):
    """Outer boundary of m (blobs bridged by a morphological closing) as a closed rectilinear polygon in mm (BLCS), grown by grow_px."""
    k=max(bridge_px,grow_px)
    m=dil(m,k)
    if k-grow_px>0: m=ero(m,k-grow_px)
    H,W=m.shape
    ys,xs=np.nonzero(m)
    if len(ys)==0: return None
    # directed boundary edges, region kept on the left when walking (counter-clockwise in image coords => we convert later)
    # edge keyed by start corner -> end corner (corner coords: (x,y) with y in image rows)
    nxt={}
    pad=np.zeros((H+2,W+2),dtype=bool); pad[1:-1,1:-1]=m
    for y,x in zip(ys,xs):
        Y,X=y+1,x+1
        if not pad[Y-1,X]: nxt.setdefault((x,y),[]).append((x+1,y))       # top edge, walk right
        if not pad[Y,X+1]: nxt.setdefault((x+1,y),[]).append((x+1,y+1))   # right edge, walk down
        if not pad[Y+1,X]: nxt.setdefault((x+1,y+1),[]).append((x,y+1))   # bottom edge, walk left
        if not pad[Y,X-1]: nxt.setdefault((x,y+1),[]).append((x,y))       # left edge, walk up
    # start at topmost-leftmost pixel's top-left corner
    y0=ys.min(); x0=xs[ys==y0].min(); start=(x0,y0)
    loop=[start]; cur=start; prev=None; guard=0
    while True:
        cands=nxt.get(cur,[])
        if not cands: break
        if len(cands)==1: n=cands[0]
        else:
            # pinch point: prefer turning right relative to incoming direction (keeps outer loop tight)
            if prev is None: n=cands[0]
            else:
                dx,dy=cur[0]-prev[0],cur[1]-prev[1]
                # right turn of (dx,dy) in image coords is (-dy,dx)
                want=(cur[0]-dy,cur[1]+dx)
                n=want if want in cands else cands[0]
        nxt[cur].remove(n)
        prev,cur=cur,n
        if cur==start: break
        loop.append(cur); guard+=1
        if guard>200000: break
    # merge collinear
    pts=[]
    for i,p in enumerate(loop):
        a=loop[i-1]; b=loop[(i+1)%len(loop)]
        if (p[0]-a[0])*(b[1]-p[1])-(p[1]-a[1])*(b[0]-p[0])==0: continue
        pts.append(p)
    # rectilinear jog removal: drop edges shorter than tol px by making the neighbours collinear
    def simplify_rect(P,tol=3):
        P=[tuple(p) for p in P]; changed=True
        while changed and len(P)>4:
            changed=False; n=len(P)
            for i in range(n):
                a=P[i]; b=P[(i+1)%n]
                if abs(a[0]-b[0])+abs(a[1]-b[1])>=tol: continue
                p=P[(i-1)%n]; q=P[(i+2)%n]
                if a[0]==b[0]:   # short vertical jog between two horizontal edges
                    y=a[1] if abs(p[0]-a[0])>=abs(q[0]-b[0]) else b[1]
                    P[(i-1)%n]=(p[0],y); P[(i+2)%n]=(q[0],y)
                else:            # short horizontal jog between two vertical edges
                    x=a[0] if abs(p[1]-a[1])>=abs(q[1]-b[1]) else b[0]
                    P[(i-1)%n]=(x,p[1]); P[(i+2)%n]=(x,q[1])
                for idx in sorted([i,(i+1)%n],reverse=True): P.pop(idx)
                changed=True; break
            # merge collinear
            Q=[]
            for i,pt in enumerate(P):
                a=P[i-1]; b=P[(i+1)%len(P)]
                if (pt[0]-a[0])*(b[1]-pt[1])-(pt[1]-a[1])*(b[0]-pt[0])==0: continue
                Q.append(pt)
            if len(Q)>=4: P=Q
        return P
    pts=simplify_rect(pts)
    # to mm; image (x,y) corner -> BLCS
    poly=[[round(X0+x*MM),round(Y1-y*MM)] for x,y in pts]
    # ensure counter-clockwise in BLCS (y up)
    A=0.5*sum(poly[i][0]*poly[(i+1)%len(poly)][1]-poly[(i+1)%len(poly)][0]*poly[i][1] for i in range(len(poly)))
    if A<0: poly.reverse(); A=-A
    return dict(coords=poly, areaM2=round(A/1e6,2), n=len(poly))
if __name__=='__main__':
    for ids in ((58,),(23,),(7,),(79,),(100,)):
        r=outline(mask_of(ids),grow_px=2)
        print(ids,"vertices",r['n'],"area",r['areaM2'],r['coords'][:6],'...')
