"""Add GF and SIXTH templates (from brochure colour regions + hand polygons) and backfill TYP toilets from the first-floor raster."""
import json, copy, datetime
from PIL import Image, ImageDraw
S="/private/tmp/claude-501/-Volumes-works-space-movo/7376b897-dd79-4404-9121-d7b8a17d4b18/scratchpad"
OUT="/Volumes/works-space/movo/docs/spatial/laxmi-pushp.building.json"
b=json.load(open(OUT)); B=b['building']; TYP=B['templates']['TYP']
f1=json.load(open(S+"/f1_regions.json")); f6=json.load(open(S+"/f6_regions.json")); gf=json.load(open(S+"/gf_regions.json"))
def m(v): return int(round(v*1000))
def poly_area(P): return abs(0.5*sum(P[i][0]*P[(i+1)%len(P)][1]-P[(i+1)%len(P)][0]*P[i][1] for i in range(len(P))))/1e6
def rect(x0,y0,x1,y1): return [[m(x0),m(y0)],[m(x1),m(y0)],[m(x1),m(y1)],[m(x0),m(y1)]]
def inside(pt,bb): return bb[0]<=pt[0]<=bb[2] and bb[1]<=pt[1]<=bb[3]
def find(regs,cls,pt=None,bbox=None,minA=0):
    c=[r for r in regs['regions'] if r['cls']==cls and r['areaM2']>=minA]
    if bbox: c=[r for r in c if inside(r['c'],bbox)]
    if pt: c.sort(key=lambda r:(r['c'][0]-pt[0])**2+(r['c'][1]-pt[1])**2)
    return c[0] if c else None
def src(method,conf,val='REQUIRES_HUMAN_VALIDATION',drawing='Floor Plans_Laxmi-Pushp.pdf'): return dict(drawing=drawing,method=method,confidence=conf,validation=val)
def space(code,name,subtype,coords,flat,conf,method,labelFt=None,note=None):
    return dict(id="spo_"+code.lower().replace('/','_'),code=code,kind='space',subtype=subtype,name=name,flatPosition=flat,
                geometry=dict(type='polygon',coords=coords),areaM2=round(poly_area(coords),2),dimensions=dict(labelFt=labelFt),
                source=src(method,conf,'DRAWING_CONSISTENT' if conf=='high' else 'REQUIRES_HUMAN_VALIDATION'),note=note)

# ---------- 1) backfill TYP toilets from first-floor blue regions ----------
back=0
for sp in TYP['spaces']:
    if sp['subtype']!='toilet': continue
    xs=[p[0] for p in sp['geometry']['coords']]; ys=[p[1] for p in sp['geometry']['coords']]
    bb=[min(xs)-600,min(ys)-600,max(xs)+600,max(ys)+600]
    blues=[r for r in f1['regions'] if r['cls']=='blue' and inside(r['c'],bb)]
    if not blues: continue
    if len(blues)==1 and sp['name'] not in ('Bath + WC',):
        r=blues[0]; sp['geometry']=dict(type='polygon',coords=r['poly']); sp['areaM2']=r['areaM2']
        sp['source']=src('brochure first-floor raster, blue fill, fitted to the lift shaft','medium'); sp['note']='outline from the brochure colour fill (76 px/m); CAD floor hidden by fixtures'; back+=1
    else:
        # bath + WC or several blue rooms: union bbox of the blue regions
        x0=min(r['bbox'][0][0] for r in blues); y0=min(r['bbox'][0][1] for r in blues); x1=max(r['bbox'][1][0] for r in blues); y1=max(r['bbox'][1][1] for r in blues)
        sp['geometry']=dict(type='polygon',coords=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]); sp['areaM2']=round((x1-x0)*(y1-y0)/1e6,2)
        sp['source']=src('brochure first-floor raster, bounding box of %d blue fills'%len(blues),'medium'); sp['note']='bath and WC as one box; split REQUIRES_HUMAN_VALIDATION'; back+=1
        sp['parts']=[dict(poly=r['poly'],areaM2=r['areaM2']) for r in blues]
print("TYP toilets backfilled from raster:",back)

# ---------- 2) SIXTH template ----------
core_spaces=[copy.deepcopy(s) for s in TYP['spaces'] if s['flatPosition'] is None]
core_elems=[copy.deepcopy(e) for e in TYP['elements'] if e['subtype']!='column']+[copy.deepcopy(e) for e in TYP['elements'] if e['subtype']=='column']
def retag(objs,tpl):
    for o in objs:
        o['code']=o['code'].replace('/TYP/','/%s/'%tpl); o['id']=o['id'].replace('_typ_','_%s_'%tpl.lower())
    return objs
sx_spaces=retag(core_spaces,'SIXTH')
# rooms of 601 = position 02 rooms (minus bedroom, passage, bedroom balcony); 602 = position 03 rooms (minus bedroom and its balcony), kitchen enlarged
def copy_room(pos,name,newflat,newname=None):
    for s in TYP['spaces']:
        if s['flatPosition']==pos and s['name']==name:
            c=copy.deepcopy(s); c['flatPosition']=newflat; c['name']=newname or name
            c['code']="B1/SIXTH/F%s/%s"%(newflat,c['name'].upper().replace(' ','_').replace('/','').replace('__','_')); c['id']="spo_sixth_"+c['code'].split('/')[-1].lower()+"_"+newflat
            c['note']=((c.get('note') or '')+' | copied from typical-floor position %s (same walls on the sixth-floor plan)'%pos).strip(' |')
            return c
    raise KeyError((pos,name))
for pos,name,nf in (('02','Master bedroom','601'),('02','Living / Dining','601'),('02','Kitchen','601'),('02','Balcony (master bedroom)','601'),
                    ('03','Master bedroom','602'),('03','Living / Dining','602'),('03','Balcony (north)','602')):
    sx_spaces.append(copy_room(pos,name,nf))
for s in TYP['spaces']:
    if s['subtype']=='toilet' and s['flatPosition'] in ('02','03'):
        c=copy.deepcopy(s); nf='601' if s['flatPosition']=='02' else '602'; c['flatPosition']=nf
        c['code']="B1/SIXTH/F%s/%s"%(nf,c['name'].upper().replace(' ','_').replace('(','').replace(')','')); c['id']="spo_sixth_toilet_"+str(len(sx_spaces)); sx_spaces.append(c)
# raster-derived pieces
g=lambda pt,minA=0: find(f6,'green',pt=pt,minA=minA)
ter=find(f6,'green',minA=100); sx_spaces.append(space("B1/SIXTH/COMMON/OPEN_TERRACE","Open-to-sky terrace (north and east)",'terrace',ter['poly'],None,'medium','brochure sixth-floor raster, green fill',None,'common or private: REQUIRES_HUMAN_VALIDATION'))
t1=g((-15300,2200),10); sx_spaces.append(space("B1/SIXTH/F602/TERRACE_A","Terrace 15'3\"x9'9\"",'terrace',t1['poly'],'602','medium','brochure sixth-floor raster, green fill',"15'3\"x9'9\""))
t2=g((-12200,-1000),10); sx_spaces.append(space("B1/SIXTH/F602/TERRACE_B","Terrace 18'x10'",'terrace',t2['poly'],'602','medium','brochure sixth-floor raster, green fill',"18'x10'"))
b602=g((-19800,5600)); sx_spaces.append(space("B1/SIXTH/F602/BALCONY_MASTER","Balcony 4'6\"x11'6\"",'balcony',b602['poly'],'602','medium','brochure sixth-floor raster, green fill',"4'6\"x11'6\""))
d602=g((-5300,1750)); sx_spaces.append(space("B1/SIXTH/F602/DRY_BALCONY","Dry balcony 3'6\"x6'3\"",'balcony',d602['poly'],'602','medium','brochure sixth-floor raster, green fill',"3'6\"x6'3\""))
d601=g((750,-6800)); sx_spaces.append(space("B1/SIXTH/F601/DRY_BALCONY","Dry balcony 9'x3'",'balcony',d601['poly'],'601','medium','brochure sixth-floor raster, green fill',"9'x3'"))
sx_spaces.append(space("B1/SIXTH/F602/KITCHEN","Kitchen",'kitchen',rect(-9.0,-1.4,-5.85,3.0),'602','low','hand rectangle from brochure label position',"10'x14'3\"",'enlarged kitchen replaces the typical dining area; REQUIRES_HUMAN_VALIDATION'))
z601=[(-10.6,-6.2),(-10.6,-2.5),(2.22,-2.5),(2.22,-6.15),(-0.5,-6.15),(-0.5,-7.25),(-3.65,-7.25),(-3.65,-6.2)]
z602=[(-5.85,-1.4),(-9.0,-1.4),(-9.0,0.7),(-12.8,0.7),(-12.8,3.9),(-18.7,3.9),(-18.7,7.5),(-14.6,7.5),(-14.6,8.5),(-12.2,8.5),(-12.2,6.55),(-9.05,6.55),(-9.05,4.55),(-6.6,4.55),(-6.6,3.0),(-5.85,3.0)]
def zone(tpl,code,name,coords,flat,ftype,rera,method,conf):
    P=[[m(x),m(y)] for x,y in coords]; a=poly_area(P); rm=rera*0.092903 if rera else None
    return dict(id="zone_%s_%s"%(tpl.lower(),flat or code.split('/')[-1].lower()),code=code,kind='zone',subtype='flat' if flat else 'common',name=name,flatPosition=flat,flatType=ftype,
        geometry=dict(type='polygon',coords=P),areaM2=round(a,2),reraCarpetM2=(round(rm,2) if rm else None),areaDeltaPct=(round((a-rm)/rm*100,1) if rm else None),
        source=src(method,conf))
sx_zones=[zone('SIXTH',"B1/SIXTH/F601","Flat 601",z601,'601','2BHK',551,'hand-drawn along wall centres from the sixth-floor plan','medium'),
          zone('SIXTH',"B1/SIXTH/F602","Flat 602",z602,'602','2BHK',634,'hand-drawn along wall centres from the sixth-floor plan','medium'),
          dict(id="zone_sixth_core",code="B1/SIXTH/CORE",kind='zone',subtype='common',name='Core (same as typical floor)',flatPosition=None,geometry=None,areaM2=None,source=src('copied from TYP','high','DRAWING_CONSISTENT'))]
B['templates']['SIXTH']=dict(name="Sixth floor (floor 6): flats 601, 602, terraces",zones=sx_zones,spaces=sx_spaces,elements=retag(core_elems,'SIXTH'),openings=[],
    extractionNotes=["Core, columns, lift, stair and shafts copied from the typical floor (identical on the plan).",
        "601 rooms copied from typical position 02; 602 master bedroom, living, toilets from position 03; 602 kitchen is a hand rectangle.",
        "Terraces and balconies traced from the brochure green fill (76 px/m, fitted on the lift shaft). Unlabeled X-box east of the stair kept as the duct.",
        "No CAD exists for this floor. Heights ASSUMED."])
print("SIXTH: zones",len(sx_zones),"spaces",len(sx_spaces),"elements",len(B['templates']['SIXTH']['elements']))
for z in sx_zones:
    if z.get('reraCarpetM2'): print("  %s polygon %.1f vs RERA %.1f (%+.1f%%)"%(z['name'],z['areaM2'],z['reraCarpetM2'],z['areaDeltaPct']))

# ---------- 3) GF template ----------
gf_spaces=[]; gf_zones=[]; gf_elems=[]
shops={'01':(-17800,5700,210),'02':(-15700,2000,134),'03':(-12200,-1100,183),'04':(-10300,-4500,149)}
for k,(x,y,rera) in shops.items():
    r=find(gf,'purple',pt=(x,y))
    P=r['poly']; a=poly_area(P); rm=rera*0.092903
    gf_zones.append(dict(id="zone_gf_shop%s"%k,code="B1/GF/SHOP-%s"%k,kind='zone',subtype='shop',name='Shop %s'%k,flatPosition=None,flatType='shop',
        geometry=dict(type='polygon',coords=P),areaM2=round(a,2),reraCarpetM2=round(rm,2),areaDeltaPct=round((a-rm)/rm*100,1),
        source=src('brochure ground-floor raster, purple fill, fitted on the lift shaft (52.2 px/m)','medium')))
lob=find(gf,'grey',pt=(-500,1000)); gf_spaces.append(space("B1/GF/CORE/ENTRANCE_LOBBY","Entrance lobby",'corridor',lob['poly'],None,'medium','brochure raster grey fill'))
slab=find(gf,'white',minA=200,pt=(0,1000)); gf_spaces.append(space("B1/GF/COMMON/PARKING_FLOOR","Parking floor and driveway",'parking_area',slab['poly'],None,'medium','brochure raster white fill (large region)',None,'includes driveway, car and two-wheeler areas'))
gf_spaces.append(space("B1/GF/CORE/COMMON_TOILET","Common toilet",'toilet',rect(0.3,-2.1,2.0,-0.3),None,'low','hand rectangle from label position',None,'REQUIRES_HUMAN_VALIDATION'))
gf_spaces.append(copy.deepcopy([s for s in TYP['spaces'] if s['name']=='Lift car'][0])); gf_spaces[-1]['code']="B1/GF/CORE/LIFT_CAR"; gf_spaces[-1]['id']="spo_gf_lift_car"
# parking slots from car icon centres (windshield fills)
north=[(-13.54,'01'),(-10.79,'02'),(-6.89,'03'),(-4.16,'04'),(-1.44,'05'),(0.95,'06'),(3.96,'07'),(8.14,'08'),(11.24,'09')]
south=[(11.33,'10'),(8.14,'11'),(3.99,'12'),(0.67,'13'),(-1.95,'14'),(-4.35,'15'),(-6.97,'16')]
for x,n in north:
    gf_zones.append(dict(id="zone_gf_car%s"%n,code="B1/GF/PARK/CAR-%s"%n,kind='zone',subtype='parking_slot',name='Car slot %s'%n,flatPosition=None,geometry=dict(type='polygon',coords=rect(x-1.25,4.4,x+1.25,8.9)),areaM2=11.25,source=src('car icon centre on the brochure plan; slot 2.5 x 4.5 m assumed','low')))
for x,n in south:
    gf_zones.append(dict(id="zone_gf_car%s"%n,code="B1/GF/PARK/CAR-%s"%n,kind='zone',subtype='parking_slot',name='Car slot %s'%n,flatPosition=None,geometry=dict(type='polygon',coords=rect(x-1.25,-7.5,x+1.25,-3.0)),areaM2=11.25,source=src('car icon centre on the brochure plan; slot 2.5 x 4.5 m assumed','low')))
gf_zones.append(dict(id="zone_gf_car17",code="B1/GF/PARK/CAR-17",kind='zone',subtype='parking_slot',name='Car slot 17',flatPosition=None,geometry=dict(type='polygon',coords=rect(-12.8,-8.7,-8.2,-7.2)),areaM2=6.9,source=src('car icon on the brochure plan (east-west); slot size assumed','low')))
for code,name,r in (("TW-WEST","Two-wheeler parking (west of core)",rect(-7.0,0.2,-3.2,2.4)),("TW-EAST","Two-wheeler parking (east of core)",rect(5.4,-0.2,9.6,2.4)),("TW-NE","Additional two-wheeler parking (north-east)",rect(5.5,9.0,12.5,10.6))):
    gf_zones.append(dict(id="zone_gf_"+code.lower(),code="B1/GF/PARK/"+code,kind='zone',subtype='two_wheeler_area',name=name,flatPosition=None,geometry=dict(type='polygon',coords=r),areaM2=round(poly_area(r),2),source=src('hand rectangle from label position','low')))
plot=[(-32.2,10.9),(13.1,10.9),(13.1,-9.35),(-14.4,-9.35)]
gf_elems.append(dict(id="elm_gf_plot",code="B1/SITE/PLOT",kind='element',subtype='site_boundary',name='Plot boundary (12 m road west, 6 m road south)',geometry=dict(type='polygon',coords=[[m(x),m(y)] for x,y in plot]),areaM2=round(poly_area([[m(x),m(y)] for x,y in plot]),1),source=src('hand-traced on the brochure ground-floor plan; corners +/-0.3 m','low'),note='Gat No. 111/2/1/2, Plot 1+2; west edge is slanted'))
for code,name,x,y in (("ENTRY-W","Entry from 12 m road (north-west)",-26.5,9.3),("ENTRY-S1","Entry from 6 m road (south, west one)",-2.2,-9.35),("ENTRY-S2","Entry from 6 m road (south, east one)",7.4,-9.35)):
    gf_elems.append(dict(id="elm_gf_"+code.lower(),code="B1/GF/"+code,kind='element',subtype='entrance',name=name,geometry=dict(type='point',coords=[m(x),m(y)]),source=src('arrow position on the brochure plan','low')))
gf_elems+= [copy.deepcopy(e) for e in TYP['elements'] if e['subtype'] in ('lift','stair')]
for e in gf_elems[-2:]:
    e['code']=e['code'].replace('B1/CORE/','B1/GF/CORE/'); e['id']=e['id']+'_gf'
    if e['subtype']=='stair': e['note']='ground-floor stair assumed same footprint as the typical floor (plan shows UP at the north flight)'
gf_elems+= [copy.deepcopy(e) for e in TYP['elements'] if e['subtype']=='column']
for e in gf_elems:
    if e['subtype']=='column': e['note']='column positions taken from the typical floor; the same columns stand in the parking'
B['templates']['GF']=dict(name="Ground floor: shops, parking, entrance lobby",zones=gf_zones,spaces=gf_spaces,elements=gf_elems,openings=[],
    extractionNotes=["Shops and lobby traced from the brochure colour fills (52.2 px/m, fitted on the lift shaft).",
        "Parking slots placed from the car icons; 2.5 x 4.5 m assumed. Two-wheeler areas and entries by hand.",
        "Plot boundary by hand, +/-0.3 m. No CAD exists for this floor. Height ASSUMED 3.30 m.",
        "Common toilet is a placeholder rectangle."])
print("GF: zones",len(gf_zones),"spaces",len(gf_spaces),"elements",len(gf_elems))
for z in gf_zones:
    if z.get('reraCarpetM2'): print("  %s polygon %.1f vs RERA %.1f (%+.1f%%)"%(z['name'],z['areaM2'],z['reraCarpetM2'],z['areaDeltaPct']))
# levels: templates now exist
for L in B['levels']:
    if L['template'] in ('GF','SIXTH'): L['status']=L['status'].replace('template not extracted yet; ','')
B['drawings']+=[dict(file="Floor Plans_Laxmi-Pushp.pdf",page=4,image="ground floor raster 2513x1367",toBlcs=dict(pxPerM=52.2,originPx=[1707.0,702.0],formula="x_mm=(px-1707)/52.2*1000 ; y_mm=(702-py)/52.2*1000"),status="brochure, not to scale, fitted on lift shaft inner box"),
               dict(file="Floor Plans_Laxmi-Pushp.pdf",page=5,image="first floor raster 2439x1352",toBlcs=dict(pxPerM=76.0,originPx=[1615.5,719.5]),status="check against CAD: flat 04 outline within 40 mm in x"),
               dict(file="Floor Plans_Laxmi-Pushp.pdf",page=8,image="sixth floor raster 2443x1327",toBlcs=dict(pxPerM=76.0,originPx=[1610.4,714.6]),status="brochure, fitted on lift shaft inner box")]
B['validation']['sixthFlatAreas']=[dict(flat=z['flatPosition'],polygonM2=z['areaM2'],reraCarpetM2=z['reraCarpetM2'],deltaPct=z['areaDeltaPct']) for z in sx_zones if z.get('reraCarpetM2')]
B['validation']['shopAreas']=[dict(shop=z['name'],polygonM2=z['areaM2'],reraCarpetM2=z['reraCarpetM2'],deltaPct=z['areaDeltaPct']) for z in gf_zones if z.get('reraCarpetM2')]
b['schemaVersion']="0.2"; b['generatedAt']=datetime.date.today().isoformat()
json.dump(b,open(OUT,"w"),indent=1); print("wrote",OUT)

# ---------- overlays ----------
def overlay(tpl,fname,XA,XB,YA,YB):
    T=B['templates'][tpl]; PX=45; W=int((XB-XA)*PX); H=int((YB-YA)*PX)
    im=Image.new('RGB',(W,H),(255,255,255)); d=ImageDraw.Draw(im)
    def P(x,y): return ((x/1000-XA)*PX,(YB-y/1000)*PX)
    for mx in range(int(XA),int(XB)+1):
        x=P(mx*1000,0)[0]; d.line([(x,0),(x,H)],fill=(235,235,235)); d.text((x+2,2),str(mx),fill=(150,150,150))
    for my in range(int(YA),int(YB)+1):
        y=P(0,my*1000)[1]; d.line([(0,y),(W,y)],fill=(235,235,235)); d.text((2,y+2),str(my),fill=(150,150,150))
    fill={'living':(255,235,200),'kitchen':(255,250,180),'bedroom':(220,230,255),'toilet':(210,240,240),'balcony':(220,255,220),'terrace':(200,240,200),'passage':(240,240,240),
          'corridor':(245,235,255),'shaft':(230,230,230),'lift':(200,200,255),'stair':(255,220,220),'parking_area':(248,248,248)}
    for s in T['spaces']:
        pts=[P(x,y) for x,y in s['geometry']['coords']]; d.polygon(pts,fill=fill.get(s['subtype'],(240,240,240)),outline=(120,120,120))
        cx=sum(p[0] for p in pts)/len(pts); cy=sum(p[1] for p in pts)/len(pts); d.text((cx-20,cy-5),(s['flatPosition'] or 'C')+' '+s['name'][:18],fill=(0,0,0))
    zc={'flat':(0,0,200),'shop':(160,0,160),'parking_slot':(0,120,0),'two_wheeler_area':(0,140,140)}
    for z in T['zones']:
        if not z['geometry']: continue
        pts=[P(x,y) for x,y in z['geometry']['coords']]; d.line(pts+[pts[0]],fill=zc.get(z['subtype'],(200,0,0)),width=2)
        d.text((pts[0][0]+4,pts[0][1]+4),z['name'],fill=zc.get(z['subtype'],(200,0,0)))
    for e in T['elements']:
        g=e['geometry']
        if e['subtype']=='column': pts=[P(x,y) for x,y in g['coords']]; d.polygon(pts,fill=(200,0,200))
        elif e['subtype']=='site_boundary': pts=[P(x,y) for x,y in g['coords']]; d.line(pts+[pts[0]],fill=(0,0,0),width=3)
        elif e['subtype']=='entrance': x,y=P(*g['coords']); d.ellipse([x-6,y-6,x+6,y+6],fill=(255,0,0)); d.text((x+8,y-6),e['name'][:12],fill=(255,0,0))
        elif e['subtype'] in ('lift','stair'): pts=[P(x,y) for x,y in g['coords']]; d.line(pts+[pts[0]],fill=(0,0,200) if e['subtype']=='lift' else (200,0,0),width=2)
    d.text((10,H-16),"Laxmi-Pushp %s v0.1 | metres | origin = lift shaft SW corner"%T['name'],fill=(0,0,0))
    im.save("/Volumes/works-space/movo/docs/spatial/"+fname); print("overlay",fname,im.size)
overlay('SIXTH',"sixth-floor-v0.png",-21.5,11.5,-8.5,10.0)
overlay('GF',"ground-floor-v0.png",-33.0,14.0,-10.5,12.0)
