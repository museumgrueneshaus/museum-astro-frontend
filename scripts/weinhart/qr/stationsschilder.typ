// Erzeugt von qr.py. Ein Schild pro Seite, A6 quer, für Tischaufsteller.
#set page(width: 148mm, height: 105mm, margin: 10mm)
#set text(font: ("Fraunces", "Georgia"), size: 11pt, lang: "de")
#let schild(nr, titel, datei, url) = {
  align(horizon, grid(columns: (1fr, 62mm), gutter: 8mm,
    align(horizon)[
      #text(size: 8pt, tracking: 0.18em, fill: rgb("#8a6a40"), font: "Inter", weight: 600)[#upper[Johann Weinhart. Bildhauer]]
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
}
#schild("00", "Einführung", "weinhart-00.svg", "https://museumgh-preview.netlify.app/audioguide/?a=weinhart&s=weinhart-00")
#schild("01", "Zugspitzgeist", "weinhart-01.svg", "https://museumgh-preview.netlify.app/audioguide/?a=weinhart&s=weinhart-01")
#schild("02", "Hl. Jakobus", "weinhart-02.svg", "https://museumgh-preview.netlify.app/audioguide/?a=weinhart&s=weinhart-02")
#schild("03", "Lealibrunnen", "weinhart-03.svg", "https://museumgh-preview.netlify.app/audioguide/?a=weinhart&s=weinhart-03")
#schild("04", "Ewige Gewalt", "weinhart-04.svg", "https://museumgh-preview.netlify.app/audioguide/?a=weinhart&s=weinhart-04")
#schild("05", "Hl. Dionysius", "weinhart-05.svg", "https://museumgh-preview.netlify.app/audioguide/?a=weinhart&s=weinhart-05")
