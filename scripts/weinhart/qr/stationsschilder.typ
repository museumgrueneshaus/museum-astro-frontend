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
      #text(size: if titel.len() > 30 { 18pt } else { 24pt }, weight: 300)[#titel]
      #v(6mm)
      #text(size: 9pt, font: "Inter")[Audioguide · Audio guide]
      #v(1mm)
      #text(size: 7pt, font: "Inter", fill: luma(110))[DE · EN]
    ],
    align(horizon, image(datei, width: 62mm)),
  ))
  pagebreak(weak: true)
}
#schild("00", "Einführung", "weinhart-00.svg", "https://museumgh-preview.netlify.app/g/7pv2ht")
#schild("04", "Heiliger Martin des 21. Jahrhunderts", "weinhart-04.svg", "https://museumgh-preview.netlify.app/g/z627pa")
#schild("05", "Studie zur modernen Apokalypse", "weinhart-05.svg", "https://museumgh-preview.netlify.app/g/xby4yv")
#schild("09", "Vater, warum hast du mich verlassen?", "weinhart-09.svg", "https://museumgh-preview.netlify.app/g/qanc6c")
#schild("10", "Selbstbildnis", "weinhart-10.svg", "https://museumgh-preview.netlify.app/g/xddb24")
#schild("14", "Heiliger Dionysius", "weinhart-14.svg", "https://museumgh-preview.netlify.app/g/qd92uc")
#schild("15", "Heilige Maria", "weinhart-15.svg", "https://museumgh-preview.netlify.app/g/5e87d7")
#schild("19", "Heiliger Franziskus", "weinhart-19.svg", "https://museumgh-preview.netlify.app/g/sev48x")
#schild("22", "Christus reißt sich los, um uns zu erreichen", "weinhart-22.svg", "https://museumgh-preview.netlify.app/g/5t47xw")
#schild("25", "Vergebliche Flucht", "weinhart-25.svg", "https://museumgh-preview.netlify.app/g/dbbrer")
#schild("32", "Soldatengruppe mit sterbenden Soldaten", "weinhart-32.svg", "https://museumgh-preview.netlify.app/g/msbkzq")
#schild("33", "Harfenspieler", "weinhart-33.svg", "https://museumgh-preview.netlify.app/g/y42z77")
#schild("40", "Versuchung", "weinhart-40.svg", "https://museumgh-preview.netlify.app/g/rdkff5")
