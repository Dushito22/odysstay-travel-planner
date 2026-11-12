"""Fetches openly licensed photos of Italy from Wikimedia Commons, grades them in the Odysstay look
(muted colour, cool shadows, warm highlights, film grain, small odysstay.xyz mark) and stores them for the
Telegram channel with their credits. Run by .github/workflows/channel-art.yml (needs open internet)."""
import io, os, random, re, sys, json, time
import httpx
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

SB = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
UA = {"User-Agent": "OdysstayChannelArt/1.0 (https://odysstay.xyz; hello@odysstay.com) httpx"}
OK_LICENSE = re.compile(r"^(CC0|Public domain|PD|CC BY(?:-SA)? [0-9.]+|CC BY(?:-SA)?)", re.I)
THEMES = {
    "como": ["Lake Como Bellagio", "Lago di Como Varenna", "Villa del Balbianello"],
    "tuscany": ["Val d'Orcia cypress", "Tuscany hills Pienza", "Crete Senesi landscape"],
    "amalfi": ["Amalfi coast Positano", "Praiano coast", "Ravello view"],
    "sicily": ["Cefalù view", "Taormina view", "Sicily countryside Ragusa Ibla"],
    "puglia": ["Alberobello trulli", "Polignano a Mare", "Puglia masseria olive"],
    "village": ["Civita di Bagnoregio", "Italian hill town street", "Matera Sassi view"],
    "alps": ["Dolomites Seceda", "Alpe di Siusi", "Lago di Braies"],
    "sea": ["Cinque Terre Manarola", "Sardinia beach Cala", "Capri Faraglioni"],
    "city": ["Rome Trastevere", "Venice canal quiet", "Florence rooftops Duomo"],
    "table": ["Italian lemons Sorrento", "olive grove Italy", "Italian terrace breakfast"],
    # old tourism posters and Grand Tour paintings, public domain, for the days the photos run out
    "poster": ["ENIT Italian travel poster 1930s", "Visit Italy vintage tourism poster", "Capri vintage poster", "Italian Riviera vintage poster"],
    "vintage": ["Grand Tour painting Italian landscape Bay of Naples", "Lake Como 19th century painting", "Italian village painting 19th century"],
}
LOOSE = {"poster", "vintage"}  # portrait and older images are fine here


def search(q, loose=False):
    r = httpx.get("https://commons.wikimedia.org/w/api.php", headers=UA, timeout=40, params={
        "action": "query", "format": "json", "generator": "search", "gsrnamespace": 6, "gsrsearch": f"{q} filetype:bitmap",
        "gsrlimit": 12, "prop": "imageinfo", "iiprop": "url|size|extmetadata|mime", "iiurlwidth": 2000})
    pages = (r.json().get("query") or {}).get("pages") or {}
    out = []
    for p in pages.values():
        ii = (p.get("imageinfo") or [{}])[0]
        md = ii.get("extmetadata") or {}
        lic = (md.get("LicenseShortName") or {}).get("value", "")
        if not OK_LICENSE.match(lic) or "NC" in lic or "ND" in lic:
            continue
        if ii.get("mime") not in ("image/jpeg", "image/png") or (ii.get("width") or 0) < (1200 if loose else 2000) or (not loose and (ii.get("width") or 0) < (ii.get("height") or 0) * 1.1):
            continue
        author = re.sub(r"<[^>]+>", "", (md.get("Artist") or {}).get("value", "")).strip()[:90] or "unknown"
        out.append({"title": p["title"].removeprefix("File:"), "thumb": ii.get("thumburl") or ii["url"], "author": author, "license": lic,
                    "source": ii.get("descriptionurl") or "", "w": ii.get("width"), "h": ii.get("height")})
    return out


def font(size):
    from fontTools.ttLib import TTFont
    p = "/tmp/ped-italic.ttf"
    if not os.path.exists(p):
        f = TTFont("public/fonts/PPEditorialNew-Italic.woff2"); f.flavor = None; f.save(p)
    return ImageFont.truetype(p, size)


def grade(im: Image.Image) -> Image.Image:
    im = im.convert("RGB")
    w, h = im.size
    tw, th = 1280, 1600  # 4:5 for a phone feed
    s = max(tw / w, th / h)
    im = im.resize((int(w * s) + 1, int(h * s) + 1), Image.LANCZOS)
    l, t = (im.width - tw) // 2, (im.height - th) // 2
    im = im.crop((l, t, l + tw, t + th))
    im = ImageEnhance.Color(im).enhance(0.8)
    im = ImageEnhance.Contrast(im).enhance(1.06)
    a = np.asarray(im).astype(np.float32) / 255
    lum = a.mean(axis=2, keepdims=True)
    shadow = np.clip(1 - lum * 2, 0, 1)      # cool the shadows toward Odysstay blue
    high = np.clip(lum * 2 - 1, 0, 1)        # warm the highlights a touch
    a = a + shadow * np.array([-0.03, 0.0, 0.05]) + high * np.array([0.04, 0.02, -0.03])
    yy, xx = np.mgrid[0:th, 0:tw]
    v = 1 - 0.28 * (((xx - tw / 2) / (tw / 2)) ** 2 + ((yy - th / 2) / (th / 2)) ** 2) / 2
    a = a * v[..., None]
    a = a + np.random.default_rng(7).normal(0, 0.018, (th, tw, 1))
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    f = font(34)
    txt = "odysstay.xyz"
    bb = d.textbbox((0, 0), txt, font=f)
    d.text(((tw - (bb[2] - bb[0])) / 2, 46), txt, font=f, fill=(255, 255, 255, 235))
    return im


def have(path):
    r = httpx.get(f"{SB}/rest/v1/channel_art", headers=H, params={"select": "id", "path": f"eq.{path}"}, timeout=30)
    return bool(r.json())


def main(per_theme=3):
    os.makedirs("out", exist_ok=True)
    seen_titles = {x["title"] for x in httpx.get(f"{SB}/rest/v1/channel_art", headers=H, params={"select": "title"}, timeout=30).json()}
    done = 0
    for theme, qs in THEMES.items():
        got = 0
        for q in qs:
            if got >= per_theme:
                break
            try:
                cands = search(q, theme in LOOSE)
            except Exception as e:
                print("search failed", q, e); continue
            random.shuffle(cands)
            for c in cands:
                if got >= per_theme or c["title"] in seen_titles:
                    continue
                try:
                    raw = httpx.get(c["thumb"], headers=UA, timeout=90, follow_redirects=True)
                    raw.raise_for_status()
                    im = grade(Image.open(io.BytesIO(raw.content)))
                except Exception as e:
                    print("skip", c["title"], e); continue
                buf = io.BytesIO(); im.save(buf, "JPEG", quality=88, optimize=True)
                path = f"{theme}/{re.sub(r'[^a-z0-9]+', '-', c['title'].lower())[:60]}.jpg"
                up = httpx.post(f"{SB}/storage/v1/object/channel-art/{path}", headers={**H, "content-type": "image/jpeg", "x-upsert": "true"}, content=buf.getvalue(), timeout=90)
                if up.status_code >= 300:
                    print("upload failed", up.status_code, up.text[:200]); continue
                row = {"theme": theme, "path": path, "url": f"{SB}/storage/v1/object/public/channel-art/{path}", **{k: c[k] for k in ("title", "author", "license", "source")}}
                r = httpx.post(f"{SB}/rest/v1/channel_art", headers={**H, "content-type": "application/json", "prefer": "resolution=ignore-duplicates"}, json=row, timeout=30)
                print(theme, "|", c["title"], "|", c["author"], "|", c["license"], "|", r.status_code)
                open(f"out/{theme}-{got}.jpg", "wb").write(buf.getvalue())
                seen_titles.add(c["title"]); got += 1; done += 1
                time.sleep(1.5)
    print("photos stored:", done)


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 3)
