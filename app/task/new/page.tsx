import Link from "next/link";
import { TaskWorkspace } from "@/components/task-workspace";

export default function NewTaskPage() {
  return (
    <main className="main">
      <Link href="/">← 返回首页</Link>
      <TaskWorkspace />
    </main>
  );
}
