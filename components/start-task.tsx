"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, AudioLines, Paperclip } from "lucide-react";
import { maskSensitiveText } from "@/lib/security/pii";
import { UploadDialog, type ParsedMaterial } from "@/components/upload-dialog";
import { detectRegion, detectServiceType, detectYear } from "@/lib/documents/extract";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export function StartTask() {
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [listening, setListening] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [materials, setMaterials] = useState<ParsedMaterial[]>([]);
  const router = useRouter();

  function buildPrompt(files: ParsedMaterial[]): string {
    const first = files[0];
    const label = files.length > 1 ? `${files.length} 份材料` : `《${first.name}》`;
    const hint = first.report.moduleLabel && first.report.moduleLabel !== "材料核对" ? `（${first.report.moduleLabel}）` : "";
    return `我上传了${label}${hint}，想确认这件事现在该怎么办理、需要带哪些材料、我准备的是否齐全。`;
  }

  function handleUploaded(files: ParsedMaterial[], failures: string[]) {
    setMaterials(files);
    const combined = files.map((item) => item.text).join("\n").slice(0, 6000);
    const payload = {
      at: Date.now(),
      files: files.map((item) => ({ ...item, text: item.text.slice(0, 1200) })),
      region: detectRegion(combined),
      year: detectYear(combined),
    };
    try { sessionStorage.setItem("smart-ai:material", JSON.stringify(payload)); }
    catch { /* 存储不可用时只保留当前页面状态 */ }

    const summary = failures.length
      ? `已解析 ${files.length} 份，另有 ${failures.length} 份失败。`
      : `已解析 ${files.length} 份材料。`;
    if (!message.trim()) {
      setMessage(buildPrompt(files));
      setNotice(`${summary}下面这句是按材料起的头，请确认或改成您想问的，再点“开始梳理”。`);
    } else {
      setNotice(`${summary}将带着材料一起开始梳理。`);
    }
  }

  function submit(value = message) {
    const text = value.trim();
    if (!text) {
      setNotice("请先描述您想办理的事情。");
      return;
    }
    try { sessionStorage.setItem("smart-ai:initial-message", maskSensitiveText(text)); }
    catch { setNotice("浏览器禁止保存输入，请在下一页重新描述。"); }

    const materialText = materials.map((item) => item.text).join("\n");
    const service = detectServiceType(materialText || text);
    const scenarioKey = service === "medical_insurance" ? "medical" : service === "student_aid" ? "student" : service === "elderly_disability_service" ? "elderly" : "";
    router.push(scenarioKey ? `/task/new?scenario=${scenarioKey}` : "/task/new");
  }

  function startVoice() {
    const scope = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Recognition = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
    if (!Recognition) {
      setNotice("请使用 Edge 或 Chrome 的语音识别，或直接输入文字。");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) => event.results[index][0]?.transcript ?? "").join("");
      if (transcript) setMessage((current) => `${current}${transcript}`.slice(0, 2000));
    };
    recognition.onerror = () => { setNotice("语音识别没有成功，请改用文字输入。"); setListening(false); };
    recognition.onend = () => setListening(false);
    setListening(true);
    setNotice("正在听您说，请直接描述要办理的事情。");
    recognition.start();
  }

  return (
    <>
      <label className="sr-only" htmlFor="task-message">描述您想办理的事情</label>
      <div className="prompt-box">
        <textarea
          id="task-message"
          value={message}
          onChange={(event) => { setMessage(event.target.value); setNotice(""); }}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") submit();
          }}
          placeholder="例如：帮家人咨询医保缴费、学生资助或老年服务的办理。"
        />
      </div>
      <div className="compose-footer">
        <div className="attach-actions">
          <button className="small-action" type="button" onClick={() => setUploadOpen(true)}><Paperclip size={16} aria-hidden="true" />上传材料或图片</button>
          <button className="small-action" type="button" onClick={startVoice} disabled={listening}><AudioLines size={16} aria-hidden="true" />{listening ? "正在听…" : "语音描述"}</button>
        </div>
        <button className="primary-button" type="button" onClick={() => submit()}>
          开始梳理 <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
      {materials.length > 0 && (
        <p className="document-file">已选择 {materials.length} 份材料：{materials.map((item) => item.name).join("、")}</p>
      )}
      {notice && <p className="notice" role="status">{notice}</p>}

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onComplete={(files, failures) => handleUploaded(files, failures)}
      />
    </>
  );
}
