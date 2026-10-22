import Link from "next/link";

export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="main"><Link href="/">← 返回首页</Link><section className="compose" style={{ marginTop: 28 }}><span className="eyebrow">家属协助模式</span><h1 style={{ fontSize: 30 }}>协助办理</h1><p>任务编号：{id}</p><p className="intro-copy">这里将提供简明步骤与家属协助清单。</p></section></main>;
}
