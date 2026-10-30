"use client";

import { useState, type FormEvent } from "react";

type ParseResult = {
  filename: string;
  mimeType: string;
  size: number;
  pages?: number;
  textLength: number;
  truncated: boolean;
  text: string;
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || pending) return;
    setPending(true);
    setError("");
    setResult(null);

    const form = new FormData();
    form.append("file", file);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

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
            accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              setFile(next);
              setResult(null);
              setError("");
            }}
          />
          <strong>选择或拖入一个文件</strong>
          <span>支持 PDF、DOCX、TXT，最大 10MB；文件只在本次请求中读取，不保存。</span>
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
          <p className="document-meta">
            {result.mimeType} · {formatBytes(result.size)}
            {result.pages ? ` · ${result.pages} 页` : ""} · 提取 {result.textLength} 字
            {result.truncated ? "（已截取前 20,000 字）" : ""}
          </p>
          <pre className="document-text">{result.text}</pre>
        </article>
      )}
    </div>
  );
}
