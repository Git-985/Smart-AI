import Link from "next/link";

export default function DocumentsPage() {
  return <main className="main"><Link href="/">← 返回首页</Link><section className="compose" style={{ marginTop: 28 }}><span className="eyebrow">材料检查</span><h1 style={{ fontSize: 30 }}>材料识别与检查</h1><p className="intro-copy">上传、OCR 和字段置信度确认将在后续阶段实现。请勿在演示环境上传真实证件。</p></section></main>;
}
