import Link from "next/link";
import { DocumentParser } from "@/components/document-parser";
import { PrivacyNotice } from "@/components/privacy-notice";

export default function DocumentsPage() {
  return (
    <main className="main">
      <Link href="/">← 返回首页</Link>
      <section className="compose" style={{ marginTop: 28 }}>
        <span className="eyebrow">材料解析</span>
        <h1 style={{ fontSize: 30 }}>上传并解析材料</h1>
        <p className="intro-copy">
          支持 PDF、DOCX、TXT 文本提取，以及 PNG、JPG、WEBP 图片的本地 OCR；扫描版 PDF 会自动把页面转成图片识别。解析后会按所选模块给出材料核对报告。文件只在本次请求中读取，服务端不保存文件内容。
        </p>
        <p className="notice">
          文字识别在服务端本地运行，不上传第三方识别服务；报告只用于自查，不代替官方审核。
        </p>
        <PrivacyNotice />
        <DocumentParser />
      </section>
    </main>
  );
}
