import { describe, expect, it } from "vitest";
import { expenseMessage, retryDelay } from "./telegram-delivery";

describe("Telegram delivery", () => {
  it("distinguishes the recorder from the payer and formats kuruş", () => {
    const text = expenseMessage({ creator: "Ece", payer: "Ada", amount: 12990, description: "Market", category: "Gıda" });
    for (const detail of ["Ece bir harcama ekledi", "Ödeyen: Ada", "129,90", "Market", "Gıda"]) expect(text).toContain(detail);
  });
  it("retries temporary failures before the next minute and respects flood limits", () => {
    expect(retryDelay(1)).toBe(5);
    expect(retryDelay(1, 429, 180)).toBe(180);
    expect(retryDelay(99)).toBe(3600);
    expect(retryDelay(1, 403)).toBe(3600);
  });
  it("shows selected participants even when the recorder is the payer", () => {
    expect(expenseMessage({ creator: "Ece", payer: null, participants: ["Ada", "Can"], amount: 10000, description: "Market", category: "Gıda" }))
      .toContain("Paya dahil olanlar: Ada, Can");
  });
});
