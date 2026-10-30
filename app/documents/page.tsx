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
          支持 PDF、DOCX、TXT 文本提取，以及 PNG、JPG、WEBP 图片的本地 OCR。文件只在本次请求中读取，服务端不保存文件内容；请勿上传真实证件、银行卡或病历。
        </p>
        <p className="notice">
          扫描版 PDF 目前请转为图片后上传；图片 OCR 在服务端本地运行，不上传第三方识别服务。
        </p>
        <DocumentParser />
      </section>
    </main>
  );
}
