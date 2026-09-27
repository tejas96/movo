import json, math
from collections import Counter
from PIL import Image, ImageDraw
S="/private/tmp/claude-501/-Volumes-works-space-movo/7376b897-dd79-4404-9121-d7b8a17d4b18/scratchpad"
segs=json.load(open(S+"/segs.json"))
G46='rgb(46.273804%, 46.273804%, 46.273804%)'
OX,OY=20790,12522
def bl(x,y): return (x-OX, y-OY)
# hatch angle histogram
h=[s for s in segs if s['color']==G46 and abs(s['w']-12.7)<0.5 and not (s['ang']<1.5 or s['ang']>178.5 or 88.5<=s['ang']<=91.5)]
print("hatch-like angles:",Counter(round(s['ang']) for s in h).most_common(8))
# cluster 135-degree hatch segments (crosshatch = columns / step-ups)
c135=[s for s in h if 130<=s['ang']<=140]
print("135deg segs:",len(c135))
# union-find on proximity of segment bboxes (gap<=70mm)
n=len(c135); parent=list(range(n))
def f(i):
    while parent[i]!=i: parent[i]=parent[parent[i]]; i=parent[i]
    return i
bb=[(min(s['x1'],s['x2']),min(s['y1'],s['y2']),max(s['x1'],s['x2']),max(s['y1'],s['y2'])) for s in c135]
for i in range(n):
    for j in range(i+1,n):
        a=bb[i];b=bb[j]
        if a[0]<=b[2]+70 and b[0]<=a[2]+70 and a[1]<=b[3]+70 and b[1]<=a[3]+70:
            parent[f(i)]=f(j)
groups={}
for i in range(n): groups.setdefault(f(i),[]).append(i)
cols=[]
for g in groups.values():
    xs=[bb[i][0] for i in g]+[bb[i][2] for i in g]; ys=[bb[i][1] for i in g]+[bb[i][3] for i in g]
    x0,y0,x1,y1=min(xs),min(ys),max(xs),max(ys)
    cols.append(dict(x0=x0,y0=y0,x1=x1,y1=y1,w=x1-x0,h=y1-y0,n=len(g)))
cols.sort(key=lambda c:(-c['y0'],c['x0']))
print("clusters:",len(cols))
for c in cols:
    bx,by=bl(c['x0'],c['y0']); print("bl(%6.0f,%6.0f) size %4.0f x %4.0f  n=%d"%(bx,by,c['w'],c['h'],c['n']))
json.dump(cols,open(S+"/columns_raw.json","w"))
# green label clusters
grn=[s for s in segs if s['color']=='rgb(0%, 100%, 0%)']
n=len(grn); parent=list(range(n))
bb=[(min(s['x1'],s['x2']),min(s['y1'],s['y2']),max(s['x1'],s['x2']),max(s['y1'],s['y2'])) for s in grn]
for i in range(n):
    for j in range(i+1,n):
        a=bb[i];b=bb[j]
        if a[0]<=b[2]+120 and b[0]<=a[2]+120 and a[1]<=b[3]+60 and b[1]<=a[3]+60:
            parent[f(i)]=f(j)
groups={}
for i in range(n): groups.setdefault(f(i),[]).append(i)
labels=[]
for g in groups.values():
    xs=[bb[i][0] for i in g]+[bb[i][2] for i in g]; ys=[bb[i][1] for i in g]+[bb[i][3] for i in g]
    labels.append(dict(x0=min(xs),y0=min(ys),x1=max(xs),y1=max(ys),segs=[grn[i] for i in g]))
labels.sort(key=lambda l:(-l['y0'],l['x0']))
print("green label clusters:",len(labels))
# contact sheet: each label rendered at 0.25 mm/px, index printed
cell=(140,60); cols_n=6; rows=math.ceil(len(labels)/cols_n)
sheet=Image.new('RGB',(cell[0]*cols_n,cell[1]*rows),(255,255,255)); d=ImageDraw.Draw(sheet)
for k,l in enumerate(labels):
    cx=(k%cols_n)*cell[0]; cy=(k//cols_n)*cell[1]
    d.rectangle([cx,cy,cx+cell[0]-1,cy+cell[1]-1],outline=(200,200,200)); d.text((cx+2,cy+2),str(k),fill=(255,0,0))
    sc=0.09; w=l['x1']-l['x0']; h=l['y1']-l['y0']
    for s in l['segs']:
        p1=(cx+40+(s['x1']-l['x0'])*sc, cy+cell[1]-8-(s['y1']-l['y0'])*sc); p2=(cx+40+(s['x2']-l['x0'])*sc, cy+cell[1]-8-(s['y2']-l['y0'])*sc)
        d.line([p1,p2],fill=(0,120,0),width=2)
sheet.save(S+"/labels_sheet.png")
json.dump([dict(x0=l['x0'],y0=l['y0'],x1=l['x1'],y1=l['y1']) for l in labels],open(S+"/labels_raw.json","w"))
print("sheet saved",sheet.size)
