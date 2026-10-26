import type { PolicyEvidence, PolicyFilters } from "./types";
import { demoPolicies } from "@/lib/demo-data";

export async function searchPolicies(
  query: string,
  filters: PolicyFilters,
): Promise<PolicyEvidence[]> {
  const normalized = query.toLowerCase();
  return demoPolicies.filter((item) => {
    const matchesService = !filters.serviceType || normalized.includes("医保") === (filters.serviceType === "medical_insurance");
    const matchesRegion = !filters.region || item.region === filters.region || item.region === "演示地区";
    const current = filters.asOf ?? new Date();
    const starts = !item.effectiveAt || new Date(item.effectiveAt) <= current;
    const ends = !item.expiredAt || new Date(item.expiredAt) > current;
    return matchesService && matchesRegion && starts && ends;
  });
}
