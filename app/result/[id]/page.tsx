import Link from "next/link";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="main"><Link href="/">← 返回首页</Link><section className="compose" style={{ marginTop: 28 }}><span className="eyebrow">办理指南</span><h1 style={{ fontSize: 30 }}>结果尚未生成</h1><p>任务编号：{id}</p><p className="intro-copy">正式结果页将展示办理步骤、材料状态、政策证据和风险提示。</p></section></main>;
}
