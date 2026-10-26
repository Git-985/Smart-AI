import Link from "next/link";
import { TaskWorkspace } from "@/components/task-workspace";
import { getDemoTask } from "@/lib/demo-data";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = getDemoTask(id);
  return <main className="main"><Link href="/">← 返回首页</Link><TaskWorkspace initialTask={task} initialMessage={task?.message ?? `任务 ${id} 已创建，请继续补充地区和办理年份。`} /></main>;
}
