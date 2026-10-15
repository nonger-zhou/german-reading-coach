import { describe, expect, it } from "vitest";
import {
  isArticleParagraphLine,
  isAuthorNameLine,
  isBadImportPluginTitle,
  isCookieOrExternalEmbedPlaceholder,
  isRelatedSectionHeading,
  isReasonableArticleHeadline,
  stripSiteSuffixFromTitle,
} from "./visibleArticleExtractLogic";

describe("visibleArticleExtractLogic", () => {
  it("strips site suffix from meta titles", () => {
    expect(
      stripSiteSuffixFromTitle("Königshaus in Dänemark | NZZ"),
    ).toBe("Königshaus in Dänemark");
  });

  it("detects related section headings", () => {
    expect(isRelatedSectionHeading("Das könnte Sie auch interessieren")).toBe(
      true,
    );
  });

  it("detects author name lines", () => {
    expect(isAuthorNameLine("Arthur Rutishauser")).toBe(true);
    expect(isAuthorNameLine("Peter Sieber")).toBe(true);
    expect(
      isArticleParagraphLine(
        "Die dänische Königsfamilie steht vor einer schwierigen Phase.",
      ),
    ).toBe(true);
  });

  it("detects cookie / external embed placeholders", () => {
    expect(
      isCookieOrExternalEmbedPlaceholder(
        "Hier wird Inhalt angezeigt, der zusätzliche Cookies setzt.",
      ),
    ).toBe(true);
    expect(
      isCookieOrExternalEmbedPlaceholder(
        "An dieser Stelle finden Sie einen ergänzenden externen Inhalt. Falls Sie damit einverstanden sind, dass Cookies von externen Anbietern gesetzt werden, können Sie alle Cookies zulassen.",
      ),
    ).toBe(true);
    expect(
      isCookieOrExternalEmbedPlaceholder(
        "Die dänische Königsfamilie steht vor einer schwierigen Phase.",
      ),
    ).toBe(false);
  });

  it("rejects bad plugin titles", () => {
    expect(isBadImportPluginTitle("Das könnte Sie auch interessieren")).toBe(
      true,
    );
    expect(isBadImportPluginTitle("Arthur Rutishauser")).toBe(true);
    expect(
      isReasonableArticleHeadline(
        "«Sagt jemand im Vorstellungsgespräch: Mein Chef war schlecht»",
      ),
    ).toBe(true);
  });
});
