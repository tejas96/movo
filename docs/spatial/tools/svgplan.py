"""Parse pdftocairo SVG of the 1:75 plumbing drawing into line segments in mm (y up)."""
import re, json, math
SVG="/private/tmp/claude-501/-Volumes-works-space-movo/7376b897-dd79-4404-9121-d7b8a17d4b18/scratchpad/plumbing.svg"
PT_PER_UNIT=0.12            # transform matrix(0.12,0,0,-0.12,0,842)
MM_PER_PT=25.4/72*75        # 1:75 on true-size A3
MM_PER_UNIT=PT_PER_UNIT*MM_PER_PT   # 3.175 mm
path_re=re.compile(r'<path([^>]*)/>')
attr_re=re.compile(r'(\S+?)="([^"]*)"')
def load():
    txt=open(SVG).read()
    segs=[]   # dict: x1,y1,x2,y2 (mm), color, width(mm), pid
    for pid,m in enumerate(path_re.finditer(txt)):
        a=dict(attr_re.findall(m.group(1)))
        if 'd' not in a: continue
        tr=a.get('transform','')
        if tr!='matrix(0.12, 0, 0, -0.12, 0, 842)':
            continue
        color=a.get('stroke','none'); fill=a.get('fill','none'); w=float(a.get('stroke-width','0'))*MM_PER_UNIT
        toks=re.findall(r'([MLCZ])\s*([-\d.\s]*)',a['d'])
        cur=None; start=None
        for cmd,nums in toks:
            v=[float(x) for x in nums.split()]
            if cmd=='M':
                cur=(v[0],v[1]); start=cur
            elif cmd=='L':
                for i in range(0,len(v),2):
                    p=(v[i],v[i+1])
                    segs.append(dict(x1=cur[0]*MM_PER_UNIT,y1=cur[1]*MM_PER_UNIT,x2=p[0]*MM_PER_UNIT,y2=p[1]*MM_PER_UNIT,color=color,fill=fill,w=w,pid=pid))
                    cur=p
            elif cmd=='C':
                # curve: keep chord only, flagged
                p=(v[-2],v[-1])
                segs.append(dict(x1=cur[0]*MM_PER_UNIT,y1=cur[1]*MM_PER_UNIT,x2=p[0]*MM_PER_UNIT,y2=p[1]*MM_PER_UNIT,color=color,fill=fill,w=w,pid=pid,curve=True))
                cur=p
            elif cmd=='Z':
                if cur and start and cur!=start:
                    segs.append(dict(x1=cur[0]*MM_PER_UNIT,y1=cur[1]*MM_PER_UNIT,x2=start[0]*MM_PER_UNIT,y2=start[1]*MM_PER_UNIT,color=color,fill=fill,w=w,pid=pid))
                cur=start
    for s in segs:
        dx=s['x2']-s['x1']; dy=s['y2']-s['y1']; s['len']=math.hypot(dx,dy)
        ang=math.degrees(math.atan2(dy,dx))%180; s['ang']=round(ang,1)
    return segs
if __name__=='__main__':
    segs=load()
    json.dump(segs,open('/private/tmp/claude-501/-Volumes-works-space-movo/7376b897-dd79-4404-9121-d7b8a17d4b18/scratchpad/segs.json','w'))
    from collections import Counter
    print("segments:",len(segs))
    c=Counter()
    for s in segs:
        kind='diag' if 40<=s['ang']<=50 or 130<=s['ang']<=140 else ('axis' if s['ang']<1 or s['ang']>179 or 89<=s['ang']<=91 else 'other')
        c[(s['color'],round(s['w'],1),s.get('curve',False),kind)]+=1
    for k,v in sorted(c.items(),key=lambda kv:-kv[1])[:30]: print(v,k)
    xs=[s['x1'] for s in segs]+[s['x2'] for s in segs]; ys=[s['y1'] for s in segs]+[s['y2'] for s in segs]
    print("extent mm x:",round(min(xs)),round(max(xs))," y:",round(min(ys)),round(max(ys)))
