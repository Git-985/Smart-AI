"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Upload, X } from "lucide-react";
import type { MaterialReportData } from "@/components/material-report";
import { PrivacyNotice } from "@/components/privacy-notice";

export type ParsedMaterial = {
  name: string;
  size: number;
  report: MaterialReportData;
  text: string;
};

type Props = {
  open: boolean;
  serviceType?: string;
  onClose: () => void;
  onComplete: (files: ParsedMaterial[], failures: string[]) => void;
};

const MAX_FILES = 6;
const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp";

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(name: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(name);
}

export function UploadDialog({ open, serviceType, onClose, onComplete }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setChecked([]);
    setError("");
    setProgress("");
    setPending(false);
    const timer = setTimeout(() => closeRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, pending, onClose]);

  if (!open) return null;

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = [...files];
    const problems: string[] = [];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        problems.push(`一次最多 ${MAX_FILES} 个文件`);
        break;
      }
      if (!ACCEPT.split(",").some((ext) => file.name.toLowerCase().endsWith(ext))) {
        problems.push(`${file.name} 类型不支持`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        problems.push(`${file.name} 超过 10MB`);
        continue;
      }
      if (next.some((item) => item.name === file.name && item.size === file.size)) continue;
      next.push(file);
    }
    setFiles(next);
    setChecked(next.map(() => true));
    setError(problems.join("；"));
  }

  function toggle(index: number) {
    setChecked((current) => current.map((value, i) => (i === index ? !value : value)));
  }

  function remove(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
    setChecked((current) => current.filter((_, i) => i !== index));
  }

  async function start() {
    const picked = files.filter((_, index) => checked[index]);
    if (!picked.length) {
      setError("请至少勾选一个文件。");
      return;
    }
    setPending(true);
    setError("");
    const parsed: ParsedMaterial[] = [];
    const failures: string[] = [];
    for (let index = 0; index < picked.length; index += 1) {
      const file = picked[index];
      setProgress(`正在解析 ${index + 1}/${picked.length}：${file.name}`);
      try {
        const form = new FormData();
        form.append("file", file);
        if (serviceType) form.append("serviceType", serviceType);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 90000);
        try {
          const response = await fetch("/api/documents/parse", { method: "POST", body: form, signal: controller.signal });
          const data = await response.json().catch(() => null) as { message?: string; report?: MaterialReportData; text?: string } | null;
          if (!response.ok || !data?.report) throw new Error(data?.message ?? "解析失败");
          parsed.push({ name: file.name, size: file.size, report: data.report, text: data.text ?? "" });
        } finally {
          clearTimeout(timer);
        }
      } catch (caught) {
        failures.push(`${file.name}：${caught instanceof Error ? caught.message : "解析失败"}`);
      }
    }
    setPending(false);
    setProgress("");
    if (!parsed.length) {
      setError(failures.join("；") || "解析失败，请换个文件重试。");
      return;
    }
    onComplete(parsed, failures);
    onClose();
  }

  return (
    <div
      className="upload-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div className="upload-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-title">
        <div className="upload-head">
          <div>
            <span className="eyebrow">材料上传</span>
            <h2 id="upload-title">选择要解析的文件或图片</h2>
          </div>
          <button ref={closeRef} className="icon-button" type="button" onClick={onClose} disabled={pending} aria-label="关闭上传窗口">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <label
          className="upload-drop"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(event.dataTransfer.files);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            onChange={(event) => {
              addFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
          <Upload size={22} aria-hidden="true" />
          <strong>从本地选择文件或图片</strong>
          <span>支持 PDF、DOCX、TXT、PNG、JPG、WEBP，单个不超过 10MB，一次最多 {MAX_FILES} 个；手机上会打开相册或文件。</span>
        </label>

        {files.length > 0 && (
          <>
            <div className="upload-list-head">
              <strong>已选择 {files.length} 个文件</strong>
              <button className="small-action" type="button" onClick={() => inputRef.current?.click()} disabled={pending}>
                继续添加
              </button>
            </div>
            <ul className="upload-list">
              {files.map((file, index) => (
                <li key={`${file.name}-${file.size}`} className={checked[index] ? "is-checked" : ""}>
                  <label className="upload-check">
                    <input
                      type="checkbox"
                      checked={checked[index]}
                      onChange={() => toggle(index)}
                      disabled={pending}
                      aria-label={`选择 ${file.name}`}
                    />
                    <span className="upload-icon">{isImage(file.name) ? <ImageIcon size={18} aria-hidden="true" /> : <FileText size={18} aria-hidden="true" />}</span>
                    <span className="upload-name">
                      <strong>{file.name}</strong>
                      <small>{sizeLabel(file.size)} · {isImage(file.name) ? "图片（OCR 识别）" : "文档（文字提取）"}</small>
                    </span>
                  </label>
                  <button className="icon-button upload-remove" type="button" onClick={() => remove(index)} disabled={pending} aria-label={`移除 ${file.name}`}>
                    <X size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <PrivacyNotice variant="compact" />

        {pending && <p className="notice" role="status">{progress || "正在解析，请稍候…"}</p>}
        {error && <p className="notice" role="alert">{error}</p>}

        <div className="upload-actions">
          <span className="upload-count">已勾选 {checked.filter(Boolean).length} / {files.length}</span>
          <div>
            <button className="small-action" type="button" onClick={onClose} disabled={pending}>取消</button>
            <button className="primary-button" type="button" onClick={() => void start()} disabled={pending || !files.length}>
              {pending ? "解析中…" : "开始上传"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
