"""Phase 2: instantiate levels from templates, extrude to 3D, write a .glb (ids preserved as node names/extras),
and build the navigation graph. Reads/writes docs/spatial/laxmi-pushp.building.json."""
import json, struct, math, copy, datetime
S="/private/tmp/claude-501/-Volumes-works-space-movo/7376b897-dd79-4404-9121-d7b8a17d4b18/scratchpad"
DOC="/Volumes/works-space/movo/docs/spatial"
b=json.load(open(DOC+"/laxmi-pushp.building.json")); B=b['building']; T=B['templates']
WALL=100; SLAB=150; FINISH=50

# ---------------- geometry helpers ----------------
def area2(P): return 0.5*sum(P[i][0]*P[(i+1)%len(P)][1]-P[(i+1)%len(P)][0]*P[i][1] for i in range(len(P)))
def ccw(P): return P if area2(P)>0 else P[::-1]
def dedupe(P):
    Q=[]
    for p in P:
        if not Q or (abs(p[0]-Q[-1][0])+abs(p[1]-Q[-1][1]))>0: Q.append(list(p))
    if len(Q)>1 and Q[0]==Q[-1]: Q.pop()
    # remove collinear
    R=[]
    for i,p in enumerate(Q):
        a=Q[i-1]; c=Q[(i+1)%len(Q)]
        if (p[0]-a[0])*(c[1]-p[1])-(p[1]-a[1])*(c[0]-p[0])==0: continue
        R.append(p)
    return R if len(R)>=3 else Q
def point_in_tri(p,a,b_,c):
    def s(u,v,w): return (u[0]-w[0])*(v[1]-w[1])-(v[0]-w[0])*(u[1]-w[1])
    d1=s(p,a,b_); d2=s(p,b_,c); d3=s(p,c,a)
    return not((d1<0 or d2<0 or d3<0) and (d1>0 or d2>0 or d3>0))
def triangulate(P):
    """ear clipping on a simple CCW polygon (list of [x,y]); returns index triples."""
    P=ccw(dedupe(P)); n=len(P); idx=list(range(n)); tris=[]; guard=0
    while len(idx)>3 and guard<10000:
        guard+=1; found=False
        for k in range(len(idx)):
            i0,i1,i2=idx[k-1],idx[k],idx[(k+1)%len(idx)]
            a,b_,c=P[i0],P[i1],P[i2]
            cross=(b_[0]-a[0])*(c[1]-b_[1])-(b_[1]-a[1])*(c[0]-b_[0])
            if cross<=0: continue
            ok=True
            for j in idx:
                if j in (i0,i1,i2): continue
                if point_in_tri(P[j],a,b_,c): ok=False; break
            if ok: tris.append((i0,i1,i2)); idx.pop(k); found=True; break
        if not found:  # degenerate: fan
            for k in range(1,len(idx)-1): tris.append((idx[0],idx[k],idx[k+1]))
            idx=idx[:3]; break
    if len(idx)==3: tris.append(tuple(idx))
    return P,tris
def offset_inward(P,d):
    """offset a CCW rectilinear-ish polygon inward by d (per-edge normal offset, corner by line intersection)."""
    P=ccw(dedupe(P)); n=len(P); out=[]
    lines=[]
    for i in range(n):
        a=P[i]; c=P[(i+1)%n]; dx,dy=c[0]-a[0],c[1]-a[1]; L=math.hypot(dx,dy) or 1
        nx,ny=-dy/L,dx/L   # left normal = inward for CCW
        lines.append((a[0]+nx*d,a[1]+ny*d,dx,dy))
    for i in range(n):
        x1,y1,dx1,dy1=lines[i-1]; x2,y2,dx2,dy2=lines[i]
        den=dx1*dy2-dy1*dx2
        if abs(den)<1e-9: out.append([x2,y2]); continue
        t=((x2-x1)*dy2-(y2-y1)*dx2)/den; out.append([x1+dx1*t,y1+dy1*t])
    return out

class MeshBuf:
    def __init__(self): self.pos=[]; self.idx=[]; self.n=0
    def add_prism(self,P,z0,z1):
        """closed polygon P (CCW) extruded from z0 to z1: top, bottom, sides."""
        P,tris=triangulate(P); n=len(P); base=self.n
        for x,y in P: self.pos.append((x/1000,y/1000,z1/1000))
        for x,y in P: self.pos.append((x/1000,y/1000,z0/1000))
        for a,b_,c in tris: self.idx+= [base+a,base+b_,base+c]            # top (CCW from above)
        for a,b_,c in tris: self.idx+= [base+n+a,base+n+c,base+n+b_]      # bottom
        for i in range(n):
            j=(i+1)%n; ti,tj,bi,bj=base+i,base+j,base+n+i,base+n+j
            self.idx+=[bi,bj,tj, bi,tj,ti]
        self.n+=2*n
    def add_box(self,x0,y0,x1,y1,z0,z1): self.add_prism([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],z0,z1)

COLORS={'living':(1.0,0.85,0.6),'kitchen':(1.0,0.95,0.55),'bedroom':(0.72,0.8,1.0),'toilet':(0.6,0.9,0.9),'balcony':(0.7,0.95,0.7),'terrace':(0.6,0.9,0.6),
        'passage':(0.9,0.9,0.9),'corridor':(0.9,0.85,1.0),'shaft':(0.7,0.7,0.7),'lift':(0.6,0.6,1.0),'stair':(1.0,0.7,0.7),'parking_area':(0.93,0.93,0.93),
        'unknown':(0.85,0.85,0.85),'wall':(0.55,0.55,0.55),'column':(0.5,0.2,0.5),'liftwall':(0.3,0.3,0.6),'stairblock':(0.8,0.4,0.4),'door':(0.6,0.35,0.15),
        'shop':(0.8,0.7,0.95),'parking_slot':(0.8,0.9,0.8),'two_wheeler_area':(0.75,0.9,0.9),'site':(0.2,0.2,0.2),'flat':(0.4,0.4,0.9)}

# ---------------- level instances ----------------
def inst_code(code,level):
    L=level['id']; n=level['index']
    if '/TYP/' in code:
        code=code.replace('/TYP/','/%s/'%L)
        import re
        code=re.sub(r'/F(0[1-5])/', lambda m_: '/F%d%s/'%(n,m_.group(1)), code)
    elif '/SIXTH/' in code: code=code.replace('/SIXTH/','/L6/')
    elif '/GF/' in code: code=code.replace('/GF/','/L0/')
    return code
nodes=[]; meshes=[]; instances=[]
def add_object(level,obj,kind,subtype,name,meshbuf,color,extra=None):
    code=inst_code(obj.get('code','B1/%s/%s'%(level['id'],name)),level)
    i=len(meshes); meshes.append((meshbuf,color))
    ex=dict(code=code,templateCode=obj.get('code'),kind=kind,subtype=subtype,name=name,levelId=level['id'],confidence=(obj.get('source') or {}).get('confidence'))
    if extra: ex.update(extra)
    nodes.append(dict(name=code,mesh=i,extras=ex)); instances.append(ex)

for L in B['levels']:
    if not L.get('template'): continue
    tpl=T[L['template']]; z0=L['elevationMm']; h=L['heightMm'] or 3000; ztop=z0+h-SLAB
    # spaces: floor plate + walls
    for s in tpl['spaces']:
        P=ccw(dedupe(s['geometry']['coords']))
        if len(P)<3: continue
        mb=MeshBuf(); mb.add_prism(P,z0-20,z0)
        add_object(L,s,'space',s['subtype'],s['name'],mb,COLORS.get(s['subtype'],COLORS['unknown']),dict(areaM2=s.get('areaM2'),flatPosition=s.get('flatPosition')))
        if s['subtype'] in ('parking_area','terrace','balcony','site'): continue
        inner=offset_inward(P,WALL); wb=MeshBuf(); n=len(P)
        wh=ztop if s['subtype'] not in ('balcony',) else z0+1000
        for i in range(n):
            j=(i+1)%n; quad=[P[i],P[j],inner[j],inner[i]]
            try: wb.add_prism(quad,z0,wh)
            except Exception: pass
        add_object(L,dict(code=s['code']+'/WALLS',source=s.get('source')),'element','wall','Walls of '+s['name'],wb,COLORS['wall'],dict(of=inst_code(s['code'],L)))
    # zones: flats/shops as thin outlines (floor plates slightly below), parking slots plates
    for z in tpl['zones']:
        if not z.get('geometry'): continue
        P=ccw(dedupe(z['geometry']['coords'])); mb=MeshBuf(); mb.add_prism(P,z0-40,z0-25)
        add_object(L,z,'zone',z['subtype'],z['name'],mb,COLORS.get(z['subtype'],COLORS['flat']),dict(areaM2=z.get('areaM2'),flatPosition=z.get('flatPosition'),reraCarpetM2=z.get('reraCarpetM2')))
    # elements
    for e in tpl['elements']:
        st=e['subtype']; g=e['geometry']
        if st=='column':
            mb=MeshBuf(); mb.add_prism(g['coords'],z0,z0+h); add_object(L,e,'element','column',e['name'],mb,COLORS['column'])
        elif st=='lift':
            mb=MeshBuf(); o=e['geometry']['coords']; inn=e['inner']
            ox0,oy0,ox1,oy1=o[0][0],o[0][1],o[2][0],o[2][1]; ix0,iy0,ix1,iy1=inn[0][0],inn[0][1],inn[2][0],inn[2][1]
            mb.add_box(ox0,oy0,ox1,iy0,z0,z0+h); mb.add_box(ox0,iy1,ox1,oy1,z0,z0+h); mb.add_box(ix1,iy0,ox1,iy1,z0,z0+h)
            d=e['door']; mb.add_box(ox0,iy0,ix0,d['y0'],z0,z0+h); mb.add_box(ox0,d['y1'],ix0,iy1,z0,z0+h); mb.add_box(ox0,d['y0'],ix0,d['y1'],z0+2100,z0+h)
            add_object(L,e,'element','lift',e['name'],mb,COLORS['liftwall'],dict(door=d))
        elif st=='stair':
            mb=MeshBuf(); mb.add_prism(g['coords'],z0,z0+h/2); add_object(L,e,'element','stair',e['name'],mb,COLORS['stairblock'],dict(note='block placeholder: U-shaped stair, half height shown'))
        elif st=='site_boundary':
            P=ccw(dedupe(g['coords'])); inner=offset_inward(P,150); mb=MeshBuf(); n=len(P)
            for i in range(n):
                j=(i+1)%n; mb.add_prism([P[i],P[j],inner[j],inner[i]],z0-600,z0+100)
            add_object(L,e,'element','site_boundary',e['name'],mb,COLORS['site'])
        elif st=='entrance':
            x,y=g['coords']; mb=MeshBuf(); mb.add_box(x-300,y-300,x+300,y+300,z0-600,z0+200); add_object(L,e,'element','entrance',e['name'],mb,(1,0,0))
    # openings (doors) as frames
    for o in tpl.get('openings',[]):
        if o['subtype']!='door': continue
        (x0,y0),(x1,y1)=o['geometry']['coords']; mb=MeshBuf(); mb.add_box(x0,y0,x1,y1,z0,z0+2100)
        add_object(L,o,'opening','door','Door %d mm'%o['widthMm'],mb,COLORS['door'],dict(widthMm=o['widthMm']))
print("objects:",len(nodes))

# ---------------- glb writer ----------------
def write_glb(path):
    bin_=bytearray(); bufferViews=[]; accessors=[]; gl_meshes=[]; materials=[]; matidx={}
    def pad():
        while len(bin_)%4: bin_.append(0)
    for i,(mb,color) in enumerate(meshes):
        if not mb.pos: continue
        key=tuple(round(c,3) for c in color)
        if key not in matidx:
            matidx[key]=len(materials); materials.append(dict(name="mat_%d"%len(materials),pbrMetallicRoughness=dict(baseColorFactor=[color[0],color[1],color[2],1.0],metallicFactor=0.0,roughnessFactor=0.9),doubleSided=True))
        pad(); off=len(bin_)
        for p in mb.pos: bin_+=struct.pack('<fff',*p)
        xs=[p[0] for p in mb.pos]; ys=[p[1] for p in mb.pos]; zs=[p[2] for p in mb.pos]
        bufferViews.append(dict(buffer=0,byteOffset=off,byteLength=len(bin_)-off,target=34962)); pv=len(bufferViews)-1
        accessors.append(dict(bufferView=pv,componentType=5126,count=len(mb.pos),type="VEC3",min=[min(xs),min(ys),min(zs)],max=[max(xs),max(ys),max(zs)])); pa=len(accessors)-1
        pad(); off=len(bin_)
        for k in mb.idx: bin_+=struct.pack('<I',k)
        bufferViews.append(dict(buffer=0,byteOffset=off,byteLength=len(bin_)-off,target=34963)); iv=len(bufferViews)-1
        accessors.append(dict(bufferView=iv,componentType=5125,count=len(mb.idx),type="SCALAR")); ia=len(accessors)-1
        gl_meshes.append(dict(name=nodes[i]['name'],primitives=[dict(attributes=dict(POSITION=pa),indices=ia,material=matidx[key])]))
        nodes[i]['mesh']=len(gl_meshes)-1
    pad()
    gl_nodes=[dict(name=n['name'],mesh=n['mesh'],extras=n['extras']) for n in nodes]
    gltf=dict(asset=dict(version="2.0",generator="movo build_3d.py",extras=dict(units="metres",frame="BLCS: origin lift shaft SW corner, +X east, +Y north, +Z up")),
        scene=0,scenes=[dict(name="Laxmi-Pushp",nodes=list(range(len(gl_nodes))))],nodes=gl_nodes,meshes=gl_meshes,materials=materials,
        accessors=accessors,bufferViews=bufferViews,buffers=[dict(byteLength=len(bin_))])
    js=json.dumps(gltf,separators=(',',':')).encode()
    while len(js)%4: js+=b' '
    total=12+8+len(js)+8+len(bin_)
    with open(path,'wb') as f:
        f.write(struct.pack('<III',0x46546C67,2,total)); f.write(struct.pack('<II',len(js),0x4E4F534A)); f.write(js); f.write(struct.pack('<II',len(bin_),0x004E4942)); f.write(bin_)
    print("glb",path,total//1024,"KB, meshes",len(gl_meshes))
write_glb(DOC+"/laxmi-pushp.glb")

# ---------------- navigation graph ----------------
def centroid(P):
    A=area2(P);
    if abs(A)<1e-6: return [sum(p[0] for p in P)/len(P),sum(p[1] for p in P)/len(P)]
    cx=cy=0
    for i in range(len(P)):
        x0,y0=P[i]; x1,y1=P[(i+1)%len(P)]; cr=x0*y1-x1*y0; cx+=(x0+x1)*cr; cy+=(y0+y1)*cr
    return [cx/(6*A),cy/(6*A)]
def pip(pt,P):
    x,y=pt; inside=False; n=len(P)
    for i in range(n):
        x0,y0=P[i]; x1,y1=P[(i+1)%n]
        if (y0>y)!=(y1>y):
            xi=x0+(y-y0)*(x1-x0)/(y1-y0)
            if xi>x: inside=not inside
    return inside
WALK_SPEED=1.2  # m/s
nav_nodes=[]; nav_edges=[]
def nid(level,tag): return "n_%s_%s"%(level['id'],tag)
def add_node(level,tag,p,kind,space=None,name=None):
    n=dict(id=nid(level,tag),levelId=level['id'],p=[int(p[0]),int(p[1])],kind=kind,space=space,name=name); nav_nodes.append(n); return n['id']
def add_edge(a,b_,kind,length_mm=None,cost_s=None):
    if length_mm is None:
        pa=next(n for n in nav_nodes if n['id']==a)['p']; pb=next(n for n in nav_nodes if n['id']==b_)['p']; length_mm=math.hypot(pa[0]-pb[0],pa[1]-pb[1])
    if cost_s is None: cost_s=length_mm/1000/WALK_SPEED
    nav_edges.append(dict(a=a,b=b_,kind=kind,lengthMm=int(length_mm),costS=round(cost_s,1)))
WALKABLE=('living','kitchen','bedroom','toilet','passage','corridor','balcony','terrace','parking_area','unknown')
lift_nodes={}; stair_nodes={}
for L in B['levels']:
    if not L.get('template'): continue
    tpl=T[L['template']]
    spaces=[s for s in tpl['spaces'] if s['subtype'] in WALKABLE]
    scode={}
    for s in spaces:
        c=centroid(ccw(dedupe(s['geometry']['coords']))); code=inst_code(s['code'],L)
        scode[s['code']]=add_node(L,'sp_'+code.split('/')[-2].lower()+'_'+code.split('/')[-1].lower(),c,'space',code,s['name'])
    lobby=next((s for s in tpl['spaces'] if s['subtype']=='corridor'),None)
    lobby_id=scode.get(lobby['code']) if lobby else None
    # lift door node (west face centre) and stair entries
    lift_nodes[L['id']]=add_node(L,'lift',[-600,970],'lift',None,'Lift door')
    if lobby_id: add_edge(lift_nodes[L['id']],lobby_id,'walk')
    st_n=add_node(L,'stair_n',[900-500,2550],'stair',None,'Stair, north entry'); st_s=add_node(L,'stair_s',[900-500,-620],'stair',None,'Stair, south entry')
    stair_nodes[L['id']]=(st_n,st_s)
    if lobby_id: add_edge(st_n,lobby_id,'walk'); add_edge(st_s,lobby_id,'walk')
    # doors: connect the two spaces on either side
    doors=[o for o in tpl.get('openings',[]) if o['widthMm']<=1300]   # door-sized gaps, any classification
    seen=set()
    for k,o in enumerate(doors):
        (x0,y0),(x1,y1)=o['geometry']['coords']; cx,cy=(x0+x1)/2,(y0+y1)/2
        sa=sb=None
        for dprobe in (200,350,500):
            if o['wallDirection']=='EW': pa,pb=(cx,y0-dprobe),(cx,y1+dprobe)
            else: pa,pb=(x0-dprobe,cy),(x1+dprobe,cy)
            sa=sa or next((s for s in spaces if pip(pa,s['geometry']['coords'])),None); sb=sb or next((s for s in spaces if pip(pb,s['geometry']['coords'])),None)
        if not sa or not sb or sa is sb: continue
        key=tuple(sorted((sa['code'],sb['code'])))
        if key in seen: continue
        seen.add(key)
        d=add_node(L,'door_%d'%k,[cx,cy],'door',None,'Door %d mm'%o['widthMm'])
        add_edge(d,scode[sa['code']],'walk'); add_edge(d,scode[sb['code']],'walk')
    # spaces still isolated: connect to nearest space node of the same flat, else lobby (fallback, flagged)
    deg={n['id']:0 for n in nav_nodes if n['levelId']==L['id']}
    for e in nav_edges:
        if e['a'] in deg: deg[e['a']]+=1
        if e['b'] in deg: deg[e['b']]+=1
    for s in spaces:
        sid=scode[s['code']]
        if deg.get(sid,0)>0: continue
        cands=[(t,scode[t['code']]) for t in spaces if t is not s and t.get('flatPosition')==s.get('flatPosition') and deg.get(scode[t['code']],0)>0]
        if not cands and lobby_id: cands=[(lobby,lobby_id)]
        if not cands: continue
        c0=centroid(ccw(dedupe(s['geometry']['coords'])))
        best=min(cands,key=lambda c:(centroid(ccw(dedupe(c[0]['geometry']['coords'])))[0]-c0[0])**2+(centroid(ccw(dedupe(c[0]['geometry']['coords'])))[1]-c0[1])**2)
        add_edge(sid,best[1],'walk_fallback'); deg[sid]+=1
    # ground floor: entries, shops, parking slots connect through the parking floor
    if L['template']=='GF':
        pf=next((s for s in tpl['spaces'] if s['subtype']=='parking_area'),None); pf_id=scode.get(pf['code']) if pf else None
        for e in tpl['elements']:
            if e['subtype']=='entrance':
                n=add_node(L,e['code'].split('/')[-1].lower(),e['geometry']['coords'],'entrance',None,e['name'])
                if pf_id: add_edge(n,pf_id,'walk')
        for z in tpl['zones']:
            if z['subtype'] in ('shop','parking_slot','two_wheeler_area'):
                c=centroid(ccw(dedupe(z['geometry']['coords']))); n=add_node(L,z['code'].split('/')[-1].lower(),c,z['subtype'],inst_code(z['code'],L),z['name'])
                if pf_id: add_edge(n,pf_id,'walk')
        if pf_id and lobby_id: add_edge(pf_id,lobby_id,'walk')
# vertical edges
levels=[L for L in B['levels'] if L.get('template')]
for a,bb in zip(levels,levels[1:]):
    add_edge(lift_nodes[a['id']],lift_nodes[bb['id']],'lift',length_mm=abs(bb['elevationMm']-a['elevationMm']),cost_s=40)
    add_edge(stair_nodes[a['id']][0],stair_nodes[bb['id']][1],'stair',length_mm=int(abs(bb['elevationMm']-a['elevationMm'])*1.8),cost_s=25)
    add_edge(stair_nodes[a['id']][1],stair_nodes[bb['id']][0],'stair',length_mm=int(abs(bb['elevationMm']-a['elevationMm'])*1.8),cost_s=25)
B['nav']=dict(walkSpeedMps=WALK_SPEED,nodes=nav_nodes,edges=nav_edges,
    notes=["Nodes: one per walkable space (centroid), one per classified door, lift door and two stair entries per level, entries/shops/slots on the ground floor.",
           "Edges: door<->space, lift and stair between adjacent levels (lift 40 s, stair 25 s per floor), walk_fallback where no door was detected (flagged, verify).",
           "Straight-line lengths; no obstacle routing inside a room yet."])
B['instances']=instances
b['schemaVersion']="0.3"; b['generatedAt']=datetime.date.today().isoformat()
json.dump(b,open(DOC+"/laxmi-pushp.building.json","w"),indent=1)
from collections import Counter
print("nav nodes",len(nav_nodes),"edges",len(nav_edges),Counter(e['kind'] for e in nav_edges))
