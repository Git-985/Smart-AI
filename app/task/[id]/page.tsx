import Link from "next/link";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="main"><Link href="/">← 返回首页</Link><section className="compose" style={{ marginTop: 28 }}><span className="eyebrow">任务工作台</span><h1 style={{ fontSize: 30 }}>办理任务</h1><p>任务编号：{id}</p><p className="intro-copy">对话、进度、材料、政策证据与风险确认面板将在后续阶段接入。</p></section></main>;
}
