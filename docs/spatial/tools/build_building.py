"""Assemble building.json v0 (typical floor template) from extracted regions, columns and openings.
Run after svgplan.py, columns.py, mask3.py. Writes docs/spatial/laxmi-pushp.building.json and an overlay PNG."""
import json, sys, os, datetime
import numpy as np
from PIL import Image, ImageDraw
S="/private/tmp/claude-501/-Volumes-works-space-movo/7376b897-dd79-4404-9121-d7b8a17d4b18/scratchpad"
sys.path.insert(0,S+"/tools")
import trace
OUT_DIR="/Volumes/works-space/movo/docs/spatial"
os.makedirs(OUT_DIR,exist_ok=True)
meta=json.load(open(S+"/regions.json")); MM=meta['MM']; X0=meta['X0']; Y1=meta['Y1']
regions={r['id']:r for r in meta['regions']}
lab=np.load(S+"/labels.npy")
columns=json.load(open(S+"/columns.json"))
openings=[o for o in json.load(open(S+"/openings.json")) if 600<=o["widthMm"]<=2400 and 80<=o["wallThickMm"]<=350]

def m(v): return int(round(v*1000))
def poly_area(P):
    return abs(0.5*sum(P[i][0]*P[(i+1)%len(P)][1]-P[(i+1)%len(P)][0]*P[i][1] for i in range(len(P))))/1e6
KEEP=set(regions.keys())
def ids_at(seeds):
    out=[]
    for x,y in seeds:
        r=int((Y1-y)/MM); c=int((x-X0)/MM); found=None
        for rad in range(0,15):
            win=lab[max(0,r-rad):r+rad+1,max(0,c-rad):c+rad+1]
            vals=[int(v) for v in np.unique(win) if int(v) in KEEP]
            if vals:
                # most frequent kept label in the window
                found=max(vals,key=lambda v:(win==v).sum()); break
        if found and found not in out: out.append(found)
    return out
def region_mask(seeds,cut=None):
    mk=np.zeros(lab.shape,dtype=bool)
    for i in ids_at(seeds): mk|=(lab==i)
    if cut:
        axis,val,side=cut          # ('x', mm, 'lt'|'gt')
        if axis=='x':
            col=int((val-X0)/MM); sel=np.zeros_like(mk);
            if side=='lt': sel[:,:col]=True
            else: sel[:,col:]=True
        else:
            row=int((Y1-val)/MM); sel=np.zeros_like(mk)
            if side=='gt': sel[:row,:]=True
            else: sel[row:,:]=True
        mk&=sel
    return mk

# ---------------- rooms (regions -> semantic) ----------------
# confidence: high = CAD label or unambiguous; medium = by position vs brochure; low = fragment/placeholder
ROOMS=[
 # flat 04
 dict(flat='04',name='Living room',subtype='living',seeds=[[-7200, 6500]],labelFt="11'x12'9\"",conf='high'),
 dict(flat='04',name='Kitchen',subtype='kitchen',seeds=[[-3900, 6000], [-3000, 6000]],labelFt="9'x9'6\"",conf='high',note='platform strip (hatched) excluded from floor polygon'),
 dict(flat='04',name='Bedroom',subtype='bedroom',seeds=[[600, 6500]],labelFt="11'x12'9\"",conf='high'),
 dict(flat='04',name='Toilet',subtype='toilet',seeds=[],bbox=[-2550,5550,-1300,8350],labelFt="4'x7'6\"",conf='low',note='placeholder rectangle; fixtures and dimension text hide the floor; REQUIRES_HUMAN_VALIDATION'),
 # flat 05
 dict(flat='05',name='Living room',subtype='living',seeds=[[3300, 6000], [4500, 6000], [2450, 6000], [3000, 6000]],labelFt="11'x11'",conf='high'),
 dict(flat='05',name='Kitchen',subtype='kitchen',seeds=[[6900, 1900], [8400, 1900], [6900, 3000], [8400, 3000], [7000, 2500]],labelFt="10'x10'",conf='high',note='platform strip excluded'),
 dict(flat='05',name='Bedroom',subtype='bedroom',seeds=[[7800, 6300], [6300, 6800], [6800, 4500], [6300, 4700]],labelFt="10'x11'3\" + wardrobe 6'9\"x3'3\"",conf='high'),
 dict(flat='05',name='Balcony',subtype='balcony',seeds=[[4200, 8000]],labelFt="11'x3'",conf='medium'),
 dict(flat='05',name='Foyer',subtype='passage',seeds=[[1800, 3900], [1800, 3250], [4000, 4000], [3000, 4000]],labelFt=None,conf='medium',note='entrance passage north of the stair'),
 dict(flat='05',name='Toilet passage',subtype='passage',seeds=[[4200, 2200]],labelFt=None,conf='medium'),
 dict(flat='05',name='Bath + WC',subtype='toilet',seeds=[],bbox=[4700,1300,5800,3150],labelFt="4'x6'9\" + 3'x4'",conf='low',note='placeholder; REQUIRES_HUMAN_VALIDATION'),
 # flat 01
 dict(flat='01',name='Living room',subtype='living',seeds=[[4000, -4500]],labelFt="11'x11'3\"",conf='high'),
 dict(flat='01',name='Kitchen',subtype='kitchen',seeds=[[7400, -500], [7400, 200]],labelFt="10'x10'",conf='high',note='platform strip excluded'),
 dict(flat='01',name='Bedroom',subtype='bedroom',seeds=[[7800, -5000], [6300, -5400], [6300, -3300]],labelFt="10'x11'3\" + wardrobe 6'9\"x3'3\"",conf='high'),
 dict(flat='01',name='Balcony',subtype='balcony',seeds=[[4200, -6700]],labelFt="11'x3'",conf='medium'),
 dict(flat='01',name='Foyer',subtype='passage',seeds=[[2300, -1650], [2300, -2150]],labelFt=None,conf='medium',note='entrance passage south of the stair'),
 dict(flat='01',name='Toilet passage',subtype='passage',seeds=[[4400, -1300]],labelFt=None,conf='low'),
 dict(flat='01',name='Bath + WC',subtype='toilet',seeds=[],bbox=[4700,-1200,5800,0],labelFt="4'x6'9\" + 3'x4'",conf='low',note='placeholder; REQUIRES_HUMAN_VALIDATION'),
 # flat 02
 dict(flat='02',name='Kitchen',subtype='kitchen',seeds=[[1500, -4500], [400, -4500], [0, -4500]],labelFt="9'x11'3\"",conf='high',note='platform strip excluded'),
 dict(flat='02',name='Living / Dining',subtype='living',seeds=[[-2200, -4000], [-2200, -6300]],labelFt="11'x14'6\"",conf='high'),
 dict(flat='02',name='Master bedroom',subtype='bedroom',seeds=[[-8700, -4400]],labelFt="11'9\"x11'3\"",conf='high'),
 dict(flat='02',name='Bedroom',subtype='bedroom',seeds=[[-11000, -1000], [-12000, -1500]],cut=('x',-9060,'lt'),labelFt="13'3\"x10'",conf='medium',note='region cut at x=-9.06 m; east part is the passage'),
 dict(flat='02',name='Passage',subtype='passage',seeds=[[-7500, -1800], [-6200, -1800]],cut=('x',-9060,'gt'),labelFt=None,conf='low',note='runs south of the 03 kitchen to the living room; REQUIRES_HUMAN_VALIDATION'),
 dict(flat='02',name='Toilet',subtype='toilet',seeds=[[-6000, -3050], [-4200, -3100]],bbox=[-6900,-3900,-3600,-2700],labelFt="4'x11'3\"",conf='low',note='fragments; nominal rectangle used if no region'),
 dict(flat='02',name='Toilet',subtype='toilet',seeds=[],bbox=[-5000,-6000,-3700,-3900],labelFt="4'x8'",conf='low',note='placeholder; REQUIRES_HUMAN_VALIDATION'),
 dict(flat='02',name='Balcony (bedroom)',subtype='balcony',seeds=[[-14100, 0], [-14100, -1600]],labelFt="4'6\"x10'",conf='medium'),
 dict(flat='02',name='Balcony (master bedroom)',subtype='balcony',seeds=[[-11300, -3300], [-11300, -5100]],labelFt="4'6\"x11'",conf='medium'),
 # flat 03
 dict(flat='03',name='Master bedroom',subtype='bedroom',seeds=[[-16900, 5800]],labelFt="13'6\"x11'6\"",conf='high'),
 dict(flat='03',name='Bedroom',subtype='bedroom',seeds=[[-14600, 3200], [-14600, 1600], [-13000, 3200], [-13000, 1600]],labelFt="10'9\"x10'",conf='medium',note='includes wardrobe strip'),
 dict(flat='03',name='Living / Dining',subtype='living',seeds=[[-11200, 3300], [-11200, 1300]],labelFt="11'x13'",conf='high'),
 dict(flat='03',name='Kitchen',subtype='kitchen',seeds=[[-7700, 200], [-7700, 1000], [-7900, 1360]],labelFt="10'x10'3\"",conf='high',note='CAD KITCHEN label inside; platform strip excluded'),
 dict(flat='03',name='Balcony (north)',subtype='balcony',seeds=[[-10800, 7100]],labelFt="8'3\"x5'",conf='medium',note='recessed balcony at the north-east corner of flat 03'),
 dict(flat='03',name='Room (unlabeled)',subtype='unknown',seeds=[[-10800, 5800], [-9450, 5800]],labelFt=None,conf='low',note='space between living/dining and the north balcony; name REQUIRES_HUMAN_VALIDATION'),
 dict(flat='03',name='Balcony (bedroom)',subtype='balcony',seeds=[[-16800, 3150], [-16800, 1600]],labelFt="4'6\"x9'9\"",conf='medium'),
 dict(flat='03',name='Toilet (east)',subtype='toilet',seeds=[[-12850, 6500]],bbox=[-13500,5600,-12200,8200],labelFt="4'x8'",conf='low',note='partial region'),
 dict(flat='03',name='Toilet (west)',subtype='toilet',seeds=[],bbox=[-14700,5600,-13600,8200],labelFt="4'x8'6\"",conf='low',note='placeholder; REQUIRES_HUMAN_VALIDATION'),
 # core / common
 dict(flat=None,name='Lobby',subtype='corridor',seeds=[[-1700, 1900], [-4000, 3700]],labelFt="4'3\" leg + 6'+ leg",conf='high'),
 dict(flat=None,name='Ventilation shaft',subtype='shaft',seeds=[[-3100, 200]],labelFt="8'x17'3\"",conf='high'),
 dict(flat=None,name='Small shaft',subtype='shaft',seeds=[[-5200, -800]],labelFt="3'6\"x10'6\"",conf='high'),
 dict(flat=None,name='Duct',subtype='shaft',seeds=[[4500, 550]],labelFt="4'x7'",conf='medium'),
 dict(flat=None,name='Lift car',subtype='lift',seeds=[[1100, 950]],labelFt="1.85x1.60 m",conf='high'),
 dict(flat=None,name='Stair landing NE',subtype='stair',seeds=[[2750, 2500]],labelFt=None,conf='medium'),
 dict(flat=None,name='Stair landing SE',subtype='stair',seeds=[[2750, -600]],labelFt=None,conf='medium'),
]
# ---------------- flat outlines (hand-drawn along wall centres, metres) ----------------
FLATS={
 '04':dict(type='1BHK',reraCarpetSqft=447,poly=[(-9.05,4.5),(2.18,4.5),(2.18,8.5),(-9.05,8.5)]),
 '05':dict(type='1BHK',reraCarpetSqft=463,poly=[(0.9,3.25),(0.9,4.5),(2.18,4.5),(2.18,7.5),(5.65,7.5),(5.65,8.5),(8.95,8.5),(8.95,0.95),(5.65,0.95),(5.65,1.15),(3.42,1.15),(3.42,3.25)]),
 '01':dict(type='1BHK',reraCarpetSqft=471,poly=[(0.9,-2.55),(0.9,-1.23),(3.42,-1.23),(3.42,0.0),(5.65,0.0),(5.65,0.95),(8.95,0.95),(8.95,-7.25),(5.65,-7.25),(5.65,-6.15),(2.22,-6.15),(2.22,-2.55)]),
 '02':dict(type='2BHK',reraCarpetSqft=685,poly=[(-13.2,0.7),(-9.0,0.7),(-9.0,-1.0),(-5.85,-1.0),(-5.85,-2.5),(2.22,-2.5),(2.22,-6.15),(-0.5,-6.15),(-0.5,-7.25),(-3.65,-7.25),(-3.65,-6.2),(-10.6,-6.2),(-10.6,-2.6),(-13.2,-2.6)]),
 '03':dict(type='2BHK',reraCarpetSqft=692,poly=[(-5.85,-1.0),(-9.0,-1.0),(-9.0,0.7),(-16.1,0.7),(-16.1,3.9),(-18.7,3.9),(-18.7,7.5),(-14.6,7.5),(-14.6,8.5),(-12.2,8.5),(-12.2,6.55),(-9.05,6.55),(-9.05,4.55),(-6.6,4.55),(-6.6,3.0),(-5.85,3.0)]),
}
STAIR=[(0.9,-1.23),(0.9,0.0),(2.18,0.0),(2.18,1.93),(0.9,1.93),(0.9,3.15),(3.34,3.15),(3.34,-1.23)]
LIFT=dict(outer=[[0,0],[2181,0],[2181,1931],[0,1931]],inner=[[152,153],[2029,153],[2029,1778],[152,1778]],
          doorFace='west',doorOpening=dict(x=0,y0=460,y1=1480,widthMm=1020),wallMm=152)

spaces=[]; sid=0; seen_codes={}
for r in ROOMS:
    sid+=1
    code=("B1/TYP/F%s/%s"%(r['flat'],r['name'].upper().replace(' ','_').replace('/','').replace('__','_')) if r['flat'] else "B1/TYP/CORE/"+r['name'].upper().replace(' ','_'))
    if code in seen_codes:
        seen_codes[code]+=1; code=code+'_%d'%seen_codes[code]
    else: seen_codes[code]=1
    o=None
    if r['seeds']:
        mk=region_mask(r['seeds'],r.get('cut'))
        o=trace.outline(mk,grow_px=2) if mk.any() else None
    if o:
        geom=dict(type='polygon',coords=o['coords']); area=o['areaM2']
        method='raster-trace'
    elif r.get('bbox'):
        pass
    else:
        print("  !! no region found for",r['flat'],r['name'],"-> skipped"); continue
    if not o:
        bb=r['bbox']; geom=dict(type='polygon',coords=[[bb[0],bb[1]],[bb[2],bb[1]],[bb[2],bb[3]],[bb[0],bb[3]]]); area=round((bb[2]-bb[0])*(bb[3]-bb[1])/1e6,2); method='placeholder'
    spaces.append(dict(id="spo_typ_%03d"%sid,code=code,kind='space',subtype=r['subtype'],name=r['name'],flatPosition=r['flat'],
        geometry=geom,areaM2=area,dimensions=dict(labelFt=r['labelFt']),
        source=dict(drawing='24_Typical Floor Plumbing Layout-For Review.pdf',method=method,seeds=r['seeds'],confidence=r['conf'],
                    validation='REQUIRES_HUMAN_VALIDATION' if r['conf']!='high' else 'DRAWING_CONSISTENT'),
        note=r.get('note')))

zones=[]
for pos,f in FLATS.items():
    P=[[m(x),m(y)] for x,y in f['poly']]; a=poly_area(P); rera=f['reraCarpetSqft']*0.092903
    zones.append(dict(id="zone_typ_F%s"%pos,code="B1/TYP/F%s"%pos,kind='zone',subtype='flat',name='Flat position %s'%pos,flatPosition=pos,flatType=f['type'],
        geometry=dict(type='polygon',coords=P),areaM2=round(a,2),reraCarpetM2=round(rera,2),areaDeltaPct=round((a-rera)/rera*100,1),
        source=dict(method='hand-traced on region map, wall centres',confidence='medium',validation='REQUIRES_HUMAN_VALIDATION'),
        note='outline runs along wall centres between flats and inner face of external walls; balconies excluded (03 north balcony still inside)'))
zones.append(dict(id="zone_typ_CORE",code="B1/TYP/CORE",kind='zone',subtype='common',name='Core (lobby, lift, stair, shafts)',flatPosition=None,
        geometry=None,areaM2=None,source=dict(method='composed of core spaces',confidence='high')))

elements=[]
for c in columns:
    elements.append(dict(id="col_"+c['code'],code="B1/COL/"+c['code'],kind='element',subtype='column',name='Column '+c['code'],
        geometry=dict(type='polygon',coords=[[c['x0'],c['y0']],[c['x1'],c['y0']],[c['x1'],c['y1']],[c['x0'],c['y1']]]),
        dimensions=dict(wMm=c['w'],hMm=c['h']),source=dict(drawing='plumbing 1:75',method='vector rectangles + green label pairing',confidence='high',validation='DRAWING_CONSISTENT')))
elements.append(dict(id="elm_lift",code="B1/CORE/LIFT",kind='element',subtype='lift',name='Lift shaft',geometry=dict(type='polygon',coords=LIFT['outer']),
    inner=LIFT['inner'],wallMm=LIFT['wallMm'],door=dict(face='west',x=0,y0=460,y1=1480,widthMm=1020,centre=[0,970]),
    dimensions=dict(innerM=[1.877,1.625],statedM=[1.85,1.60]),source=dict(drawing='plumbing 1:75',method='vector lines',confidence='high',validation='DRAWING_CONSISTENT')))
elements.append(dict(id="elm_stair",code="B1/CORE/STAIR",kind='element',subtype='stair',name='Staircase (U around lift: N flight, E flight, S flight)',
    geometry=dict(type='polygon',coords=[[m(x),m(y)] for x,y in STAIR]),flightWidthM=1.2,
    source=dict(drawing='plumbing 1:75',method='hand-traced from drawing crop',confidence='medium',validation='REQUIRES_HUMAN_VALIDATION'),
    note='UP arrow on the north flight points east; DN on the south flight; landings at NE and SE corners'))

border_ids=set(int(v) for v in np.unique(np.concatenate([lab[0,:],lab[-1,:],lab[:,0],lab[:,-1]])))
def side_kind(x,y):
    r=int((Y1-y)/MM); c=int((x-X0)/MM)
    if not (0<=r<lab.shape[0] and 0<=c<lab.shape[1]): return 'outside'
    v=int(lab[r,c])
    if v==0: return 'wall'
    if v in border_ids: return 'outside'
    if v in regions: return 'indoor'
    return 'small'
def classify(o):
    if o['wall']=='EW':
        xc=(o['x0']+o['x1'])/2; a=side_kind(xc,o['y0']-150); b_=side_kind(xc,o['y1']+150)
    else:
        yc=(o['y0']+o['y1'])/2; a=side_kind(o['x0']-150,yc); b_=side_kind(o['x1']+150,yc)
    s={a,b_}
    if s=={'indoor'}: return 'door'
    if 'indoor' in s and 'outside' in s: return 'window'
    return 'unknown'
opens=[]
for i,o in enumerate(openings):
    opens.append(dict(id="opn_%03d"%(i+1),kind='opening',subtype=classify(o),wallDirection=o['wall'],
        geometry=dict(type='box',coords=[[o['x0'],o['y0']],[o['x1'],o['y1']]]),widthMm=o['widthMm'],wallThickMm=o['wallThickMm'],
        source=dict(method='auto: filled wall gaps 0.6-2.4 m; door=indoor both sides, window=indoor+outside',confidence='low',validation='REQUIRES_HUMAN_VALIDATION')))

building=dict(
 schemaVersion="0.1",
 generatedAt=datetime.date.today().isoformat(),
 building=dict(code="B1",name="Laxmi-Pushp",society="Laxmi-Pushp Apartment, Swapna-Nagari, Vishrambaug, Sangli 416416",
  frame=dict(units="mm",originDescription="outer south-west corner of the lift shaft wall, ground-floor finished floor level",
   axes=dict(x="plan east",y="plan north",z="up"),
   world=dict(lat=16.837104,lon=74.596603,altM=None,headingDeg=0,status="lat/lon from Google Maps pin; headingDeg ASSUMED; altM OPEN")),
  levels=[
   dict(id="L0",index=0,name="Ground",elevationMm=0,heightMm=3300,template="GF",status="template not extracted yet; heights ASSUMED"),
   dict(id="L1",index=1,name="First",elevationMm=3300,heightMm=3000,template="TYP",variant="balcony-A",status="ASSUMED heights"),
   dict(id="L2",index=2,name="Second",elevationMm=6300,heightMm=3000,template="TYP",variant="balcony-B",status="ASSUMED heights"),
   dict(id="L3",index=3,name="Third",elevationMm=9300,heightMm=3000,template="TYP",variant="balcony-C",status="ASSUMED heights"),
   dict(id="L4",index=4,name="Fourth",elevationMm=12300,heightMm=3000,template="TYP",variant="balcony-C",status="ASSUMED heights"),
   dict(id="L5",index=5,name="Fifth",elevationMm=15300,heightMm=3000,template="TYP",variant="balcony-B",status="ASSUMED heights"),
   dict(id="L6",index=6,name="Sixth",elevationMm=18300,heightMm=3000,template="SIXTH",status="template not extracted yet; heights ASSUMED"),
   dict(id="RF",index=7,name="Roof",elevationMm=21300,heightMm=None,template=None,status="not drawn"),
  ],
  flatNumbering="floor*100 + position; positions 01..05 fixed per section 1.4 of docs/09",
  drawings=[dict(file="24_Typical Floor Plumbing Layout-For Review.pdf",scale="1:75",paper="A3 1191x842 pt",status="FOR_REVIEW R0 18/08/2022",
    toBlcs=dict(mmPerPt=26.4583,formula="x_mm = pt_x*26.4583 - 20790 ; y_mm = (842 - pt_y_from_top)*26.4583 - 12522"),
    verified="lift shaft inner 1.877x1.625 m vs stated 1.85x1.60; wall 152 mm vs 6 in")],
  templates=dict(TYP=dict(name="Typical floor (floors 1-5)",zones=zones,spaces=spaces,elements=elements,openings=opens,
    extractionNotes=[
      "Room polygons are traced from a 20 mm raster of the CAD wall lines; expect +/-40 mm on faces.",
      "Kitchen platforms and toilet floors are hatched in the CAD, so kitchens lose the platform strip and toilets are placeholders.",
      "Balconies outside the parapet lines mostly merged with the outside; only those listed are captured.",
      "Openings are auto-detected wall gaps; doors vs windows not yet classified.",
      "Which balcony variant (floor 1 / 2&5 / 3&4) this CAD floor represents is UNKNOWN.",
    ])),
  validation=dict(
    columns=dict(expected=41,found=len(columns)),
    liftInnerM=[1.877,1.625],liftStatedM=[1.85,1.60],
    flatAreas=[dict(position=z['flatPosition'],polygonM2=z['areaM2'],reraCarpetM2=z['reraCarpetM2'],deltaPct=z['areaDeltaPct']) for z in zones if z.get('reraCarpetM2')],
  ),
 ))
out=OUT_DIR+"/laxmi-pushp.building.json"
json.dump(building,open(out,"w"),indent=1)
from collections import Counter
print("wrote",out,"spaces",len(spaces),"zones",len(zones),"elements",len(elements),"openings",len(opens),Counter(o['subtype'] for o in opens))
for z in zones:
    if z.get('reraCarpetM2'): print("  flat %s polygon %.1f m2 vs RERA %.1f m2 (%+.1f%%)"%(z['flatPosition'],z['areaM2'],z['reraCarpetM2'],z['areaDeltaPct']))
for s in spaces: print("  %-32s %5.2f m2  conf=%s"%(s['code'],s['areaM2'],s['source']['confidence']))

# ---------------- overlay PNG ----------------
PX=50; XA,XB,YA,YB=-20.5,11.0,-8.5,10.0
W=int((XB-XA)*PX); H=int((YB-YA)*PX)
im=Image.new('RGB',(W,H),(255,255,255)); d=ImageDraw.Draw(im)
def P(x,y): return ((x/1000-XA)*PX,(YB-y/1000)*PX)
for mx in range(-20,12):
    x=P(mx*1000,0)[0]; d.line([(x,0),(x,H)],fill=(235,235,235)); d.text((x+2,2),str(mx),fill=(150,150,150))
for my in range(-8,11):
    y=P(0,my*1000)[1]; d.line([(0,y),(W,y)],fill=(235,235,235)); d.text((2,y+2),str(my),fill=(150,150,150))
fill={'living':(255,235,200),'kitchen':(255,250,180),'bedroom':(220,230,255),'toilet':(210,240,240),'balcony':(220,255,220),'passage':(240,240,240),
      'corridor':(245,235,255),'shaft':(230,230,230),'lift':(200,200,255),'stair':(255,220,220)}
for s in spaces:
    pts=[P(x,y) for x,y in s['geometry']['coords']]
    d.polygon(pts,fill=fill.get(s['subtype'],(240,240,240)),outline=(120,120,120))
    cx=sum(p[0] for p in pts)/len(pts); cy=sum(p[1] for p in pts)/len(pts)
    d.text((cx-20,cy-5),(s['flatPosition'] or 'C')+' '+s['name'][:14],fill=(0,0,0))
for o in opens:
    (x0,y0),(x1,y1)=o['geometry']['coords']; d.rectangle([P(x0,y1),P(x1,y0)],outline=(255,0,0))
for e in elements:
    if e['subtype']=='column':
        pts=[P(x,y) for x,y in e['geometry']['coords']]; d.polygon(pts,fill=(200,0,200)); d.text((pts[0][0],pts[0][1]-12),e['code'].split('/')[-1],fill=(160,0,160))
d.polygon([P(x,y) for x,y in LIFT['outer']],outline=(0,0,200),width=2); d.polygon([P(x,y) for x,y in LIFT['inner']],outline=(0,0,200))
d.polygon([P(m(x),m(y)) for x,y in STAIR],outline=(200,0,0),width=2)
cols={'01':(0,120,0),'02':(0,0,200),'03':(160,0,160),'04':(200,100,0),'05':(0,140,140)}
for z in zones:
    if z['geometry']:
        pts=[P(x,y) for x,y in z['geometry']['coords']]; d.line(pts+[pts[0]],fill=cols[z['flatPosition']],width=3)
        d.text((pts[0][0]+6,pts[0][1]+6),'FLAT '+z['flatPosition']+' %.1f m2'%z['areaM2'],fill=cols[z['flatPosition']])
d.text((10,H-30),"Laxmi-Pushp typical floor v0 | origin = lift shaft SW corner | metres | red boxes = auto openings | magenta = columns",fill=(0,0,0))
im.save(OUT_DIR+"/typical-floor-v0.png"); print("overlay",OUT_DIR+"/typical-floor-v0.png",im.size)
