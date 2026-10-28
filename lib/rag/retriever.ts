import type { PolicyEvidence, PolicyFilters } from "./types";
import { demoPolicies } from "@/lib/demo-data";

export async function searchPolicies(
  query: string,
  filters: PolicyFilters,
): Promise<PolicyEvidence[]> {
  const normalized = query.toLowerCase();
  const queryTerms = ["医保", "缴费", "参保", "居民医疗保险"];
  if (!queryTerms.some((term) => normalized.includes(term))) return [];
  return demoPolicies.filter((item) => {
    const matchesService = !filters.serviceType || item.serviceType === filters.serviceType;
    const matchesRegion = !filters.region || item.region === filters.region;
    const current = filters.asOf ?? new Date();
    const starts = !item.effectiveAt || new Date(item.effectiveAt) <= current;
    const ends = !item.expiredAt || new Date(item.expiredAt) > current;
    return matchesService && matchesRegion && starts && ends;
  });
}
