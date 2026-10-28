import { describe, expect, it } from "vitest";
import { POST } from "../../app/api/confirmations/route";
import { createDemoTask, updateDemoTask } from "../../lib/demo-data";
import { getAuditEvents } from "../../lib/security/audit";

describe("risk acknowledgement", () => {
  it("records acknowledgement without marking the application complete", async () => {
    const task = createDemoTask({ message: "医保咨询", region: "演示地区", year: "2026" }, "a".repeat(64));
    updateDemoTask(task.id, { status: "WAITING_CONFIRMATION" });
    const request = new Request("http://localhost/api/confirmations", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: `smart_ai_session=${"a".repeat(64)}` },
      body: JSON.stringify({ taskId: task.id, acknowledged: true }),
    });

    const response = await POST(request);
    const body = await response.json() as { acknowledged: boolean; taskStatus: string };

    expect(response.status).toBe(200);
    expect(body.acknowledged).toBe(true);
    expect(body.taskStatus).toBe("WAITING_CONFIRMATION");
    expect(getAuditEvents(task.id).at(-1)?.eventType).toBe("USER_CONFIRMED");
  });

  it("rejects confirmations that do not acknowledge the demo boundary", async () => {
    const response = await POST(new Request("http://localhost/api/confirmations", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: `smart_ai_session=${"a".repeat(64)}` },
      body: JSON.stringify({ taskId: "demo_invalid", acknowledged: false }),
    }));
    expect(response.status).toBe(400);
  });
});

