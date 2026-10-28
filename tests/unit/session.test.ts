import { describe, expect, it } from "vitest";
import { createDemoTask, ownedTask } from "../../lib/demo-data";
import { createSession } from "../../lib/security/session";

describe("anonymous task ownership", () => {
  it("allows only the owning cookie and expires tasks after one day", () => {
    const owner = createSession();
    const task = createDemoTask({ message: "医保" }, owner);
    expect(ownedTask(task.id, owner)?.id).toBe(task.id);
    expect(ownedTask(task.id, createSession())).toBeUndefined();
    expect(ownedTask(task.id, undefined)).toBeUndefined();
    task.createdAt = new Date(Date.now() - 86400001).toISOString();
    expect(ownedTask(task.id, owner)).toBeUndefined();
  });
  it("generates unique IDs even during simultaneous creation", () => {
    const ids = Array.from({ length: 100 }, () => createDemoTask({ message: "医保" }).id);
    expect(new Set(ids).size).toBe(100);
  });
});
