import { describe, expect, it } from "vitest";
import { searchPolicies } from "../../lib/rag/retriever";

describe("policy retrieval boundaries", () => {
  it("does not return another local region's evidence", async () => {
    const result = await searchPolicies("父亲医保缴费", {
      region: "上海市",
      serviceType: "medical_insurance",
      asOf: new Date("2026-06-01"),
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.region === "上海市" || item.region === "全国")).toBe(true);
    expect(result.some((item) => item.region === "北京市")).toBe(false);
  });

  it("does not mix evidence from a different service type", async () => {
    const result = await searchPolicies("学生助学金申请", {
      region: "演示地区",
      serviceType: "student_aid",
      asOf: new Date("2026-06-01"),
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.serviceType === "student_aid")).toBe(true);
  });

  it("returns national fallback for an unmapped region", async () => {
    const result = await searchPolicies("父亲居民医保缴费", {
      region: "演示地区",
      serviceType: "medical_insurance",
      asOf: new Date("2026-06-01"),
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.region === "全国")).toBe(true);
    expect(result[0].title).toContain("城乡居民基本医疗保险");
  });

  it("supports student aid and elderly/disability services", async () => {
    const student = await searchPolicies("助学贷款和助学金", {
      region: "全国",
      serviceType: "student_aid",
      asOf: new Date("2026-06-01"),
    });
    const elderly = await searchPolicies("老人高龄津贴和护理补贴", {
      region: "全国",
      serviceType: "elderly_disability_service",
      asOf: new Date("2026-06-01"),
    });
    expect(student.length).toBeGreaterThan(0);
    expect(elderly.length).toBeGreaterThan(0);
    expect(student[0].title).toMatch(/助学|资助|奖学金/);
    expect(elderly[0].title).toMatch(/高龄|护理|补贴/);
  });
});
