"""Build contact-sheet.html: the app with every photo embedded, ready to paste.

Usage: python3 build.py
Swap photos by editing src/photos.json and dropping JPEGs in src/photos/
(portrait 3:4, about 420x560, under ~40 KB each keeps the file small).
"""
import base64
import json
from pathlib import Path

here = Path(__file__).parent
src = here / "src"

photos = json.loads((src / "photos.json").read_text(encoding="utf-8"))
for p in photos:
    data = (src / "photos" / p.pop("file")).read_bytes()
    p["src"] = "data:image/jpeg;base64," + base64.b64encode(data).decode("ascii")

script = (
    "<script>\nwindow.PS_PHOTOS = "
    + json.dumps(photos, ensure_ascii=False, separators=(",", ":"))
    + ";\nif (window.__psBoot) window.__psBoot();\n</script>\n"
)
app = (src / "app.html").read_text(encoding="utf-8")
out = here / "contact-sheet.html"
out.write_text(app.replace("<!--PHOTOS-->", script), encoding="utf-8")
print(f"wrote {out.name} ({out.stat().st_size // 1024} KB, {len(photos)} photos)")
