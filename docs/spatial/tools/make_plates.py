"""Landmark plates for AR localization (Phase 3).
Makes 12 plates: a reference PNG (what the phone matches), an A4 print PDF at true size, and plates.json with the planned
pose of each plate in BLCS (mm). Also writes the app-side registry apps/mobile/src/features/ar/plates.generated.ts (base64 images).
Run from the repo root: python3 docs/spatial/tools/make_plates.py"""
import json, os, random, base64, io, math
from PIL import Image, ImageDraw, ImageFont
ROOT="/Volumes/works-space/movo"
OUT=ROOT+"/docs/spatial/plates"; os.makedirs(OUT,exist_ok=True)
APP_TS=ROOT+"/apps/mobile/src/features/ar/plates.generated.ts"
b=json.load(open(ROOT+"/docs/spatial/laxmi-pushp.building.json"))
cols={e['code'].split('/')[-1]:e['geometry']['coords'] for e in b['building']['templates']['TYP']['elements'] if e['subtype']=='column'}
ELEV={L['id']:L['elevationMm'] for L in b['building']['levels']}
PLATE_HEIGHT=1400   # centre above the finished floor of its own level
def col_face(code,side):
    P=cols[code]; xs=[p[0] for p in P]; ys=[p[1] for p in P]; cx=(min(xs)+max(xs))/2; cy=(min(ys)+max(ys))/2
    if side=='S': return [cx,min(ys),1400],[0,-1,0]
    if side=='N': return [cx,max(ys),1400],[0,1,0]
    if side=='E': return [max(xs),cy,1400],[1,0,0]
    return [min(xs),cy,1400],[-1,0,0]
PLATES=[]
for n in range(1,7):
    PLATES.append(dict(id="LP-L%d-LIFT"%n,levelId="L%d"%n,label=str(n),title="FLOOR %d"%n,where="Lift landing floor %d: on the ventilation-shaft wall facing the lift door"%n,
        position=[-1883,970,1400],normal=[1,0,0],conf="medium"))
PLATES.append(dict(id="LP-L0-LOBBY",levelId="L0",label="G",title="GROUND",where="Entrance lobby: wall facing the lift door",position=[-1250,970,1400],normal=[1,0,0],conf="low"))
p,nrm=col_face('C13','S'); PLATES.append(dict(id="LP-L0-C13",levelId="L0",label="P",title="PARKING N",where="Parking, column C13, face towards the core (south)",position=[int(p[0]),int(p[1]),1400],normal=nrm,conf="medium"))
p,nrm=col_face('C25','N'); PLATES.append(dict(id="LP-L0-C25",levelId="L0",label="P",title="PARKING S",where="Parking, column C25, face towards the core (north)",position=[int(p[0]),int(p[1]),1400],normal=nrm,conf="medium"))
PLATES.append(dict(id="LP-L6-TERRACE",levelId="L6",label="6",title="TERRACE",where="Sixth floor: lobby wall beside the door to the north terrace",position=[-3000,4400,1400],normal=[0,-1,0],conf="low"))
PLATES.append(dict(id="LP-L0-GATE",levelId="L0",label="G",title="GATE",where="South gate (west one): pillar face towards the plot",position=[-2200,-9200,1400],normal=[0,1,0],conf="low"))
PLATES.append(dict(id="LP-L1-F102-BED-TEST",levelId="L1",label="102",title="TEST 102",where="Desk test only: monitor against the south wall of the second bedroom of flat 102, screen centre 1.1 m up, facing north into the room",position=[-11080,-2420,1100],normal=[0,1,0],conf="low"))
PLATES.append(dict(id="LP-L2-F201-LIV-TEST",levelId="L2",label="201",title="TEST 201",where="Desk test only: laptop in the living room of flat 201, near the south (balcony) wall, screen facing north, screen centre 0.46 m above the floor",position=[4000,-5800,457],normal=[0,1,0],conf="low"))
PLATES.append(dict(id="LP-RF-TANK",levelId="RF",label="R",title="ROOF TANK",where="Roof, near the overhead tank: position UNKNOWN until a photo or visit",position=None,normal=None,conf="none"))
W,H=480,680; PHYS_W_M=0.190
def font(size):
    for f in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf","/System/Library/Fonts/Supplemental/Arial.ttf","/System/Library/Fonts/Helvetica.ttc","/Library/Fonts/Arial Bold.ttf"):
        if os.path.exists(f):
            try: return ImageFont.truetype(f,size)
            except Exception: pass
    return ImageFont.load_default()
def make_plate(pl,seed):
    """Unique feature field per plate. Shared elements are kept small so plates do not match each other."""
    im=Image.new('L',(W,H),255); d=ImageDraw.Draw(im); rnd=random.Random(seed)
    d.rectangle([0,0,W-1,H-1],outline=0,width=14)
    # big floor glyph, position and style vary per plate
    gx=rnd.choice([120,240,360]); gy=rnd.choice([120,160])
    d.text((gx,gy),pl['label'],fill=0,font=font(rnd.choice([120,140,160])),anchor="mm")
    # unique macro structure: 3-5 large black blocks with white cut-outs
    for _ in range(rnd.randint(3,5)):
        x=rnd.randint(40,W-140); y=rnd.randint(40,H-160); w=rnd.randint(60,150); h=rnd.randint(60,150)
        d.rectangle([x,y,x+w,y+h],fill=0)
        for _ in range(rnd.randint(2,5)):
            cx=rnd.randint(x+8,x+w-8); cy=rnd.randint(y+8,y+h-8); r=rnd.randint(5,16)
            if rnd.random()<0.5: d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=255)
            else: d.rectangle([cx-r,cy-r,cx+r,cy+r],fill=255)
    # dense random field over the whole plate
    for _ in range(rnd.randint(70,110)):
        x=rnd.randint(30,W-30); y=rnd.randint(30,H-60); s_=rnd.randint(6,30); k=rnd.random()
        if k<0.3: d.ellipse([x-s_,y-s_,x+s_,y+s_],fill=0)
        elif k<0.55: d.rectangle([x-s_,y-s_//2,x+s_,y+s_//2],fill=0)
        elif k<0.75: d.polygon([(x,y-s_),(x+s_,y+s_),(x-s_,y+s_)],fill=0)
        elif k<0.9: d.line([(x-s_,y-s_),(x+s_,y+s_)],fill=0,width=rnd.randint(4,9))
        else: d.line([(x-s_,y+s_),(x+s_,y-s_)],fill=0,width=rnd.randint(4,9))
    for _ in range(30):
        x=rnd.randint(30,W-30); y=rnd.randint(30,H-60); r=rnd.randint(3,8); d.ellipse([x-r,y-r,x+r,y+r],fill=255)
    d.rectangle([20,H-58,W-20,H-22],fill=255)
    d.text((W//2,H-40),pl['title']+"  "+pl['id'],fill=0,font=font(20),anchor="mm")
    return im
def make_print(pl,ref):
    dpi=300; A4=(int(8.27*dpi),int(11.69*dpi)); page=Image.new('L',A4,255); d=ImageDraw.Draw(page)
    pw=int(PHYS_W_M*1000/25.4*dpi); ph=int(pw*H/W); x=(A4[0]-pw)//2; y=int(0.7*dpi)
    page.paste(ref.resize((pw,ph),Image.LANCZOS),(x,y))
    d.text((A4[0]//2,y+ph+90),"%s  |  %s"%(pl['id'],pl['where']),fill=0,font=font(40),anchor="mm")
    d.text((A4[0]//2,y+ph+160),"Print at 100 %% (no fit-to-page). Image width must be %d mm. Mount flat, centre at 1.40 m above the floor."%int(PHYS_W_M*1000),fill=0,font=font(36),anchor="mm")
    d.text((A4[0]//2,y+ph+230),"Laxmi-Pushp AR landmark plate. Do not cover or move.",fill=0,font=font(36),anchor="mm")
    return page
reg=[]; ts_entries=[]
for i,pl in enumerate(PLATES):
    ref=make_plate(pl,1000+i*7919)
    ref.save(OUT+"/%s.png"%pl['id'],optimize=True)
    make_print(pl,ref).save(OUT+"/%s.print.pdf"%pl['id'],resolution=300)
    buf=io.BytesIO(); ref.save(buf,format='PNG',optimize=True); b64=base64.b64encode(buf.getvalue()).decode()
    pos=pl['position']
    if pos is not None:
        pos=[pos[0],pos[1],ELEV.get(pl['levelId'],0)+(pos[2] if pos[2]!=1400 else PLATE_HEIGHT)]   # absolute BLCS z
    entry=dict(id=pl['id'],levelId=pl['levelId'],title=pl['title'],where=pl['where'],physicalWidthM=PHYS_W_M,imagePx=[W,H],
               position=pos,normal=pl['normal'],heightAboveFloorMm=PLATE_HEIGHT,confidence=pl['conf'],status=("POSE_TBD" if pl['position'] is None else "PLANNED_NOT_MOUNTED"),image=pl['id']+".png")
    reg.append(entry); ts_entries.append((entry,b64))
json.dump(dict(frame="BLCS mm; plate centre position; normal = unit vector out of the wall; plate X = up x normal, Y = normal, Z = down",plates=reg),open(OUT+"/plates.json","w"),indent=1)
os.makedirs(os.path.dirname(APP_TS),exist_ok=True)
with open(APP_TS,"w") as f:
    f.write("// GENERATED by docs/spatial/tools/make_plates.py. Do not edit by hand.\n")
    f.write("import type { PlateDefinition } from './spatial/types';\n\n")
    f.write("export const PLATES: PlateDefinition[] = [\n")
    for e,b64 in ts_entries:
        f.write("  %s,\n"%json.dumps(dict(id=e['id'],levelId=e['levelId'],title=e['title'],where=e['where'],physicalWidthM=e['physicalWidthM'],position=e['position'],normal=e['normal'],confidence=e['confidence'],status=e['status'],imageBase64=b64)))
    f.write("];\n")
print("plates:",len(reg),"->",OUT,"and",APP_TS, "ts size KB", os.path.getsize(APP_TS)//1024)
