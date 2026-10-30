import { describe, expect, it } from "vitest";
import { parseDocument } from "../../lib/documents/parse";

describe("document parsing", () => {
  it("extracts UTF-8 text", async () => {
    const file = new File(["医保材料清单\n身份证复印件"], "demo.txt", { type: "text/plain" });
    const result = await parseDocument(file);
    expect(result.text).toContain("医保材料清单");
    expect(result.textLength).toBeGreaterThan(0);
    expect(result.truncated).toBe(false);
  });

  it("rejects unsupported binary files", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "demo.bin", { type: "application/octet-stream" });
    await expect(parseDocument(file)).rejects.toMatchObject({ code: "UNSUPPORTED_TYPE" });
  });
});
