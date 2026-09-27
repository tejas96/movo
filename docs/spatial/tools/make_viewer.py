"""Inline the glb (base64), nav graph and levels into a single-file viewer: docs/spatial/viewer.html"""
import json, base64
S="/private/tmp/claude-501/-Volumes-works-space-movo/7376b897-dd79-4404-9121-d7b8a17d4b18/scratchpad"
DOC="/Volumes/works-space/movo/docs/spatial"
b=json.load(open(DOC+"/laxmi-pushp.building.json")); B=b['building']
tpl=open(S+"/tools/viewer_template.html").read()
glb=base64.b64encode(open(DOC+"/laxmi-pushp.glb","rb").read()).decode()
levels=[L for L in B['levels'] if L.get('template')]
html=tpl.replace("{{GLB_B64}}",glb).replace("{{NAV_JSON}}",json.dumps(B['nav'],separators=(',',':')).replace("</","<\\/")).replace("{{LEVELS_JSON}}",json.dumps(levels,separators=(',',':')))
open(DOC+"/viewer.html","w").write(html)
print("viewer.html",len(html)//1024,"KB; levels",[L['id'] for L in levels])
