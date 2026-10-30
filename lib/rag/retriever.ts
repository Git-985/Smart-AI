import type { PolicyEvidence, PolicyFilters } from "./types";
import { listPolicies } from "@/lib/store";

const KEYWORDS = [
  "医保", "医疗", "缴费", "参保", "报销", "慢病", "异地", "新生儿",
  "学生", "助学", "资助", "奖学金", "贷款", "学费", "绿色通道", "勤工",
  "残疾", "残障", "老年", "高龄", "护理", "补贴", "改造", "特困", "辅具",
];

function inDate(policy: PolicyEvidence, asOf: Date) {
  const start = policy.effectiveAt ? new Date(policy.effectiveAt) : null;
  const end = policy.expiredAt ? new Date(policy.expiredAt) : null;
  return (!start || start <= asOf) && (!end || end > asOf);
}

/**
 * 轻量混合检索：事项 + 地区 + 时间硬过滤，关键词命中做相关性排序。
 *
 * - 地方库有匹配时，地方条目优先，同时保留全国条目作为兜底；
 * - 地方库没有匹配时，返回全国政策摘要，并明确提示地方标准需核对；
 * - 不做“只要提到医保就返回”的硬编码，学生资助、老年/残障同样可检索。
 */
export async function searchPolicies(
  query: string,
  filters: PolicyFilters,
): Promise<PolicyEvidence[]> {
  const asOf = filters.asOf ?? new Date();
  const serviceType = filters.serviceType;
  const region = filters.region?.trim();
  const all = listPolicies().filter((item) =>
    (!serviceType || item.serviceType === serviceType) && inDate(item, asOf),
  );

  const local = region ? all.filter((item) => item.region === region) : [];
  const national = all.filter((item) => item.region === "全国");
  const candidates = local.length ? [...local, ...national] : national.length ? national : all;

  const normalized = query.toLowerCase();
  const matchedKeywords = KEYWORDS.filter((word) => normalized.includes(word));

  return candidates
    .map((item) => {
      const haystack = `${item.title}${item.quote}${item.section ?? ""}`;
      const keywordHits = matchedKeywords.filter((word) => haystack.includes(word)).length;
      const regionBoost = item.region === region ? 0.12 : item.region === "全国" ? 0.04 : 0;
      const relevance = Math.min(1, Number((item.relevance * 0.72 + keywordHits * 0.05 + regionBoost).toFixed(2)));
      const regionReason = item.region === region
        ? `适用于${region}`
        : item.region === "全国"
          ? "全国政策摘要，地方标准需以当地经办机构为准"
          : `适用于${item.region ?? "相关地区"}`;
      return {
        ...item,
        relevance,
        applicabilityReason: `${regionReason}；${item.applicabilityReason}`,
      };
    })
    .filter((item) => item.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 6);
}
