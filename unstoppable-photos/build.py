"""Build the paste-ready files from src/.

Usage: python3 build.py

Writes:
  unstoppable-photos.js          the app for SharePoint in one file (styles, markup, code; no photos). Upload it to
                                 SCRIPT_URL's folder; to update the app later, upload it again over the old one.
  unstoppable-photos-loader.html the short loader to paste into the page's script module. It loads the file above.
  unstoppable-photos.html        the same app as one paste-in block (works while editing a page, but too big to
                                 survive saving in the Involv Script Editor, so publish with the loader instead)
  unstoppable-photos-demo.html   the app with the sample photos embedded, for trying it outside SharePoint
"""
import base64
import json
from pathlib import Path

here = Path(__file__).parent
src = here / "src"

# Where unstoppable-photos.js lives: a folder on the intranet site every viewer of the page can read.
SCRIPT_URL = "https://belfius.sharepoint.com/sites/intranet-company/SiteAssets/SitePages/UnstoppablePhotos/unstoppable-photos.js"

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


# Official logos in src/brand/, embedded where styles.css has their token.
LOGOS = {
    "__BELFIUS_LOGO__": "belfius-logo.png",
    "__BELFIUS_PRIVATE_LOGO__": "belfius-private-white.png",
    "__REBEL_LOGO__": "rebel-logo.png",
}


def styles():
    css = read("styles.css").replace("/*FONT-FACE*/", font_face())
    for token, file in LOGOS.items():
        data = base64.b64encode((src / "brand" / file).read_bytes()).decode("ascii")
        css = css.replace(token, "data:image/png;base64," + data)
    return css + "\n" + read("styles-sheets.css")


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


def app_js():
    parts = [read(JS_PARTS[0]), "  var I18N = {};"] + [read(name) for name in JS_PARTS[1:]]
    js = "\n\n".join(p.rstrip() for p in parts)
    return "(function () {\n  'use strict';\n\n" + js.rstrip() + "\n})();\n"


def page(extra_head=""):
    return (
        "<title>Unstoppable Photos</title>\n"
        "<style>\n" + styles() + "</style>\n\n"
        + read("markup.html") + "\n"
        + extra_head
        + "<script>\n" + app_js() + "</script>\n"
    )


def ascii_only(code):
    """Escape every non-ASCII character, so the file reads the same whatever charset SharePoint serves it with."""
    out = []
    for ch in code:
        o = ord(ch)
        if o < 128:
            out.append(ch)
        elif o <= 0xFFFF:
            out.append("\\u%04x" % o)
        else:
            o -= 0x10000
            out.append("\\u%04x\\u%04x" % (0xD800 + (o >> 10), 0xDC00 + (o & 0x3FF)))
    return "".join(out)


def bundle():
    mount = (
        "/* Unstoppable Photos: styles, markup and app in one file. The page holds only the short loader from\n"
        "   unstoppable-photos-loader.html, which puts <div id=\"unstoppable-photos\"> on the page and loads this file. */\n"
        "(function () {\n"
        "  var CSS = " + json.dumps(styles()) + ";\n"
        "  var MARKUP = " + json.dumps(read("markup.html")) + ";\n"
        "  (function mount(n) {\n"
        "    var host = document.getElementById('unstoppable-photos');\n"
        "    if (!host) { if (n < 200) setTimeout(function () { mount(n + 1); }, 50); return; }\n"
        "    if (document.getElementById('ps-app')) return;\n"
        "    var style = document.createElement('style');\n"
        "    style.textContent = CSS;\n"
        "    document.head.appendChild(style);\n"
        "    host.innerHTML = MARKUP;\n"
        "  })(0);\n"
        "})();\n\n"
    )
    return ascii_only(mount + app_js())


def loader():
    return (
        "<div id=\"unstoppable-photos\"></div>\n"
        "<script>\n"
        "(function () {\n"
        "  var s = document.createElement('script');\n"
        "  s.src = '" + SCRIPT_URL + "?v=' + Date.now();\n"
        "  s.onerror = function () {\n"
        "    var host = document.getElementById('unstoppable-photos');\n"
        "    if (host) host.textContent = 'Unstoppable Photos: unstoppable-photos.js niet gevonden.';\n"
        "  };\n"
        "  document.head.appendChild(s);\n"
        "})();\n"
        "</script>\n"
    )


for name, text in (
    ("unstoppable-photos.js", bundle()),
    ("unstoppable-photos-loader.html", loader()),
    ("unstoppable-photos.html", page()),
    ("unstoppable-photos-demo.html", page(demo_photos())),
):
    out = here / name
    out.write_text(text, encoding="utf-8")
    print(f"wrote {name} ({out.stat().st_size // 1024} KB)")
