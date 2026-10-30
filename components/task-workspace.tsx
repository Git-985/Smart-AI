"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileCheck2, Mic, Send, ShieldCheck, Square, Volume2 } from "lucide-react";
import { useAccessibilityPreferences } from "@/components/accessibility-provider";
import { postJson } from "@/lib/http";

type Task = {
  id: string;
  message: string;
  serviceType: string;
  title: string;
  status: string;
  riskLevel: string;
  missingFields: string[];
  knownFacts: string[];
  evidence: Array<{ title: string; quote: string; sourceUrl: string; section?: string; applicabilityReason: string }>;
  plan: string[];
  userConfirmed?: boolean;
  region?: string;
  year?: string;
  analysisSource?: "deepseek" | "rules";
  aiSummary?: string;
};

type Props = { initialTask?: Task; initialMessage?: string };

export function TaskWorkspace({ initialTask, initialMessage = "" }: Props) {
  const router = useRouter();
  const { preferences } = useAccessibilityPreferences();
  const [task, setTask] = useState<Task | undefined>(initialTask);
  const [message, setMessage] = useState(initialMessage);
  const [region, setRegion] = useState(initialTask?.region ?? "");
  const [year, setYear] = useState(initialTask?.year ?? String(new Date().getFullYear()));
  const [clarification, setClarification] = useState("");
  const [notice, setNotice] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [document, setDocument] = useState<{ label: string; message: string } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const recognitionRef = useRef<{ start: () => void; stop: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null } | null>(null);

  useEffect(() => {
    if (!initialTask) {
      try {
        const saved = sessionStorage.getItem("smart-ai:initial-message");
        if (saved) {
          setMessage(saved);
          sessionStorage.removeItem("smart-ai:initial-message");
        }
      } catch { /* Text entry is still available when storage is blocked. */ }
    }
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, [initialTask]);

  async function run(action: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    try { await action(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "处理失败，请重试。"); }
    finally { setPending(false); }
  }

  const stages = useMemo(() => [
    ["UNDERSTAND", "理解需求"],
    ["CLARIFY", "补充信息"],
    ["RETRIEVE", "检索政策"],
    ["CHECK_DOCUMENTS", "检查材料"],
    ["CONFIRM", "人工确认"],
  ], []);

  async function createTask() {
    if (!message.trim()) {
      setNotice("请先描述您想办理的事情。");
      return;
    }
    const data = await postJson<Task>("/api/tasks", { message });
    setTask(data);
    setNotice(data.missingFields.length ? `还需要确认：${data.missingFields.join("、")}` : "已识别事项，可以继续检索。");
    router.replace(`/task/${data.id}`);
  }

  async function continueTask() {
    if (!task) return;
    if (task.serviceType === "unknown" && !clarification.trim()) {
      setNotice("请先说明您想办理的具体事项。");
      return;
    }
    if (task.serviceType !== "unknown" && (!region.trim() || (task.serviceType === "medical_insurance" && !/^\d{4}$/.test(year)))) {
      setNotice("请填写办理地区和四位数年份后继续。");
      return;
    }
    const data = await postJson<{ task?: Task; message?: string }>("/api/chat", {
      taskId: task.id,
      region: region.trim() || undefined,
      year: year || undefined,
      clarification: clarification.trim() || undefined,
    });
    if (data.task) setTask(data.task);
    setClarification("");
    setAcknowledged(false);
    setNotice(data.message ?? "处理完成。");
  }

  function startVoice() {
    const voiceWindow = window as typeof window & {
      SpeechRecognition?: new () => NonNullable<typeof recognitionRef.current>;
      webkitSpeechRecognition?: new () => NonNullable<typeof recognitionRef.current>;
    };
    const SpeechRecognition = voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotice("当前浏览器不支持语音输入，请使用文字输入。");
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join("");
      setMessage((current) => `${current}${transcript}`);
    };
    recognition.onend = () => setIsListening(false);
    setIsListening(true);
    recognition.start();
  }

  function speak(text: string) {
    if (speaking) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      return;
    }
    if (!preferences.voiceGuide) {
      setNotice("请先在无障碍设置中开启语音引导。");
      return;
    }
    if (!("speechSynthesis" in window)) {
      setNotice("当前浏览器不支持语音播报，请阅读文字版。");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  async function reviewFile(file: File) {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setNotice("只支持 JPG、PNG 或 PDF 文件。");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setNotice("文件大小不能超过 10MB。");
      return;
    }
    const data = await postJson<{ mimeType?: string; message?: string }>("/api/documents", { mimeType: file.type, size: file.size });
    setDocument({ label: data.mimeType ?? file.type, message: data.message ?? "" });
    setNotice(data.message ?? "材料检查完成。");
  }

  async function confirmDemoBoundary() {
    if (!task) return;
    const data = await postJson<{ message?: string; acknowledged?: boolean }>("/api/confirmations", { taskId: task.id, acknowledged });
    setTask({ ...task, userConfirmed: data.acknowledged });
    setNotice(data.message ?? "确认已记录。");
  }

  const currentStatus = task?.status ?? "UNDERSTAND";
  const statusIndex = currentStatus === "CLARIFYING" ? 1 : currentStatus === "RETRIEVING" ? 2 : currentStatus === "CHECKING_DOCUMENTS" ? 3 : currentStatus === "WAITING_CONFIRMATION" ? 4 : 0;

  return (
    <div className="task-layout" aria-busy={pending}>
      <aside className="task-sidebar">
        <span className="eyebrow">办理任务</span>
        <h1 className="task-title">{task?.title ?? "开始梳理一件事"}</h1>
        <div className="task-timeline" aria-label="任务进度">
          {stages.map(([key, label], index) => (
            <div className={`timeline-item ${index <= statusIndex ? "active" : ""}`} key={key}>
              <span className="timeline-dot">{index < statusIndex ? <CheckCircle2 size={15} /> : index + 1}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="risk-card">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>涉及资格、缴费或权益时，结果需要人工确认。</span>
        </div>
      </aside>

      <section className="task-center">
        <div className="panel-heading"><div><span className="eyebrow">AI 办理引导</span><h2>先把情况说明白</h2></div><span className="status-pill">{task ? task.status : "未开始"}</span></div>
        <div className="message-card assistant">
          <strong>Smart AI</strong>
          {task?.analysisSource === "deepseek" && <span className="ai-badge">DeepSeek 解析</span>}
          <p>{task?.missingFields.length ? `为了避免判断错误，还需要您补充：${task.missingFields.join("、")}。` : task ? "信息已补齐。我会展示可追溯的演示证据，并提示需要人工确认的部分。" : "您可以用文字或语音描述要办理的事情。我们会先识别事项，再追问必要信息。"}</p>
          {task?.aiSummary && <p className="ai-summary">{task.aiSummary}</p>}
        </div>
        {task && <div className="message-card user"><strong>您描述的情况</strong><p>{task.message}</p></div>}
        {!task && <div className="task-input-area"><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="例如：我想帮父亲了解今年居民医保怎么缴费，他行动不太方便。" aria-label="描述办理需求" /><div className="input-actions"><button className="small-action" type="button" onClick={startVoice}><Mic size={16} />{isListening ? "正在听" : "语音输入"}</button><button className="primary-button" type="button" disabled={pending} onClick={() => void run(createTask)}><Send size={16} />识别事项</button></div></div>}
        {task?.missingFields.length ? <div className="clarify-form">{task.serviceType === "unknown" ? <label className="clarify-wide">请描述具体办理事项<input value={clarification} onChange={(event) => setClarification(event.target.value)} placeholder="例如：居民医保缴费咨询" /></label> : <><label>所在省、市、区<input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="例如：演示地区" /></label>{task.serviceType === "medical_insurance" && <label>办理年份<input value={year} onChange={(event) => setYear(event.target.value)} inputMode="numeric" /></label>}</>}<button className="primary-button" type="button" disabled={pending} onClick={() => void run(continueTask)}><Send size={16} />继续梳理</button></div> : task && <div className="task-actions"><button className="primary-button" type="button" disabled={pending} onClick={() => void run(continueTask)}><Send size={16} />重新检查任务</button><label className="small-action upload-button"><FileCheck2 size={16} />材料格式检查<input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void run(() => reviewFile(file)); event.currentTarget.value = ""; }} /></label><Link className="small-action" href={`/family/${task.id}`}>家属协助</Link></div>}
        {pending && <p role="status">正在处理，请稍候…</p>}
        {notice && <p className="notice" role="status">{notice}</p>}
      </section>

      <aside className="task-evidence">
        <div className="panel-heading"><div><span className="eyebrow">依据与材料</span><h2>证据面板</h2></div></div>
        {task?.evidence.length ? task.evidence.map((item) => <article className="evidence-card" key={item.title}><div className="evidence-title"><CheckCircle2 size={16} />{item.title}</div><p>{item.quote}</p><small>{item.applicabilityReason}</small><a href={item.sourceUrl} target="_blank" rel="noreferrer">查看来源占位</a></article>) : <div className="empty-panel"><AlertTriangle size={19} /><p>补充地区和年份后，这里显示政策证据。没有证据时不会生成确定性结论。</p></div>}
        {document && <article className="evidence-card material-card"><div className="evidence-title"><FileCheck2 size={16} />材料信息已检查</div><p>已选择的文件类型：{document.label}</p><small>{document.message}</small></article>}
        {task?.plan.length ? <article className="plan-card"><strong>现在可以做什么</strong><ol>{task.plan.map((item) => <li key={item}>{item}</li>)}</ol><div className="plan-actions"><button className="small-action" type="button" onClick={() => speak(task.plan.join("。"))}>{speaking ? <Square size={15} /> : <Volume2 size={15} />}语音播放</button>{!preferences.voiceGuide && <Link href="/onboarding">开启语音引导</Link>}</div></article> : null}
        {task?.status === "WAITING_CONFIRMATION" && <article className="confirmation-card"><strong>人工确认提示</strong><p>这是演示指引，不是官方结论。正式办理前，请向当地主管部门核对；此确认不会提交申请。</p><label><input checked={acknowledged || Boolean(task.userConfirmed)} disabled={task.userConfirmed} onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" />我已了解上述演示范围</label><button className="small-action" disabled={pending || !acknowledged || Boolean(task.userConfirmed)} onClick={() => void run(confirmDemoBoundary)} type="button">{task.userConfirmed ? "已记录确认" : "确认并记录"}</button>{task.userConfirmed && <Link href={`/result/${task.id}`}>查看演示指南</Link>}</article>}
      </aside>
    </div>
  );
}