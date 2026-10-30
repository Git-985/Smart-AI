"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, AudioLines, Paperclip } from "lucide-react";
import { maskSensitiveText } from "@/lib/security/pii";

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
  const router = useRouter();

  function submit(value = message) {
    const text = value.trim();
    if (!text) {
      setNotice("请先描述您想办理的事情。");
      return;
    }
    try { sessionStorage.setItem("smart-ai:initial-message", maskSensitiveText(text)); }
    catch { setNotice("浏览器禁止保存输入，请在下一页重新描述。"); }
    router.push("/task/new");
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
          placeholder="例如：我想帮父亲了解今年居民医保怎么缴费，他行动不太方便。"
        />
      </div>
      <div className="compose-footer">
        <div className="attach-actions">
          <button className="small-action" type="button" onClick={() => router.push("/documents")}><Paperclip size={16} aria-hidden="true" />材料解析</button>
          <button className="small-action" type="button" onClick={startVoice} disabled={listening}><AudioLines size={16} aria-hidden="true" />{listening ? "正在听…" : "语音描述"}</button>
        </div>
        <button className="primary-button" type="button" onClick={() => submit()}>
          开始梳理 <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
      {notice && <p className="notice" role="status">{notice}</p>}
    </>
  );
}
