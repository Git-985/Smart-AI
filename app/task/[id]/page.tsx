import Link from "next/link";
import { TaskWorkspace } from "@/components/task-workspace";
import { ownedTask } from "@/lib/demo-data";
import { cookies } from "next/headers";
import { sessionCookie } from "@/lib/security/session";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = ownedTask(id, (await cookies()).get(sessionCookie)?.value);
  if (!task) return <main className="main"><h1>任务不可用</h1><p>任务已过期、服务已重启，或当前浏览器没有访问权限。</p><Link href="/task/new">重新创建任务</Link></main>;
  return <main className="main"><Link href="/">← 返回首页</Link><TaskWorkspace initialTask={task} /></main>;
}
