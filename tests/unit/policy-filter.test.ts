import { describe, expect, it } from "vitest";
import { searchPolicies } from "../../lib/rag/retriever";

describe("demo policy retrieval boundaries", () => {
  it("does not return another region's demo evidence", async () => {
    const result = await searchPolicies("父亲医保缴费", {
      region: "上海市",
      serviceType: "medical_insurance",
      asOf: new Date("2026-06-01"),
    });
    expect(result).toEqual([]);
  });

  it("does not return evidence for a different service type", async () => {
    const result = await searchPolicies("学生助学金申请", {
      region: "演示地区",
      serviceType: "student_aid",
      asOf: new Date("2026-06-01"),
    });
    expect(result).toEqual([]);
  });

  it("returns the demo fixture only for its matching service, region, and date", async () => {
    const result = await searchPolicies("父亲居民医保缴费", {
      region: "演示地区",
      serviceType: "medical_insurance",
      asOf: new Date("2026-06-01"),
    });
    expect(result).toHaveLength(1);
    expect(result[0].title).toContain("演示");
  });
});
