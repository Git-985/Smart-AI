import Link from "next/link";
import { FamilyAssist } from "@/components/family-assist";
import { cookies } from "next/headers";
import { ownedTask } from "@/lib/demo-data";
import { sessionCookie } from "@/lib/security/session";

export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ownedTask(id, (await cookies()).get(sessionCookie)?.value)) {
    return <main className="main"><h1>任务不可用</h1><Link href="/task/new">重新创建任务</Link></main>;
  }
  return <main className="main"><Link href="/">← 返回首页</Link><FamilyAssist taskId={id} /></main>;
}
