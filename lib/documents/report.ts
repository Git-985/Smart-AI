import type { ParsedDocument } from "./parse";

export type MaterialServiceType = "medical_insurance" | "student_aid" | "elderly_disability_service";

export type MaterialCheck = { label: string; hit: boolean };

export type MaterialReport = {
  status: "ready" | "partial" | "empty";
  headline: string;
  moduleLabel: string;
  file: {
    name: string;
    typeLabel: string;
    sizeLabel: string;
    pages?: number;
    textLength: number;
    source: "文本层" | "图片识别（OCR）";
    ocrConfidence?: number;
  };
  checks: MaterialCheck[];
  findings: string[];
  warnings: string[];
  nextSteps: string[];
};

const MODULE_LABEL: Record<string, string> = {
  medical_insurance: "社保缴纳",
  student_aid: "高校助学金",
  elderly_disability_service: "老年人保障",
};

type CheckRule = { label: string; keys: string[] };

const CHECKS: Record<string, CheckRule[]> = {
  medical_insurance: [
    { label: "身份证明（身份证/户口簿）", keys: ["身份证", "户口簿", "户口本", "户口"] },
    { label: "社保卡或医保电子凭证", keys: ["社保卡", "医保卡", "医保电子凭证", "医保码"] },
    { label: "参保或缴费记录", keys: ["参保", "缴费", "缴费凭证", "缴费记录"] },
    { label: "缴费年度或金额", keys: ["年度", "缴费标准", "元"] },
    { label: "经办机构或办理渠道", keys: ["医保局", "税务", "经办", "便民服务", "服务中心"] },
  ],
  student_aid: [
    { label: "学生身份（学生证/录取通知书）", keys: ["学生证", "录取通知", "在读", "学籍"] },
    { label: "家庭经济困难认定", keys: ["困难", "低保", "收入", "建档立卡", "特困"] },
    { label: "资助项目名称", keys: ["助学金", "助学贷款", "奖学金", "资助", "减免"] },
    { label: "申请或审核环节", keys: ["申请", "审核", "公示", "评议"] },
    { label: "收款账户信息", keys: ["银行卡", "账户", "开户"] },
  ],
  elderly_disability_service: [
    { label: "身份与户籍", keys: ["身份证", "户口簿", "户口本", "户口"] },
    { label: "残疾或能力评估", keys: ["残疾", "等级", "评估", "失能", "能力"] },
    { label: "补贴或津贴项目", keys: ["高龄", "护理", "补贴", "津贴"] },
    { label: "代办或监护材料", keys: ["代办", "监护", "委托", "家属"] },
    { label: "发放账户信息", keys: ["银行卡", "账户", "发放"] },
  ],
  general: [
    { label: "身份证明", keys: ["身份证", "户口簿", "户口"] },
    { label: "办理事项说明", keys: ["申请", "办理", "事项"] },
    { label: "时间或金额信息", keys: ["年", "月", "元"] },
    { label: "联系方式", keys: ["电话", "联系", "手机"] },
  ],
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeLabel(mimeType: string, name: string): string {
  const lower = name.toLowerCase();
  if (mimeType.includes("pdf") || lower.endsWith(".pdf")) return "PDF 文档";
  if (mimeType.includes("word") || lower.endsWith(".docx")) return "Word 文档";
  if (mimeType.startsWith("image/")) return "图片";
  if (mimeType.startsWith("text/")) return "文本文件";
  return mimeType || "未知类型";
}

const PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "日期", re: /\d{4}\s*年\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?/g },
  { label: "年度", re: /\d{4}\s*年度/g },
  { label: "金额", re: /\d+(?:\.\d+)?\s*元/g },
  { label: "比例", re: /\d+(?:\.\d+)?\s*%/g },
  { label: "电话", re: /(?<!\d)(?:1[3-9]\d{9}|0\d{2,3}-?\d{7,8}|12345|12393)(?!\d)/g },
];

function extractFindings(text: string): string[] {
  const lines: string[] = [];
  for (const { label, re } of PATTERNS) {
    const hits = Array.from(new Set(text.match(re) ?? [])).slice(0, 2);
    if (hits.length) lines.push(`${label}：${hits.join("、")}`);
  }
  return lines.slice(0, 6);
}

/** 扫描件里常见的是“身份证”写成“身份証”或中间空格，这里统一去空白再做包含判断。 */
function compact(text: string): string {
  return text.replace(/\s+/g, "");
}

export function buildMaterialReport(document: ParsedDocument, serviceType?: string | null): MaterialReport {
  const key = serviceType && CHECKS[serviceType] ? serviceType : "general";
  const moduleLabel = MODULE_LABEL[key] ?? "材料核对";
  const body = compact(document.text);
  const rules = CHECKS[key];

  const checks = rules.map((rule) => ({
    label: rule.label,
    hit: rule.keys.some((word) => body.includes(word)),
  }));

  const hitCount = checks.filter((item) => item.hit).length;
  const readable = body.replace(/[—\-–\s]*\d+\s*(?:of|\/)\s*\d+[—\-–\s]*/g, "").length;
  const empty = readable < 10;
  const status: MaterialReport["status"] = empty ? "empty" : hitCount === 0 ? "partial" : "ready";

  const headline = empty
    ? `没有从这份文件里读到可用文字，无法生成${moduleLabel}材料核对结论。`
    : hitCount === 0
      ? `已读取 ${document.textLength} 字，但没有识别到${moduleLabel}常见材料的名称，建议人工核对。`
      : `已读取 ${document.textLength} 字，识别到 ${hitCount}/${checks.length} 类${moduleLabel}关键信息。`;

  const warnings: string[] = [];
  if (empty) {
    warnings.push("文件可能是扫描件、加密 PDF 或纯图片，文字层为空。");
  }
  if (document.ocrUsed) {
    warnings.push(`文字来自页面图片识别（OCR），置信度 ${document.ocrConfidence ?? 0}%，姓名、证件号、金额请对照原件核对。`);
  }
  if (document.pages && document.ocrUsed && document.ocrPages && document.ocrPages < document.pages) {
    warnings.push(`仅识别了前 ${document.ocrPages} 页，其余页面请核对原文。`);
  }
  if (document.truncated) {
    warnings.push("文件内容较长，报告只基于前 20,000 字。");
  }
  const missing = checks.filter((item) => !item.hit).map((item) => item.label);
  if (!empty && missing.length) {
    warnings.push(`未出现「${missing.slice(0, 3).join("」「")}」相关内容，可能材料不齐，也可能只是表述不同，请人工确认。`);
  }

  const nextSteps = empty
    ? [
        "改为上传清晰的页面截图（JPG/PNG），系统会对图片做文字识别。",
        "或换用带文字层的 PDF、Word 文档重新解析。",
        `对照${moduleLabel}的材料清单，逐项确认手里是否有原件。`,
      ]
    : [
        "核对文件中的姓名、证件号码、办理年度是否与本人一致。",
        hitCount ? "按左侧办理步骤逐项对照，缺哪一项再补哪一项。" : "按材料清单逐项核对，必要时向经办窗口确认名称是否不同。",
        "解析结果只用于自查，正式办理仍需带原件到窗口核验。",
      ];

  return {
    status,
    headline,
    moduleLabel,
    file: {
      name: document.filename,
      typeLabel: typeLabel(document.mimeType, document.filename),
      sizeLabel: formatBytes(document.size),
      pages: document.pages,
      textLength: document.textLength,
      source: document.ocrUsed ? "图片识别（OCR）" : "文本层",
      ocrConfidence: document.ocrConfidence,
    },
    checks,
    findings: extractFindings(document.text),
    warnings,
    nextSteps,
  };
}
