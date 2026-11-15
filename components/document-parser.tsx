"use client";

import { useState, type FormEvent } from "react";
import { MaterialReportView, type MaterialReportData } from "@/components/material-report";

type ParseResult = {
  filename: string;
  mimeType: string;
  size: number;
  pages?: number;
  textLength: number;
  truncated: boolean;
  text: string;
  ocrUsed?: boolean;
  ocrConfidence?: number;
  ocrPages?: number;
  report?: MaterialReportData;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentParser() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [module, setModule] = useState("medical_insurance");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || pending) return;
    setPending(true);
    setError("");
    setResult(null);

    const form = new FormData();
    form.append("file", file);
    form.append("serviceType", module);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch("/api/documents/parse", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message;
        throw new Error(message || "解析失败，请检查文件后重试。");
      }
      setResult(data as ParseResult);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setError("解析超时，请换一个更小的文件重试。");
      } else {
        setError(caught instanceof Error ? caught.message : "解析失败，请稍后重试。");
      }
    } finally {
      clearTimeout(timer);
      setPending(false);
    }
  }

  return (
    <div className="document-parser">
      <form onSubmit={submit}>
        <label className="document-module">
          按哪个业务模块解析
          <select value={module} onChange={(event) => setModule(event.target.value)}>
            <option value="medical_insurance">社保缴纳</option>
            <option value="student_aid">高校助学金</option>
            <option value="elderly_disability_service">老年人保障</option>
          </select>
        </label>
        <label
          className="document-drop"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const next = event.dataTransfer.files?.[0] ?? null;
            if (next) {
              setFile(next);
              setResult(null);
              setError("");
            }
          }}
        >
          <input
            className="sr-only"
            type="file"
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,image/png,image/jpeg,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              setFile(next);
              setResult(null);
              setError("");
            }}
          />
          <strong>选择或拖入一个文件</strong>
          <span>支持 PDF、DOCX、TXT、PNG、JPG、WEBP，最大 10MB；图片和扫描版 PDF 会做本地 OCR，文件不在服务端保存。</span>
        </label>
        {file && <p className="document-file">已选择：{file.name}（{formatBytes(file.size)}）</p>}
        <div className="document-actions">
          <button className="primary-button" type="submit" disabled={!file || pending}>
            {pending ? "解析中…" : "解析文档"}
          </button>
          {file && <button className="small-action" type="button" onClick={() => { setFile(null); setResult(null); setError(""); }}>清除</button>}
        </div>
        {error && <p className="notice" role="alert">{error}</p>}
        {pending && <p className="notice" role="status">正在读取文件并提取文本，请稍候…</p>}
      </form>

      {result && (
        <article className="document-result">
          <div className="document-result-head">
            <div>
              <span className="eyebrow">解析结果</span>
              <h2>{result.filename}</h2>
            </div>
            <button className="small-action" type="button" onClick={() => navigator.clipboard.writeText(result.text)}>
              复制文本
            </button>
          </div>
          {result.report ? (
            <MaterialReportView report={result.report} />
          ) : (
            <p className="document-meta">
              {result.mimeType} · {formatBytes(result.size)}
              {result.pages ? ` · ${result.pages} 页` : ""} · 提取 {result.textLength} 字
            </p>
          )}
          <details className="document-raw">
            <summary>查看提取到的原文（{result.textLength} 字{result.truncated ? "，已截取" : ""}）</summary>
            <pre className="document-text">{result.text}</pre>
          </details>
        </article>
      )}
    </div>
  );
}
