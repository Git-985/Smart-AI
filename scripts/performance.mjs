import { performance } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3107";
const durations = [];
const ids = new Set();
for (let batch = 0; batch < 5; batch++) {
  await Promise.all(Array.from({ length: 4 }, async () => {
    const start = performance.now();
    const created = await fetch(`${base}/api/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "居民医保缴费演示" }),
    });
    if (!created.ok) throw new Error(`Create failed: ${created.status}`);
    const cookie = created.headers.get("set-cookie")?.split(";")[0];
    const task = await created.json();
    ids.add(task.id);
    const result = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ taskId: task.id, region: "演示地区", year: "2026" }),
    });
    if (!result.ok || (await result.json()).task.evidence.length !== 1) throw new Error("Flow failed");
    durations.push(performance.now() - start);
  }));
}
durations.sort((a, b) => a - b);
if (ids.size !== 20) throw new Error("Task IDs collided");
const report = {
  date: new Date().toISOString(), mode: "local-rule-demo-no-llm",
  concurrency: 4, flows: 20, failures: 0,
  medianMs: Math.round(durations[9]), p95Ms: Math.round(durations[18]),
  maxMs: Math.round(durations.at(-1)),
  limitation: "Local demo API only; not an online SLA, OCR, LLM or production load measurement.",
};
await mkdir("test-results", { recursive: true });
await writeFile("test-results/performance.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
