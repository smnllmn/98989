"""Build the paste-ready files from src/.

Usage: python3 build.py

Writes two files:
  unstoppable-photos.html       for SharePoint: the app and its font, no photos (photos come from the library)
  unstoppable-photos-demo.html  the same app with the sample photos embedded, for trying it outside SharePoint
"""
import base64
import json
from pathlib import Path

here = Path(__file__).parent
src = here / "src"

JS_PARTS = [
    "config.js",
    "i18n-en.js", "i18n-nl.js", "i18n-fr.js",
    "app-core.js", "app-swipe.js", "app-results.js", "app-manage.js", "app-chrome.js", "app-boot.js",
]


def read(name):
    return (src / name).read_text(encoding="utf-8")


def font_face():
    data = base64.b64encode((src / "fonts" / "montserrat-latin-wght-normal.woff2").read_bytes()).decode("ascii")
    return (
        "/* Montserrat (SIL Open Font License 1.1, see fonts/Montserrat-OFL.txt), Latin subset, variable weight */\n"
        "@font-face { font-family: \"PS Montserrat\"; font-style: normal; font-weight: 100 900; font-display: swap;\n"
        f"  src: url(data:font/woff2;base64,{data}) format(\"woff2\");\n"
        "  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329,"
        " U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }"
    )


def rebel_logo():
    data = base64.b64encode((src / "brand" / "rebel-logo.png").read_bytes()).decode("ascii")
    return "data:image/png;base64," + data


def belfius_logo():
    data = base64.b64encode((src / "brand" / "belfius-logo.png").read_bytes()).decode("ascii")
    return "data:image/png;base64," + data


def demo_photos():
    photos = json.loads(read("photos.json"))
    for p in photos:
        data = (src / "photos" / p["file"]).read_bytes()
        p["src"] = "data:image/jpeg;base64," + base64.b64encode(data).decode("ascii")
    return (
        "<script>\nwindow.PS_DEMO_PHOTOS = "
        + json.dumps(photos, ensure_ascii=False, separators=(",", ":"))
        + ";\n</script>\n"
    )


def page(extra_head=""):
    css = read("styles.css").replace("/*FONT-FACE*/", font_face()).replace("__REBEL_LOGO__", rebel_logo()).replace("__BELFIUS_LOGO__", belfius_logo()) + "\n" + read("styles-sheets.css")
    parts = [read(JS_PARTS[0]), "  var I18N = {};"] + [read(name) for name in JS_PARTS[1:]]
    js = "\n\n".join(p.rstrip() for p in parts)
    return (
        "<title>Unstoppable Photos</title>\n"
        "<style>\n" + css + "</style>\n\n"
        + read("markup.html") + "\n"
        + extra_head
        + "<script>\n(function () {\n  'use strict';\n\n" + js.rstrip() + "\n})();\n</script>\n"
    )


for name, html in (("unstoppable-photos.html", page()), ("unstoppable-photos-demo.html", page(demo_photos()))):
    out = here / name
    out.write_text(html, encoding="utf-8")
    print(f"wrote {name} ({out.stat().st_size // 1024} KB)")
