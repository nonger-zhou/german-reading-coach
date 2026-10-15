import { describe, expect, it } from "vitest";
import { simpleExplanationForDisplay } from "./learningItemHelpers";

describe("simpleExplanationForDisplay", () => {
  it("keeps German placeholder unchanged in German space", () => {
    expect(simpleExplanationForDisplay("Wird später ergänzt.", "de")).toBe("Wird später ergänzt.");
  });
  it("replaces placeholder in English space", () => {
    expect(simpleExplanationForDisplay("Wird später ergänzt.", "en")).toBe("（英文释义待补充）");
    expect(simpleExplanationForDisplay("", "en", "grammar")).toBe("（英文解释待补充）");
  });
  it("keeps real explanations", () => {
    expect(simpleExplanationForDisplay("to make something better", "en")).toBe("to make something better");
  });
});
