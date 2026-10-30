"use client";

import { useEffect, useState, type FormEvent } from "react";

type Policy = {
  policyId: string;
  title: string;
  serviceType: string;
  region: string | null;
  effectiveAt: string | null;
  expiredAt: string | null;
  quote: string;
  sourceUrl: string;
  section?: string;
  relevance: number;
  applicabilityReason: string;
};

const EMPTY = {
  title: "",
  serviceType: "medical_insurance",
  region: "全国",
  effectiveAt: "2026-01-01",
  expiredAt: "",
  quote: "",
  sourceUrl: "https://www.gov.cn/",
  section: "政策摘要",
  relevance: "0.9",
  applicabilityReason: "按事项、地区和时间匹配后展示，具体以官方原文为准。",
};

export function PolicyAdmin() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [token, setToken] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  async function load() {
    const response = await fetch("/api/policies", { cache: "no-store" });
    const data = await response.json().catch(() => ({ policies: [] }));
    setPolicies(data.policies ?? []);
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setNotice("");
    try {
      const response = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({
          ...form,
          effectiveAt: form.effectiveAt || null,
          expiredAt: form.expiredAt || null,
          relevance: Number(form.relevance) || 0.9,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error === "UNAUTHORIZED" ? "管理口令不正确。" : "保存失败，请检查字段。");
      setForm(EMPTY);
      await load();
      setNotice("已保存一条政策。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("确认删除这条政策？")) return;
    const response = await fetch(`/api/policies?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "x-admin-token": token },
    });
    if (response.ok) await load();
    else setNotice("删除失败；如果配置了 ADMIN_TOKEN，请先填写口令。");
  }

  const field = (key: keyof typeof EMPTY, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section className="compose">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <span className="eyebrow">政策库</span>
            <h1 style={{ fontSize: 30 }}>政策知识库管理</h1>
            <p className="intro-copy">当前共 {policies.length} 条。新增或导入后，任务检索立即使用 SQLite 中的最新条目。</p>
          </div>
          <label style={{ minWidth: 220 }}>
            管理口令（配置 ADMIN_TOKEN 时必填）
            <input value={token} onChange={(event) => setToken(event.target.value)} type="password" placeholder="可选" />
          </label>
        </div>

        <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 18 }}>
          <label>政策标题<input required value={form.title} onChange={(event) => field("title", event.target.value)} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            <label>事项
              <select value={form.serviceType} onChange={(event) => field("serviceType", event.target.value)}>
                <option value="medical_insurance">居民医保</option>
                <option value="student_aid">学生资助</option>
                <option value="elderly_disability_service">老年与残障</option>
              </select>
            </label>
            <label>地区<input required value={form.region} onChange={(event) => field("region", event.target.value)} /></label>
            <label>生效日期<input type="date" value={form.effectiveAt} onChange={(event) => field("effectiveAt", event.target.value)} /></label>
            <label>失效日期<input type="date" value={form.expiredAt} onChange={(event) => field("expiredAt", event.target.value)} /></label>
          </div>
          <label>条款/摘要<textarea required rows={4} value={form.quote} onChange={(event) => field("quote", event.target.value)} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <label>来源 URL<input required type="url" value={form.sourceUrl} onChange={(event) => field("sourceUrl", event.target.value)} /></label>
            <label>章节<input value={form.section} onChange={(event) => field("section", event.target.value)} /></label>
            <label>初始相关度<input type="number" min="0" max="1" step="0.01" value={form.relevance} onChange={(event) => field("relevance", event.target.value)} /></label>
          </div>
          <label>适用理由<textarea required rows={2} value={form.applicabilityReason} onChange={(event) => field("applicabilityReason", event.target.value)} /></label>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button className="primary-button" type="submit" disabled={pending}>{pending ? "保存中…" : "新增政策"}</button>
            {notice && <span className="notice" role="status">{notice}</span>}
          </div>
        </form>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        {policies.map((policy) => (
          <article className="evidence-card" key={policy.policyId}>
            <div className="evidence-title">
              <span>{policy.title}</span>
              <span className="status-chip">{policy.serviceType}</span>
            </div>
            <p>{policy.quote}</p>
            <small>{policy.region ?? "全国"} · {policy.effectiveAt ?? "未标注"} 起 · {policy.section ?? "政策摘要"} · 相关度 {policy.relevance}</small>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <a href={policy.sourceUrl} target="_blank" rel="noreferrer">查看来源</a>
              <button className="small-action" type="button" onClick={() => void remove(policy.policyId)}>删除</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
