"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, AudioLines, Paperclip } from "lucide-react";
import { maskSensitiveText } from "@/lib/security/pii";

export function StartTask() {
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
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
          <button className="small-action" type="button" onClick={() => setNotice("材料上传将在后续阶段接入。请勿上传真实证件。")}><Paperclip size={16} aria-hidden="true" />添加材料</button>
          <button className="small-action" type="button" onClick={() => setNotice("语音输入将在后续阶段接入，您可以先使用文字描述。")}><AudioLines size={16} aria-hidden="true" />语音描述</button>
        </div>
        <button className="primary-button" type="button" onClick={() => submit()}>
          开始梳理 <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
      {notice && <p className="notice" role="status">{notice}</p>}
    </>
  );
}
