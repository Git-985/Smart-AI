import type { PolicyEvidence, PolicyFilters } from "./types";

export async function searchPolicies(
  query: string,
  filters: PolicyFilters,
): Promise<PolicyEvidence[]> {
  // Retrieval is intentionally fail-closed until verified policy data is configured.
  void query;
  void filters;
  return [];
}
