"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, MapPin, Mic, Paperclip, Send, ShieldCheck, Square, Volume2 } from "lucide-react";
import { useAccessibilityPreferences } from "@/components/accessibility-provider";
import { MaterialReportView } from "@/components/material-report";
import { UploadDialog, type ParsedMaterial } from "@/components/upload-dialog";
import { detectRegion, detectServiceType, detectYear } from "@/lib/documents/extract";
import { amapSearchUrl, mapKeyword } from "@/lib/geo/map";
import { postJson } from "@/lib/http";

type Guidance = {
  understanding: string;
  questions: Array<{ question: string; why: string; examples: string[]; options?: string[] }>;
  steps: Array<{ title: string; detail: string; where: string; materials: string[]; note: string }>;
  materials: string[];
  riskNotes: string[];
  citations: string[];
  replies?: Array<{ id: string; kind: "question" | "other"; question: string; answer: string; citations: string[]; createdAt: string }>;
  localCoverage?: boolean;
  answered?: boolean;
  generatedBy: "deepseek" | "rules";
  web: { used: boolean; provider: string | null; results: Array<{ title: string; url: string; snippet: string }>; note: string | null };
  updatedAt: string;
};

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
  guidance?: Guidance | null;
};

type Props = {
  initialTask?: Task;
  initialMessage?: string;
  placeholder?: string;
  scenario?: "medical_insurance" | "student_aid" | "elderly_disability_service";
};

export function TaskWorkspace({ initialTask, initialMessage = "", placeholder, scenario }: Props) {
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
  const [materials, setMaterials] = useState<ParsedMaterial[]>([]);
  const [serviceHint, setServiceHint] = useState<typeof scenario>(scenario);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [answerStep, setAnswerStep] = useState(0);
  const [draftAnswers, setDraftAnswers] = useState<Array<{ question: string; answer: string } | undefined>>([]);
  const [freeAnswer, setFreeAnswer] = useState("");
  const [freeFor, setFreeFor] = useState<"none" | "question" | "followup">("none");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [supplement, setSupplement] = useState("");
  const [wizardOpen, setWizardOpen] = useState(
    Boolean(initialTask?.guidance?.questions?.length) && !initialTask?.guidance?.answered,
  );
  const [resultVisible, setResultVisible] = useState(
    Boolean(initialTask?.guidance?.answered || (initialTask?.guidance && !initialTask.guidance.questions?.length)),
  );
  const [hasAnswered, setHasAnswered] = useState(Boolean(initialTask?.guidance?.answered));
  const [lastQuestions, setLastQuestions] = useState<Guidance["questions"]>(initialTask?.guidance?.questions ?? []);
  const justAnsweredRef = useRef(false);
  const lastResetStamp = useRef<string | undefined>(initialTask?.guidance?.updatedAt);
  const guidanceRef = useRef<HTMLElement | null>(null);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const lastGuidanceAt = useRef<string | undefined>(initialTask?.guidance?.updatedAt);
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

  useEffect(() => {
    const stamp = task?.guidance?.updatedAt;
    if (!stamp || stamp === lastGuidanceAt.current) return;
    lastGuidanceAt.current = stamp;
    guidanceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [task?.guidance?.updatedAt]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("smart-ai:material");
      if (!raw) return;
      const payload = JSON.parse(raw) as { at?: number; files?: ParsedMaterial[]; region?: string; year?: string };
      // 超时（10 分钟）就丢弃，避免回到新建页时出现上次的材料
      if (!payload.at || Date.now() - payload.at > 10 * 60 * 1000) {
        sessionStorage.removeItem("smart-ai:material");
        return;
      }
      if (Array.isArray(payload.files) && payload.files.length) setMaterials(payload.files);
      if (!initialTask) {
        if (payload.region) setRegion(payload.region);
        if (payload.year) setYear(payload.year);
        // 保留给“识别事项”后的任务页继续读取
        return;
      }
      // 任务页读取一次即清理，避免串到别的任务
      sessionStorage.removeItem("smart-ai:material");
    } catch { /* 浏览器禁用存储时忽略 */ }
  }, [initialTask]);

  const guidanceQuestions = task?.guidance?.questions ?? [];
  // 回答完一轮后模型可能不再出问题；保留上一轮的问题，方便用户点“重新确认”改答案。
  const wizardQuestions = guidanceQuestions.length ? guidanceQuestions : lastQuestions;
  const currentQuestion = wizardQuestions[answerStep];
  const answeredList = draftAnswers.filter((item): item is { question: string; answer: string } => Boolean(item));

  useEffect(() => {
    const questions = task?.guidance?.questions ?? [];
    if (questions.length) setLastQuestions(questions);
    // task 引用变化时同步一次，回答后模型不再出问题也能保留上一轮的问题。
  }, [task]);

  useEffect(() => {
    const stamp = task?.guidance?.updatedAt;
    if (!stamp || stamp === lastResetStamp.current) return;
    lastResetStamp.current = stamp;
    const answeredNow = justAnsweredRef.current;
    const questionCount = task?.guidance?.questions?.length ?? 0;
    setAnswerStep(0);
    setDraftAnswers([]);
    setFreeAnswer("");
    setSupplement("");
    setFreeFor("none");
    // 刚回答完一轮时收起选项卡，改由“重新确认”按钮唤出。
    setWizardOpen(!answeredNow);
    // 办理顺序只在回答完之后出现；本来就没有问题时直接展示。
    setResultVisible(answeredNow || Boolean(task?.guidance?.answered) || questionCount === 0);
    justAnsweredRef.current = false;
  }, [task]);

  function submitAnswers(list: Array<{ question: string; answer: string } | undefined>, note = "") {
    const active = task;
    if (!active) return;
    const payload = list.filter((item): item is { question: string; answer: string } => Boolean(item?.answer?.trim()));
    if (note.trim()) payload.push({ question: "补充说明", answer: note.trim() });
    if (!payload.length) {
      setWizardOpen(false);
      setResultVisible(true);
      return;
    }
    void run(async () => {
      const data = await postJson<{ task?: Task; message?: string }>("/api/chat", {
        taskId: active.id,
        region: region.trim() || undefined,
        year: year || undefined,
        answers: payload,
      }, 90000);
      justAnsweredRef.current = true;
      setHasAnswered(true);
      if (data.task) setTask(data.task);
      setDraftAnswers([]);
      setSupplement("");
      setAnswerStep(0);
      setWizardOpen(false);
      setResultVisible(true);
      setNotice(data.message ?? "已更新解答。");
    });
  }

  function chooseAnswer(value: string) {
    if (!currentQuestion) return;
    const next = [...draftAnswers];
    next[answerStep] = { question: currentQuestion.question, answer: value.trim() };
    setDraftAnswers(next);
    setFreeAnswer("");
    setFreeFor("none");
    // 选题只负责推进，最后一题之后进入“补充说明”页，由用户确认再生成方案。
    setAnswerStep(answerStep + 1);
  }

  function skipQuestion() {
    setFreeAnswer("");
    setFreeFor("none");
    setAnswerStep(answerStep + 1);
  }

  function submitFollowUp(text: string) {
    const active = task;
    if (!active?.guidance || !text.trim()) return;
    void run(async () => {
      const data = await postJson<{ task?: Task; message?: string }>("/api/chat", {
        taskId: active.id,
        followUp: { kind: "question", text: text.trim() },
      }, 60000);
      if (data.task) setTask(data.task);
      setFollowUpDraft("");
      setFreeFor("none");
      setNotice(data.message ?? "已回复。");
    });
  }

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

  async function createTask(overrides?: { message?: string; region?: string; year?: string; auto?: boolean; serviceType?: typeof scenario }) {
    const text = (overrides?.message ?? message).trim();
    if (!text) {
      setNotice("请先描述您想办理的事情。");
      return;
    }
    const data = await postJson<Task>("/api/tasks", { message: text, serviceType: overrides?.serviceType ?? serviceHint });
    setTask(data);

    const regionValue = (overrides?.region ?? region).trim();
    const yearValue = overrides?.year ?? year;
    const canAuto = Boolean(regionValue)
      && (data.serviceType !== "medical_insurance" || /^\d{4}$/.test(yearValue));
    if ((overrides?.auto ?? Boolean(regionValue)) && canAuto) {
      setNotice("已识别事项，正在检索政策并整理办理顺序…");
      const result = await postJson<{ task?: Task; message?: string }>("/api/chat", {
        taskId: data.id,
        region: regionValue,
        year: yearValue || undefined,
      }, 50000);
      if (result.task) setTask(result.task);
      setNotice(result.message ?? "处理完成。");
      // 生成完再切路由，避免服务端渲染用旧数据把刚生成的解答覆盖掉
      router.replace(`/task/${data.id}`);
      return;
    }
    router.replace(`/task/${data.id}`);
    setNotice(data.missingFields.length ? `还需要确认：${data.missingFields.join("、")}` : "已识别事项，可以继续检索。");
  }

  async function continueTask(extra?: string) {
    if (!task) return;
    const supplied = (extra ?? clarification).trim();
    if (task.serviceType === "unknown" && !supplied) {
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
      clarification: supplied || undefined,
    }, 50000);
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
      setNotice("请使用 Edge 或 Chrome 的语音识别，或直接输入文字。");
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
      setNotice("请使用 Edge 或 Chrome 的语音播报，或阅读文字版。");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  async function handleUploaded(files: ParsedMaterial[], failures: string[]) {
    setMaterials(files);
    const combined = files.map((item) => item.text).join("\n").slice(0, 6000);
    const detectedRegion = detectRegion(combined);
    const detectedYear = detectYear(combined);
    const detectedService = detectServiceType(combined);
    if (detectedService) setServiceHint(detectedService);
    if (detectedRegion) setRegion(detectedRegion);
    if (detectedYear) setYear(detectedYear);
    const summary = failures.length
      ? `已解析 ${files.length} 份，另有 ${failures.length} 份失败。`
      : `已解析 ${files.length} 份材料。`;

    if (task) {
      setNotice(`${summary}报告见下方。`);
      return;
    }

    const text = message.trim();
    if (!text) {
      // 没有文字时，先按材料替用户起一句话，让用户确认或改写后再开始
      setMessage(buildMaterialPrompt(files));
      setNotice(`${summary}下面这句是按材料起的头，请确认或改成您想问的，再点“识别事项”。`);
      window.setTimeout(() => messageRef.current?.focus(), 60);
      return;
    }

    setNotice(`${summary}正在按材料开始识别…`);
    await run(async () => {
      await createTask({
        message: text,
        region: detectedRegion || region,
        year: detectedYear || year,
        auto: true,
        serviceType: detectedService || serviceHint,
      });
    });
  }

  function buildMaterialPrompt(files: ParsedMaterial[]): string {
    const label = files.length > 1 ? `${files.length} 份材料` : `《${files[0].name}》`;
    return `我上传了${label}，想确认这件事现在该怎么办理、需要带哪些材料、我准备的是否齐全。`;
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
          <p>{task?.missingFields.length ? `为了避免判断错误，还需要您补充：${task.missingFields.join("、")}。` : task ? "信息已补齐。系统会展示可追溯的政策证据，并提示需要人工确认的部分。" : "可以用文字或语音描述要办理的事情。系统会先识别事项，再追问必要信息。"}</p>
          {task?.aiSummary && <p className="ai-summary">{task.aiSummary}</p>}
        </div>
        {task && <div className="message-card user"><strong>您描述的情况</strong><p>{task.message}</p></div>}
        {!task && <div className="task-input-area"><textarea ref={messageRef} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={placeholder ?? "例如：帮家人咨询医保缴费、学生资助或老年服务的办理。"} aria-label="描述办理需求" /><div className="input-actions"><button className="small-action" type="button" onClick={() => setUploadOpen(true)}><Paperclip size={16} />上传材料或图片</button><button className="small-action" type="button" onClick={startVoice}><Mic size={16} />{isListening ? "正在听" : "语音输入"}</button><button className="primary-button" type="button" disabled={pending} onClick={() => void run(createTask)}><Send size={16} />识别事项</button></div></div>}
        {task?.missingFields.length ? <div className="clarify-form">{task.serviceType === "unknown" ? <label className="clarify-wide">请描述具体办理事项<input value={clarification} onChange={(event) => setClarification(event.target.value)} placeholder="例如：居民医保缴费咨询" /></label> : <><label>所在省、市、区<input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="例如：北京市朝阳区" /></label>{task.serviceType === "medical_insurance" && <label>办理年份<input value={year} onChange={(event) => setYear(event.target.value)} inputMode="numeric" /></label>}</>}<button className="primary-button" type="button" disabled={pending} onClick={() => void run(continueTask)}><Send size={16} />继续梳理</button></div> : task && <div className="task-actions"><button className="primary-button" type="button" disabled={pending} onClick={() => void run(continueTask)}><Send size={16} />重新检查任务</button><button className="small-action" type="button" disabled={pending} onClick={() => setUploadOpen(true)}><Paperclip size={16} />上传材料解析</button></div>}
        {pending && <p role="status">正在处理，请稍候…</p>}
        {notice && <p className="notice" role="status">{notice}</p>}

        {materials.length > 0 && (
          <details className="material-report-details">
            <summary>
              <span className="eyebrow">材料解析</span>
              已解析 {materials.length} 份材料，查看核对报告
            </summary>
            <div className="material-report-list">
              {materials.slice(0, 3).map((item) => (
                <MaterialReportView key={`${item.name}-${item.size}`} report={item.report} />
              ))}
              {materials.length > 3 && <p className="notice">另有 {materials.length - 3} 份材料已解析，报告只展示前 3 份。</p>}
            </div>
          </details>
        )}

        {task?.guidance && (
          <section className="guidance-panel" aria-labelledby="guidance-heading" ref={guidanceRef}>
            <div className="guidance-head">
              <div>
                <span className="eyebrow">本地知识库 · 办理路径</span>
                <h3 id="guidance-heading">您这件事，可以这样办</h3>
              </div>
              <span className="status-pill">{task.guidance.generatedBy === "deepseek" ? "DeepSeek 生成" : "规则兜底"}</span>
            </div>

            {wizardQuestions.length > 0 && (
              <div className="guidance-block">
                {wizardOpen ? (
                  <>
                    <div className="wizard-head">
                      <h4>先跟您确认 {wizardQuestions.length} 件事</h4>
                      {currentQuestion && <span className="wizard-progress">第 {Math.min(answerStep + 1, wizardQuestions.length)} / {wizardQuestions.length} 题</span>}
                    </div>
                    <p className="guidance-hint">点一下就行，选完接着问下一件；不确定的可以先跳过。</p>

                    {answeredList.length > 0 && (
                      <div className="answer-chips" aria-label="已经选择的回答">
                        {answeredList.map((item, index) => (
                          <span className="answer-chip" key={`${item.question}-${index}`}>{item.answer}</span>
                        ))}
                      </div>
                    )}

                    {currentQuestion ? (
                      <div className="question-card">
                        <strong>{currentQuestion.question}</strong>
                        {currentQuestion.why && <span className="question-why">为什么问：{currentQuestion.why}</span>}
                        <div className="option-grid">
                          {(currentQuestion.options ?? []).map((option) => (
                            <button key={option} type="button" className="option-button" disabled={pending} onClick={() => chooseAnswer(option)}>
                              <span className="option-text">{option}</span>
                            </button>
                          ))}
                          <button
                            type="button"
                            className={`option-button option-other ${freeFor === "question" ? "is-open" : ""}`}
                            disabled={pending}
                            onClick={() => setFreeFor(freeFor === "question" ? "none" : "question")}
                          >
                            <span className="option-text">其他（自己说）</span>
                          </button>
                        </div>
                        {freeFor === "question" && (
                          <div className="option-free">
                            <input
                              value={freeAnswer}
                              onChange={(event) => setFreeAnswer(event.target.value)}
                              placeholder="用一句话说说您的实际情况"
                              aria-label="其他情况的说明"
                              onKeyDown={(event) => {
                                if (event.key === "Enter" && freeAnswer.trim()) {
                                  event.preventDefault();
                                  chooseAnswer(freeAnswer);
                                }
                              }}
                            />
                            <button className="primary-button" type="button" disabled={pending || !freeAnswer.trim()} onClick={() => chooseAnswer(freeAnswer)}>
                              确定
                            </button>
                          </div>
                        )}
                        <div className="wizard-actions">
                          {answerStep > 0 && (
                            <button className="small-action" type="button" disabled={pending} onClick={() => { setAnswerStep(Math.max(0, answerStep - 1)); setFreeFor("none"); }}>上一题</button>
                          )}
                          <button className="small-action" type="button" disabled={pending} onClick={skipQuestion}>跳过这题</button>
                          </div>
                      </div>
                    ) : (
                      <div className="wizard-finish">
                        <p className="guidance-hint">问题过了一遍。还有别的想补充的，可以写在这里（选填），方案会更贴合您的情况。</p>
                        <label className="wizard-note-label" htmlFor="wizard-note">补充说明（选填）</label>
                        <textarea
                          id="wizard-note"
                          className="wizard-note"
                          value={supplement}
                          onChange={(event) => setSupplement(event.target.value)}
                          placeholder="例如：父亲是低保户、去年住过院；我在外地，只能周末回来办。"
                        />
                        <div className="wizard-actions">
                          <button className="primary-button" type="button" disabled={pending} onClick={() => submitAnswers(draftAnswers, supplement)}>
                            生成办理方案
                          </button>
                          <button className="small-action" type="button" disabled={pending} onClick={() => submitAnswers(draftAnswers)}>
                            跳过补充
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="wizard-collapsed">
                    <div className="wizard-collapsed-text">
                      <h4>{hasAnswered ? `已确认的 ${wizardQuestions.length} 项信息` : `还需确认的 ${wizardQuestions.length} 项信息`}</h4>
                      <p className="guidance-hint">
                        {hasAnswered ? "下面的结论按这些信息生成。如有不符，可重新选择。" : "补充这几项后，结论会更贴合实际情况。"}
                      </p>
                    </div>
                    <button className="recheck-button" type="button" disabled={pending} onClick={() => setWizardOpen(true)}>
                      {hasAnswered ? "重新确认" : "去确认"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {resultVisible && (
              <>
            {task.guidance.steps.length > 0 && (
              <div className="guidance-block">
                <h4>从头到尾的办理顺序</h4>
                <ol className="guidance-steps">
                  {task.guidance.steps.map((step, index) => {
                    const where = step.where?.trim() || "就近的政务服务中心或社区服务站";
                    const keyword = mapKeyword(where);
                    return (
                      <li key={`${step.title}-${index}`}>
                        <span className="step-index">{index + 1}</span>
                        <div className="step-body">
                          <strong>{step.title}</strong>
                          <p>{step.detail}</p>
                          <dl className="step-meta">
                            <div>
                              <dt>去哪办</dt>
                              <dd>
                                {where}
                                {keyword && (
                                  <a className="step-map" href={amapSearchUrl(keyword, task.region)} target="_blank" rel="noreferrer">
                                    <MapPin size={12} aria-hidden="true" />在地图上找
                                  </a>
                                )}
                              </dd>
                            </div>
                            {step.materials.length > 0 && <div><dt>带什么</dt><dd>{step.materials.join("、")}</dd></div>}
                            {step.note && <div><dt>注意</dt><dd>{step.note}</dd></div>}
                          </dl>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {task.guidance.materials.length > 0 && (
              <div className="guidance-block">
                <h4>一次带齐的材料</h4>
                <ul className="material-chips">
                  {task.guidance.materials.map((material) => <li key={material}>{material}</li>)}
                </ul>
              </div>
            )}

            {task.guidance.riskNotes.length > 0 && (
              <div className="guidance-block risk-block">
                <h4><AlertTriangle size={15} aria-hidden="true" />需要您留意</h4>
                <ul>{task.guidance.riskNotes.map((note) => <li key={note}>{note}</li>)}</ul>
              </div>
            )}

            <div className="guidance-block">
              <h4>看完还有不清楚的</h4>
              <div className="guidance-actions">
                <button className={`small-action ${freeFor === "followup" ? "is-open" : ""}`} type="button" onClick={() => setFreeFor(freeFor === "followup" ? "none" : "followup")}>
                  我想继续追问
                </button>
              </div>

              {freeFor === "followup" && (
                <div className="follow-up-box">
                  <label htmlFor="followup-input">接着问，例如：家人代办要带什么？需要提前预约吗？</label>
                  <textarea
                    id="followup-input"
                    value={followUpDraft}
                    onChange={(event) => setFollowUpDraft(event.target.value)}
                    placeholder="把想问的写在这里，系统只依据知识库回答，答不上来会直说。"
                  />
                  <div className="follow-up-actions">
                    <button className="primary-button" type="button" disabled={pending || !followUpDraft.trim()} onClick={() => submitFollowUp(followUpDraft)}>
                      <Send size={16} />提交追问
                    </button>
                  </div>
                </div>
              )}
            </div>

            {(task.guidance.replies ?? []).length > 0 && (
              <div className="guidance-block">
                <h4>追问记录</h4>
                <ul className="reply-list">
                  {(task.guidance.replies ?? []).map((reply) => (
                    <li className="reply-item" key={reply.id}>
                      <p className="reply-question"><strong>{reply.kind === "other" ? "补充说明" : "追问"}</strong>{reply.question}</p>
                      <p className="reply-answer">{reply.answer}</p>
                      {reply.citations.length > 0 && <small>依据：{reply.citations.join("；")}</small>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="guidance-sources">
              <div>
                <strong>本地知识库依据</strong>
                {task.guidance.citations.length
                  ? <ul>{task.guidance.citations.map((title) => <li key={title}>{title}</li>)}</ul>
                  : <p>本次依据右侧证据面板中的检索结果整理。</p>}
              </div>
              <div>
                <strong>联网核验</strong>
                {task.guidance.web.used
                  ? <ul>{task.guidance.web.results.map((item) => <li key={item.url}><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a><span>{item.snippet}</span></li>)}</ul>
                  : <p>{task.guidance.web.note ?? "本次未启用联网核验，仅依据本地知识库作答。"}</p>}
              </div>
            </div>
            <p className="guidance-disclaimer">以上是办理指引，不是官方结论。金额、时限、资格以当地主管部门公布为准，正式办理仍需人工确认。</p>
              </>
            )}
          </section>
        )}
      </section>

      <aside className="task-evidence">
        <div className="panel-heading"><div><span className="eyebrow">依据与材料</span><h2>证据面板</h2></div></div>
        {task?.evidence.length ? task.evidence.map((item) => <article className="evidence-card" key={item.title}><div className="evidence-title"><CheckCircle2 size={16} />{item.title}</div><p>{item.quote}</p><small>{item.applicabilityReason}</small><a href={item.sourceUrl} target="_blank" rel="noreferrer">查看来源占位</a></article>) : <div className="empty-panel"><AlertTriangle size={19} /><p>补充地区和年份后，这里显示政策证据。没有证据时不会生成确定性结论。</p></div>}
        {task?.plan.length ? <article className="plan-card"><strong>现在可以做什么</strong><ol>{task.plan.map((item) => <li key={item}>{item}</li>)}</ol><div className="plan-actions"><button className="small-action" type="button" onClick={() => speak(task.plan.join("。"))}>{speaking ? <Square size={15} /> : <Volume2 size={15} />}语音播放</button>{!preferences.voiceGuide && <Link href="/onboarding">开启语音引导</Link>}</div></article> : null}
        {task?.status === "WAITING_CONFIRMATION" && <article className="confirmation-card"><strong>人工确认提示</strong><p>这是办理指引，不是官方结论。正式办理前，请向当地主管部门核对；此确认不会提交申请。</p><label><input checked={acknowledged || Boolean(task.userConfirmed)} disabled={task.userConfirmed} onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" />已了解上述办理范围</label>{!acknowledged && !task.userConfirmed && <small className="confirm-hint">勾选后才能记录确认。</small>}<button className="small-action" disabled={pending || !acknowledged || Boolean(task.userConfirmed)} title={!acknowledged && !task.userConfirmed ? "请先勾选“已了解上述办理范围”" : undefined} onClick={() => void run(confirmDemoBoundary)} type="button">{task.userConfirmed ? "已记录确认" : "确认并记录"}</button>{task.userConfirmed && <Link href={`/result/${task.id}`}>查看办理指南</Link>}</article>}
      </aside>

      <UploadDialog
        open={uploadOpen}
        serviceType={task?.serviceType && task.serviceType !== "unknown" ? task.serviceType : serviceHint}
        onClose={() => setUploadOpen(false)}
        onComplete={(files, failures) => void handleUploaded(files, failures)}
      />
    </div>
  );
}