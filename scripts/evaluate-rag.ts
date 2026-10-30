import fs from "node:fs";
import path from "node:path";
import { searchPolicies } from "../lib/rag/retriever";

type Case = {
  id: string;
  question: string;
  region: string;
  serviceType: string;
  year: number;
  expect: {
    nonEmpty?: boolean;
    empty?: boolean;
    serviceType?: string;
    allServiceType?: string;
    regionIn?: string[];
    allRegion?: string;
    titleIncludes?: string;
  };
};

const cases = JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests/evaluation/cases.json"), "utf8")) as Case[];

async function run() {
  const rows = [];
  for (const item of cases) {
    const result = await searchPolicies(item.question, {
      region: item.region,
      serviceType: item.serviceType,
      asOf: new Date(`${item.year}-12-31`),
    });
    const reasons: string[] = [];
    if (item.expect.nonEmpty && result.length === 0) reasons.push("expected non-empty");
    if (item.expect.empty && result.length > 0) reasons.push("expected empty");
    if (item.expect.serviceType && result[0]?.serviceType !== item.expect.serviceType) reasons.push("wrong service type");
    if (item.expect.allServiceType && result.some((entry) => entry.serviceType !== item.expect.allServiceType)) reasons.push("mixed service type");
    if (item.expect.regionIn && result.length && !result.every((entry) => item.expect.regionIn?.includes(entry.region ?? ""))) reasons.push("unexpected region");
    if (item.expect.allRegion && result.some((entry) => entry.region !== item.expect.allRegion)) reasons.push("expected national only");
    if (item.expect.titleIncludes && !result.some((entry) => entry.title.includes(item.expect.titleIncludes!))) reasons.push(`missing title keyword: ${item.expect.titleIncludes}`);
    rows.push({ ...item, result, pass: reasons.length === 0, reasons });
    console.log(`${reasons.length === 0 ? "PASS" : "FAIL"} ${item.id} ${item.question} -> ${result.map((entry) => entry.title).slice(0, 2).join(" / ") || "（空）"}`);
  }

  const passed = rows.filter((row) => row.pass).length;
  const report = [
    "# RAG 评测报告",
    "",
    `- 评测时间：${new Date().toISOString()}`,
    `- 用例数：${rows.length}`,
    `- 通过：${passed}`,
    `- 通过率：${Math.round((passed / rows.length) * 100)}%`,
    "",
    "| 用例 | 问题 | 地区 | 事项 | 返回条数 | 结果 |",
    "|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.id} | ${row.question} | ${row.region} | ${row.serviceType} | ${row.result.length} | ${row.pass ? "通过" : `失败：${row.reasons.join("；")}`} |`),
    "",
    "> 评测只验证检索边界（事项、地区、时间、拒答），不代表政策原文的法律正确性；正式上线前需由业务人员复核政策库。",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(process.cwd(), "docs/final/evaluation.md"), report, "utf8");
  console.log(`RESULT ${passed}/${rows.length}`);
  if (passed !== rows.length) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
