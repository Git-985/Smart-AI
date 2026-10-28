import { afterEach, describe, expect, it, vi } from "vitest";
import { postJson } from "../../lib/http";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("request recovery", () => {
  it("aborts requests at 15 seconds with a retry message", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", (_: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    const pending = expect(postJson("/api/tasks", {})).rejects.toThrow("请求超时，请重试");
    await vi.advanceTimersByTimeAsync(15000);
    await pending;
  });
  it("turns network errors into a readable failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(postJson("/api/tasks", {})).rejects.toThrow("网络连接失败");
  });
});
