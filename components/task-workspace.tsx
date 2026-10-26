"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileCheck2, Mic, Send, ShieldCheck, Square, Volume2 } from "lucide-react";

type Task = {
  id: string;
  message: string;
  title: string;
  status: string;
  riskLevel: string;
  missingFields: string[];
  knownFacts: string[];
  evidence: Array<{ title: string; quote: string; sourceUrl: string; section?: string; applicabilityReason: string }>;
  plan: string[];
};

type Props = { initialTask?: Task; initialMessage?: string };

export function TaskWorkspace({ initialTask, initialMessage = "" }: Props) {
  const router = useRouter();
  const [task, setTask] = useState<Task | undefined>(initialTask);
  const [message, setMessage] = useState(initialMessage);
  const [region, setRegion] = useState("");
  const [year, setYear] = useState("2026");
  const [notice, setNotice] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [document, setDocument] = useState<{ fileName: string; quality: number; message: string } | null>(null);
  const recognitionRef = useRef<{ start: () => void; stop: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null } | null>(null);

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
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await response.json() as Task;
    setTask(data);
    setNotice(data.missingFields.length ? `还需要确认：${data.missingFields.join("、")}` : "已识别事项，可以继续检索。");
    router.replace(`/task/${data.id}`);
  }

  async function continueTask() {
    if (!task) return;
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, region, year }),
    });
    const data = await response.json() as { task?: Task; message?: string };
    if (data.task) setTask(data.task);
    setNotice(data.message ?? "处理完成。");
  }

  function startVoice() {
    const SpeechRecognition = (window as typeof window & { SpeechRecognition?: new () => NonNullable<typeof recognitionRef.current> }).SpeechRecognition;
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
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, mimeType: file.type, size: file.size }),
    });
    const data = await response.json() as { fileName?: string; quality?: { score: number }; message?: string };
    setDocument({ fileName: data.fileName ?? file.name, quality: data.quality?.score ?? 0, message: data.message ?? "" });
    setNotice(data.message ?? "材料检查完成。");
  }

  const currentStatus = task?.status ?? "UNDERSTAND";
  const statusIndex = currentStatus === "CLARIFYING" ? 1 : currentStatus === "RETRIEVING" ? 2 : currentStatus === "CHECKING_DOCUMENTS" ? 3 : currentStatus === "WAITING_CONFIRMATION" ? 4 : 0;

  return (
    <div className="task-layout">
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
        <div className="message-card assistant"><strong>Smart AI</strong><p>{task?.missingFields.length ? `为了避免判断错误，还需要您补充：${task.missingFields.join("、")}。` : task ? "信息已补齐。我会展示可追溯的演示证据，并提示需要人工确认的部分。" : "您可以用文字或语音描述要办理的事情。我们会先识别事项，再追问必要信息。"}</p></div>
        {task && <div className="message-card user"><strong>您描述的情况</strong><p>{task.message}</p></div>}
        {!task && <div className="task-input-area"><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="例如：我想帮父亲了解今年居民医保怎么缴费，他行动不太方便。" aria-label="描述办理需求" /><div className="input-actions"><button className="small-action" type="button" onClick={startVoice}><Mic size={16} />{isListening ? "正在听" : "语音输入"}</button><button className="primary-button" type="button" onClick={createTask}><Send size={16} />识别事项</button></div></div>}
        {task?.missingFields.length ? <div className="clarify-form"><label>所在省、市、区<input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="演示地区" /></label><label>办理年份<input value={year} onChange={(event) => setYear(event.target.value)} inputMode="numeric" /></label><button className="primary-button" type="button" onClick={continueTask}><Send size={16} />继续检索</button></div> : task && <div className="task-actions"><button className="primary-button" type="button" onClick={continueTask}><Send size={16} />重新检查任务</button><label className="small-action upload-button"><FileCheck2 size={16} />检查材料<input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(event) => event.target.files?.[0] && reviewFile(event.target.files[0])} /></label></div>}
        {notice && <p className="notice" role="status">{notice}</p>}
      </section>

      <aside className="task-evidence">
        <div className="panel-heading"><div><span className="eyebrow">依据与材料</span><h2>证据面板</h2></div></div>
        {task?.evidence.length ? task.evidence.map((item) => <article className="evidence-card" key={item.title}><div className="evidence-title"><CheckCircle2 size={16} />{item.title}</div><p>{item.quote}</p><small>{item.applicabilityReason}</small><a href={item.sourceUrl} target="_blank" rel="noreferrer">查看来源占位</a></article>) : <div className="empty-panel"><AlertTriangle size={19} /><p>补充地区和年份后，这里显示政策证据。没有证据时不会生成确定性结论。</p></div>}
        {document && <article className="evidence-card material-card"><div className="evidence-title"><FileCheck2 size={16} />材料已检查</div><p>{document.fileName}</p><div className="quality-meter"><span style={{ width: `${document.quality * 100}%` }} /></div><small>质量评分 {Math.round(document.quality * 100)}%，原始文件未保存。</small></article>}
        {task?.plan.length ? <article className="plan-card"><strong>现在可以做什么</strong><ol>{task.plan.map((item) => <li key={item}>{item}</li>)}</ol><button className="small-action" type="button" onClick={() => speak(task.plan.join("。"))}>{speaking ? <Square size={15} /> : <Volume2 size={15} />}语音播放</button></article> : null}
      </aside>
    </div>
  );
}
