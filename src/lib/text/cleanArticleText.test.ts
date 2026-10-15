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

  it("removes cookie / external embed placeholder paragraphs", () => {
    const result = cleanArticleText(`
Einleitung zum Thema.

Hier wird Inhalt angezeigt, der zusätzliche Cookies setzt.

An dieser Stelle finden Sie einen ergänzenden externen Inhalt. Falls Sie damit einverstanden sind, dass Cookies von externen Anbietern gesetzt werden, können Sie alle Cookies zulassen.

Der eigentliche Absatz der Geschichte geht hier weiter.
`);

    expect(result.cleanedText).toContain("Einleitung zum Thema");
    expect(result.cleanedText).toContain("eigentliche Absatz");
    expect(result.cleanedText).not.toContain("zusätzliche Cookies");
    expect(result.cleanedText).not.toContain("ergänzenden externen Inhalt");
  });
});

describe("cleanArticleText — standalone web UI lines (EN + DE)", () => {
  it("removes English button / meta lines copied from news sites", () => {
    const raw = [
      "Listen to the article",
      "Toggle language selector",
      "",
      "Save",
      "",
      "Share",
      "This content was published onOctober 15, 2026 - 09:32",
      "9 minutes",
      "",
      "Sara Ibrahim",
      "",
      "Swarms of AI agents could target critical infrastructure such as schools and hospitals.",
    ].join("\n");
    const { cleanedText } = cleanArticleText(raw);
    for (const gone of ["Listen to the article", "Toggle language selector", "Save", "Share", "published on", "9 minutes"]) {
      expect(cleanedText).not.toContain(gone);
    }
    expect(cleanedText).toContain("Sara Ibrahim");
    expect(cleanedText).toContain("Swarms of AI agents");
  });

  it("removes German equivalents but keeps prose that merely contains those words", () => {
    const raw = [
      "Artikel anhören",
      "Speichern",
      "Lesezeit: 4 Minuten",
      "Dieser Inhalt wurde am 15. Oktober 2026 veröffentlicht",
      "",
      "Man kann bemerken, dass die Regierung das Gesetz drucken lassen will und die Daten speichern möchte.",
      "Wir sollten uns das merken.",
    ].join("\n");
    const { cleanedText } = cleanArticleText(raw);
    for (const gone of ["Artikel anhören", "Lesezeit", "Dieser Inhalt wurde am"]) {
      expect(cleanedText).not.toContain(gone);
    }
    expect(cleanedText).not.toMatch(/^Speichern$/m);
    expect(cleanedText).toContain("bemerken, dass die Regierung das Gesetz drucken lassen will");
    expect(cleanedText).toContain("Wir sollten uns das merken.");
  });
});
