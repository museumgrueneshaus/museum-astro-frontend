"""QR-Codes für den Weinhart-Audioguide.

    python3 scripts/weinhart/qr.py https://<öffentliche-adresse>

Erzeugt qr/weinhart-NN.svg (Druck) und .png (Vorschau) für Einführung und
Stationen sowie qr/stationsschilder.typ + .pdf (A6 quer, ein Schild pro Station).
Ziel je Code: <basis>/audioguide/?a=weinhart&s=weinhart-NN
"""
import json
import subprocess
import sys
from pathlib import Path

import qrcode
import qrcode.image.svg

DIR = Path(__file__).resolve().parent
OUT = DIR / "qr"

if len(sys.argv) != 2 or not sys.argv[1].startswith("https://"):
    sys.exit("Aufruf: qr.py https://<öffentliche-adresse>")
basis = sys.argv[1].rstrip("/")

d = json.loads((DIR / "daten.json").read_text(encoding="utf-8"))
slug = d["ausstellung"]["slug"]
eintraege = [{"nr": "00", "titel": "Einführung"}] + d["stationen"]
OUT.mkdir(exist_ok=True)

for e in eintraege:
    code = f"{slug}-{e['nr']}"
    url = f"{basis}/audioguide/?a={slug}&s={code}"
    e["url"] = url
    # Fehlerkorrektur M: robust gegen Kratzer, Code bleibt grob genug für ältere Handys.
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0)
    qr.add_data(url)
    qr.make(fit=True)
    qr.make_image(image_factory=qrcode.image.svg.SvgPathImage).save(OUT / f"{code}.svg")
    qr.make_image(fill_color="#12110f", back_color="white").get_image().resize((600, 600), 0).save(OUT / f"{code}.png")
    print(f"{code}  {url}")

def esc(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')

schilder = "\n".join(
    f'#schild("{e["nr"]}", "{esc(e["titel"])}", "{slug}-{e["nr"]}.svg", "{esc(e["url"])}")'
    for e in eintraege
)
(OUT / "stationsschilder.typ").write_text(f"""// Erzeugt von qr.py. Ein Schild pro Seite, A6 quer, für Tischaufsteller.
#set page(width: 148mm, height: 105mm, margin: 10mm)
#set text(font: ("Fraunces", "Georgia"), size: 11pt, lang: "de")
#let schild(nr, titel, datei, url) = {{
  align(horizon, grid(columns: (1fr, 62mm), gutter: 8mm,
    align(horizon)[
      #text(size: 8pt, tracking: 0.18em, fill: rgb("#8a6a40"), font: "Inter", weight: 600)[#upper[{esc(d["ausstellung"]["titel"])}]]
      #v(3mm)
      #text(size: 13pt, fill: rgb("#8a6a40"))[#nr]
      #v(-1mm)
      #text(size: 24pt, weight: 300)[#titel]
      #v(6mm)
      #text(size: 9pt, font: "Inter")[Audioguide · Audio guide · Audiotour · Audioguida]
      #v(1mm)
      #text(size: 7pt, font: "Inter", fill: luma(110))[DE · EN · NL · IT]
    ],
    align(horizon, image(datei, width: 62mm)),
  ))
  pagebreak(weak: true)
}}
{schilder}
""", encoding="utf-8")
subprocess.run(["typst", "compile", str(OUT / "stationsschilder.typ")], check=True)
print(f"Druckblatt: {OUT / 'stationsschilder.pdf'}")
