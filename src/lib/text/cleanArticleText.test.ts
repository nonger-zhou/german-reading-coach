import { describe, expect, it } from "vitest";
import { cleanArticleText } from "./cleanArticleText";

describe("cleanArticleText", () => {
  it("removes related links, newsletter and comment tail after article body", () => {
    const result = cleanArticleText(`
USA wollen doppelt so viel Geld für Patriot-Raketen - über 4 Milliarden

Der Irankrieg verknappt die amerikanischen Waffenvorräte. Nun haben Vertreter der US-Regierung Bern informiert, dass der Preis der Patriot-Waffenbestellung weiter steigen wird.

Eine begehrte Waffe, die immer teurer wird: Eine Patriot-Feuereinheit bei einer Ausstellung 2022 in Emmen. In Kürze: Die Kosten für die Schweizer Patriot-Bestellung steigen weiter.

Wenn Anfang Woche also von einigen Jahren gesprochen war, dann ist die Rede davon, dass die Armee mit einer Verspätung von fünf Jahren rechnen müsse. Nun heisst es in informierten Kreisen: Es dauert nicht schneller, sondern eher noch länger.

DIE VERZÖGERTE BESCHAFFUNG DER PATRIOT-RAKETEN

Abo Aufrüstung der Schweiz Martin Pfisters Milliarden-Plan: Die Bevölkerung soll mehr Steuern für die Armee bezahlen

Abo Patriot-Beschaffung Die USA erhöhen den Druck - die Schweiz zahlt

Newsletter

Der Morgen

Der perfekte Start in den Tag mit News und Geschichten aus der Schweiz und der Welt.

Mario Stäuble ist Ressortleiter Politik und Wirtschaft. Mehr Infos @mario_staeuble

Fehler gefunden? Jetzt melden.

111 Kommentare
`);

    expect(result.cleanedText).toContain("Patriot-Waffenbestellung weiter steigen wird");
    expect(result.cleanedText).toContain("eher noch länger");
    expect(result.cleanedText).not.toContain("Martin Pfisters Milliarden-Plan");
    expect(result.cleanedText).not.toContain("Der perfekte Start in den Tag");
    expect(result.cleanedText).not.toContain("111 Kommentare");
  });
});
