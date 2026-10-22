import Link from "next/link";

export default function PolicyAdminPage() {
  return <main className="main"><Link href="/">← 返回首页</Link><section className="compose" style={{ marginTop: 28 }}><span className="eyebrow">管理</span><h1 style={{ fontSize: 30 }}>政策资料库</h1><p className="intro-copy">政策录入、来源管理、有效期过滤与检索评测将在后续阶段接入。首期数据应来自公开、可验证来源。</p></section></main>;
}
