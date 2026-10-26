import Link from "next/link";
import { TaskWorkspace } from "@/components/task-workspace";

export default function DocumentsPage() {
  return <main className="main"><Link href="/">← 返回首页</Link><section className="compose" style={{ marginTop: 28 }}><span className="eyebrow">材料检查</span><h1 style={{ fontSize: 30 }}>材料识别与检查</h1><p className="intro-copy">请选择一个任务后上传演示材料。当前只返回本地质量检查结果，不保存原始文件。</p><TaskWorkspace /></section></main>;
}
