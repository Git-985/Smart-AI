import Link from "next/link";
import { DocumentParser } from "@/components/document-parser";

export default function DocumentsPage() {
  return (
    <main className="main">
      <Link href="/">← 返回首页</Link>
      <section className="compose" style={{ marginTop: 28 }}>
        <span className="eyebrow">材料解析</span>
        <h1 style={{ fontSize: 30 }}>上传并解析材料</h1>
        <p className="intro-copy">
          支持 PDF、DOCX、TXT 的文本提取。文件只在本次请求中读取，服务端不保存文件内容；请勿上传真实证件、银行卡或病历。
        </p>
        <p className="notice">
          扫描版 PDF 和图片需要 OCR，当前演示未启用；如材料是图片，请先转换为 PDF 或文字。
        </p>
        <DocumentParser />
      </section>
    </main>
  );
}
