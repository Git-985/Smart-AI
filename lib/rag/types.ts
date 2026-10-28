export type PolicyEvidence = {
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

export type PolicyFilters = {
  region?: string;
  serviceType?: string;
  asOf?: Date;
};
