import { NextResponse } from "next/server";
import { getDemoTask, updateDemoTask } from "@/lib/demo-data";
import { searchPolicies } from "@/lib/rag/retriever";

export async function POST(request: Request) {
  const body = await request.json() as { taskId?: string; region?: string; year?: string };
  if (!body.taskId) return NextResponse.json({ error: "TASK_ID_REQUIRED" }, { status: 400 });
  const task = getDemoTask(body.taskId);
  if (!task) return NextResponse.json({ error: "TASK_NOT_FOUND" }, { status: 404 });
  const missingFields = [!body.region ? "所在省、市、区" : "", !body.year ? "办理年份" : ""].filter(Boolean);
  const evidence = missingFields.length ? [] : await searchPolicies(task.message, { region: body.region, serviceType: task.serviceType, asOf: new Date(`${body.year}-12-31`) });
  const updated = updateDemoTask(task.id, {
    missingFields,
    evidence,
    status: missingFields.length ? "CLARIFYING" : "WAITING_CONFIRMATION",
    plan: missingFields.length ? [] : ["确认当地官方办理渠道", "核对材料是否齐全", "在人工确认后再进行正式办理"],
  });
  return NextResponse.json({
    task: updated,
    message: missingFields.length ? `还需要确认：${missingFields.join("、")}` : "已完成演示检索。请先阅读证据和风险提示，再决定下一步。",
  });
}
