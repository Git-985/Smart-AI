import { describe, expect, it } from "vitest";
import { POST } from "../../app/api/chat/route";
import { createDemoTask } from "../../lib/demo-data";
import { getAuditEvents } from "../../lib/security/audit";

describe("chat clarification safety", () => {
  it("does not advance an unknown task without a clarified service type", async () => {
    const task = createDemoTask({ message: "我有一件事情想咨询" }, "a".repeat(64));
    const response = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: `smart_ai_session=${"a".repeat(64)}` },
      body: JSON.stringify({ taskId: task.id, region: "演示地区", year: "2026" }),
    }));
    const body = await response.json() as { task: { status: string; missingFields: string[]; evidence: unknown[] } };

    expect(body.task.status).toBe("CLARIFYING");
    expect(body.task.missingFields).toContain("具体想办理的事项");
    expect(body.task.evidence).toEqual([]);
  });

  it("classifies only after clarification and keeps PII masked", async () => {
    const task = createDemoTask({ message: "我有一件事情想咨询" }, "a".repeat(64));
    const response = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: `smart_ai_session=${"a".repeat(64)}` },
      body: JSON.stringify({
        taskId: task.id,
        clarification: "是医保缴费，手机号13800138000",
        region: "演示地区",
        year: "2026",
      }),
    }));
    const body = await response.json() as { task: { status: string; serviceType: string; riskLevel: string; message: string; evidence: unknown[] } };

    expect(body.task.serviceType).toBe("medical_insurance");
    expect(body.task.riskLevel).toBe("HIGH");
    expect(body.task.status).toBe("WAITING_CONFIRMATION");
    expect(body.task.message).toContain("138****8000");
    expect(body.task.message).not.toContain("13800138000");
    expect(body.task.evidence.length).toBeGreaterThan(0);
    expect(getAuditEvents(task.id).at(-1)?.metadata.riskLevel).toBe("HIGH");
  });
});

