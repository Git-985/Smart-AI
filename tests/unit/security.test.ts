import { describe, expect, it } from "vitest";
import { maskSensitiveText } from "../../lib/security/pii";
import { calculateRisk } from "../../lib/security/risk";

describe("privacy and risk helpers", () => {
  it("masks phone and identity numbers", () => {
    expect(maskSensitiveText("13800138000")).toBe("138****8000");
    expect(maskSensitiveText("11010519491231002X")).toBe("110************2X");
  });

  it("requires high risk for money-related guidance", () => {
    expect(calculateRisk({ involvesMoney: true })).toBe("HIGH");
  });
});
