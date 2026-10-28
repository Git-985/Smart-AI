import { describe, expect, it } from "vitest";
import { maskSensitiveText } from "../../lib/security/pii";
import { calculateRisk } from "../../lib/security/risk";
import { createDemoTask } from "../../lib/demo-data";
import { documentMetadataSchema, policySearchSchema, taskCreateSchema } from "../../lib/api/schemas";

describe("privacy and risk helpers", () => {
  it("masks phone and identity numbers", () => {
    expect(maskSensitiveText("13800138000")).toBe("138****8000");
    expect(maskSensitiveText("11010519491231002X")).toBe("110************2X");
  });

  it("requires high risk for money-related guidance", () => {
    expect(calculateRisk({ involvesMoney: true })).toBe("HIGH");
  });

  it("masks sensitive values before placing text in the demo task store", () => {
    const task = createDemoTask({ message: "医保咨询，手机号13800138000，身份证11010519491231002X" });
    expect(task.message).toContain("138****8000");
    expect(task.message).toContain("110************2X");
    expect(task.message).not.toContain("13800138000");
    expect(task.message).not.toContain("11010519491231002X");
    expect(task.knownFacts[0]).toBe(task.message);
  });

  it("rejects oversized text and invalid document metadata", () => {
    expect(taskCreateSchema.safeParse({ message: "x".repeat(2001) }).success).toBe(false);
    expect(documentMetadataSchema.safeParse({ mimeType: "image/png", size: 10 * 1024 * 1024 + 1 }).success).toBe(false);
    expect(documentMetadataSchema.safeParse({ mimeType: "text/html", size: 20 }).success).toBe(false);
  });

  it("bounds policy search input", () => {
    expect(policySearchSchema.safeParse({
      query: "x".repeat(1001),
      region: "演示地区",
      serviceType: "medical_insurance",
      year: "2026",
    }).success).toBe(false);
  });
});
