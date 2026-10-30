import Link from "next/link";
import { TaskWorkspace } from "@/components/task-workspace";

const scenarios: Record<string, string> = {
  medical: "我想帮父亲了解今年居民医保怎么缴费，他行动不太方便。",
  student: "我想了解高校学生助学金申请需要准备什么。",
  elderly: "我想帮家里老人准备公共服务办理材料。",
};

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const { scenario } = await searchParams;
  return (
    <main className="main">
      <Link href="/">← 返回首页</Link>
      <TaskWorkspace initialMessage={scenario ? scenarios[scenario] : ""} />
    </main>
  );
}
