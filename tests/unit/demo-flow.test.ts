import { describe, expect, it } from "vitest";
import { createDemoTask, updateDemoTask } from "../../lib/demo-data";
import { nextAgentState } from "../../lib/ai/agent";

describe("stage 3-5 demo flow", () => {
  it("starts with clarification and can reach confirmation", () => {
    const task = createDemoTask({ message: "我想帮父亲咨询医保缴费" });
    expect(task.status).toBe("CLARIFYING");
    expect(task.missingFields).toContain("所在省、市、区");

    const updated = updateDemoTask(task.id, {
      missingFields: [],
      status: "WAITING_CONFIRMATION",
      evidence: [],
    });
    expect(updated?.status).toBe("WAITING_CONFIRMATION");
  });

  it("keeps the agent fail-closed before evidence exists", () => {
    expect(nextAgentState("RETRIEVE", {
      missingFields: [],
      hasPolicyEvidence: false,
      requiresConfirmation: true,
    })).toEqual({ state: "CLARIFY", terminal: true });
  });
});
