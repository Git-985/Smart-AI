import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { PolicyEvidence } from "@/lib/rag/types";
import { seedPolicies } from "@/lib/policies/seed";

export type StoredTask = {
  id: string;
  owner: string | null;
  message: string;
  serviceType: string;
  title: string;
  status: string;
  riskLevel: string;
  missingFields: string[];
  knownFacts: string[];
  evidence: PolicyEvidence[];
  plan: string[];
  createdAt: string;
  userConfirmed: boolean;
  region: string | null;
  year: string | null;
  analysisSource: "deepseek" | "rules";
  aiSummary: string | null;
};

type DbGlobal = typeof globalThis & { smartAiDb?: DatabaseSync };
const globalForDb = globalThis as DbGlobal;

function databasePath() {
  return process.env.SMART_AI_DB_PATH?.trim() || path.join(process.cwd(), ".data", "smart-ai.sqlite");
}

function migrate(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      owner TEXT,
      message TEXT NOT NULL,
      service_type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      missing_fields TEXT NOT NULL,
      known_facts TEXT NOT NULL,
      evidence TEXT NOT NULL,
      plan TEXT NOT NULL,
      created_at TEXT NOT NULL,
      user_confirmed INTEGER NOT NULL DEFAULT 0,
      region TEXT,
      year TEXT,
      analysis_source TEXT NOT NULL DEFAULT 'rules',
      ai_summary TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
    CREATE TABLE IF NOT EXISTS policies (
      policy_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      service_type TEXT NOT NULL,
      region TEXT,
      effective_at TEXT,
      expired_at TEXT,
      quote TEXT NOT NULL,
      source_url TEXT NOT NULL,
      section TEXT,
      relevance REAL NOT NULL DEFAULT 1,
      applicability_reason TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_policies_lookup ON policies(service_type, region, effective_at, expired_at);
    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      risk_level TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_task ON audit_events(task_id);
  `);

  const count = db.prepare("SELECT COUNT(*) AS count FROM policies").get() as { count: number };
  if (!count.count) {
    const insert = db.prepare(`
      INSERT INTO policies (policy_id, title, service_type, region, effective_at, expired_at, quote, source_url, section, relevance, applicability_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.exec("BEGIN");
    try {
      for (const policy of seedPolicies) {
        insert.run(
          policy.policyId,
          policy.title,
          policy.serviceType,
          policy.region,
          policy.effectiveAt,
          policy.expiredAt,
          policy.quote,
          policy.sourceUrl,
          policy.section ?? null,
          policy.relevance,
          policy.applicabilityReason,
        );
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

export function getDb(): DatabaseSync {
  if (globalForDb.smartAiDb) return globalForDb.smartAiDb;
  const file = databasePath();
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  migrate(db);
  globalForDb.smartAiDb = db;
  return db;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToTask(row: Record<string, unknown>): StoredTask {
  return {
    id: String(row.id),
    owner: row.owner ? String(row.owner) : null,
    message: String(row.message),
    serviceType: String(row.service_type),
    title: String(row.title),
    status: String(row.status),
    riskLevel: String(row.risk_level),
    missingFields: parseJson<string[]>(String(row.missing_fields), []),
    knownFacts: parseJson<string[]>(String(row.known_facts), []),
    evidence: parseJson<PolicyEvidence[]>(String(row.evidence), []),
    plan: parseJson<string[]>(String(row.plan), []),
    createdAt: String(row.created_at),
    userConfirmed: Number(row.user_confirmed) === 1,
    region: row.region ? String(row.region) : null,
    year: row.year ? String(row.year) : null,
    analysisSource: row.analysis_source === "deepseek" ? "deepseek" : "rules",
    aiSummary: row.ai_summary ? String(row.ai_summary) : null,
  };
}

export function saveTask(task: StoredTask) {
  getDb().prepare(`
    INSERT INTO tasks (id, owner, message, service_type, title, status, risk_level, missing_fields, known_facts, evidence, plan, created_at, user_confirmed, region, year, analysis_source, ai_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      owner=excluded.owner, message=excluded.message, service_type=excluded.service_type,
      title=excluded.title, status=excluded.status, risk_level=excluded.risk_level,
      missing_fields=excluded.missing_fields, known_facts=excluded.known_facts,
      evidence=excluded.evidence, plan=excluded.plan, user_confirmed=excluded.user_confirmed,
      region=excluded.region, year=excluded.year, analysis_source=excluded.analysis_source,
      ai_summary=excluded.ai_summary, created_at=excluded.created_at
  `).run(
    task.id,
    task.owner,
    task.message,
    task.serviceType,
    task.title,
    task.status,
    task.riskLevel,
    JSON.stringify(task.missingFields),
    JSON.stringify(task.knownFacts),
    JSON.stringify(task.evidence),
    JSON.stringify(task.plan),
    task.createdAt,
    task.userConfirmed ? 1 : 0,
    task.region,
    task.year,
    task.analysisSource,
    task.aiSummary,
  );
  return task;
}

export function findTask(id: string): StoredTask | undefined {
  const row = getDb().prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToTask(row) : undefined;
}

export function deleteTask(id: string) {
  getDb().prepare("DELETE FROM tasks WHERE id = ?").run(id);
}

export function purgeExpiredTasks() {
  const cutoff = new Date(Date.now() - 86400000).toISOString();
  getDb().prepare("DELETE FROM tasks WHERE created_at < ?").run(cutoff);
}

export function listPolicies(): PolicyEvidence[] {
  const rows = getDb().prepare("SELECT * FROM policies ORDER BY service_type, region, effective_at DESC").all() as Record<string, unknown>[];
  return rows.map((row) => ({
    policyId: String(row.policy_id),
    title: String(row.title),
    serviceType: String(row.service_type),
    region: row.region ? String(row.region) : null,
    effectiveAt: row.effective_at ? String(row.effective_at) : null,
    expiredAt: row.expired_at ? String(row.expired_at) : null,
    quote: String(row.quote),
    sourceUrl: String(row.source_url),
    section: row.section ? String(row.section) : undefined,
    relevance: Number(row.relevance) || 1,
    applicabilityReason: String(row.applicability_reason),
  }));
}

export function savePolicy(policy: PolicyEvidence) {
  getDb().prepare(`
    INSERT INTO policies (policy_id, title, service_type, region, effective_at, expired_at, quote, source_url, section, relevance, applicability_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(policy_id) DO UPDATE SET
      title=excluded.title, service_type=excluded.service_type, region=excluded.region,
      effective_at=excluded.effective_at, expired_at=excluded.expired_at, quote=excluded.quote,
      source_url=excluded.source_url, section=excluded.section, relevance=excluded.relevance,
      applicability_reason=excluded.applicability_reason
  `).run(
    policy.policyId,
    policy.title,
    policy.serviceType,
    policy.region,
    policy.effectiveAt,
    policy.expiredAt,
    policy.quote,
    policy.sourceUrl,
    policy.section ?? null,
    policy.relevance,
    policy.applicabilityReason,
  );
  return policy;
}

export function deletePolicy(id: string) {
  return getDb().prepare("DELETE FROM policies WHERE policy_id = ?").run(id).changes > 0;
}

export function recordAuditRow(taskId: string, eventType: string, riskLevel: string | null, createdAt: string) {
  getDb().prepare("INSERT INTO audit_events (task_id, event_type, risk_level, created_at) VALUES (?, ?, ?, ?)")
    .run(taskId, eventType, riskLevel, createdAt);
}

export function listAuditRows(taskId: string) {
  return getDb().prepare("SELECT task_id, event_type, risk_level, created_at FROM audit_events WHERE task_id = ? ORDER BY id ASC")
    .all(taskId) as Array<{ task_id: string; event_type: string; risk_level: string | null; created_at: string }>;
}
