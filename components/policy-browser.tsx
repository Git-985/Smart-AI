"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Phone, Search } from "lucide-react";

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

const SERVICE_LABEL: Record<string, string> = {
  medical_insurance: "社保缴纳",
  student_aid: "高校助学金",
  elderly_disability_service: "老年与残障",
};

const SERVICE_TONE: Record<string, string> = {
  medical_insurance: "tone-green",
  student_aid: "tone-blue",
  elderly_disability_service: "tone-orange",
};

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "medical_insurance", label: "社保缴纳" },
  { key: "student_aid", label: "高校助学金" },
  { key: "elderly_disability_service", label: "老年与残障" },
];

const PAGE_SIZE = 9;

function dateText(value: string | null): string {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month) return value;
  return `${year}年${Number(month)}月${day ? `${Number(day)}日` : ""}`;
}

/**
 * 政策资料库：只读浏览。
 * 目标用户是不太熟悉手机的人，因此大字号、大按钮、少选项、没有后台配置项。
 */
export function PolicyBrowser() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [keyword, setKeyword] = useState("");
  const [service, setService] = useState("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/policies", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { policies?: Policy[] }) => {
        if (alive) setPolicies(data.policies ?? []);
      })
      .catch(() => undefined)
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const text = keyword.trim();
    return policies.filter((policy) => {
      if (service !== "all" && policy.serviceType !== service) return false;
      if (!text) return true;
      return [policy.title, policy.quote, policy.region ?? "", SERVICE_LABEL[policy.serviceType] ?? ""]
        .some((value) => value.includes(text));
    });
  }, [policies, keyword, service]);

  useEffect(() => { setVisible(PAGE_SIZE); }, [keyword, service]);

  return (
    <div className="policy-browser">
      <Link className="policy-back" href="/">← 返回首页</Link>

      <header className="policy-hero">
        <span className="eyebrow">政策资料</span>
        <h1>政策资料库</h1>
        <p>
          这里收录办理时会用到的公开政策摘要{loading ? "" : `，共 ${policies.length} 条`}。看不明白时，可以拨打 <strong>12345</strong> 咨询，或请家人一起看。
        </p>
        <a className="policy-help" href="tel:12345">
          <Phone size={20} aria-hidden="true" />
          打电话问 12345
        </a>
      </header>

      <div className="policy-tools">
        <label className="policy-search">
          <Search size={20} aria-hidden="true" />
          <span className="sr-only">搜索政策</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="输入关键词，例如：医保缴费、助学金、护理补贴"
            type="search"
          />
        </label>
        <div className="policy-tabs" role="group" aria-label="按事项筛选">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`policy-tab ${service === item.key ? "is-active" : ""}`}
              aria-pressed={service === item.key}
              onClick={() => setService(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <p className="policy-count" role="status">
        {loading ? "正在加载…" : `找到 ${filtered.length} 条政策`}
      </p>

      {!loading && filtered.length === 0 && (
        <div className="policy-empty">
          <strong>没有找到相关的政策</strong>
          <p>换一个词试试，比如只输入“医保”“助学”或“补贴”，也可以点上面的“全部”。</p>
        </div>
      )}

      <div className="policy-list">
        {filtered.slice(0, visible).map((policy) => (
          <article className="policy-card" key={policy.policyId}>
            <div className="policy-card-top">
              <span className={`policy-tag ${SERVICE_TONE[policy.serviceType] ?? "tone-green"}`}>
                {SERVICE_LABEL[policy.serviceType] ?? "公共服务"}
              </span>
              <span className="policy-region">{policy.region ?? "全国"}</span>
            </div>
            <h2>{policy.title}</h2>
            <p>{policy.quote}</p>
            <div className="policy-card-foot">
              <span>{policy.effectiveAt ? `${dateText(policy.effectiveAt)}起执行` : "执行时间以官方公布为准"}</span>
              <a className="policy-source" href={policy.sourceUrl} target="_blank" rel="noreferrer">
                查看原文
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </div>
          </article>
        ))}
      </div>

      {visible < filtered.length && (
        <button className="primary-button policy-more" type="button" onClick={() => setVisible((current) => current + PAGE_SIZE)}>
          再显示 {Math.min(PAGE_SIZE, filtered.length - visible)} 条
        </button>
      )}

      <div className="policy-footnote">
        <p>这些资料只用于说明办理依据，不是官方结论；正式办理请以主管部门的最新口径为准。</p>
        <Link className="policy-back" href="/">← 返回首页</Link>
      </div>
    </div>
  );
}
