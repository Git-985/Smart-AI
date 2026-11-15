export type MaterialReportData = {
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
  checks: Array<{ label: string; hit: boolean }>;
  findings: string[];
  warnings: string[];
  nextSteps: string[];
};

const STATUS_LABEL: Record<MaterialReportData["status"], string> = {
  ready: "要点已识别",
  partial: "部分信息未识别",
  empty: "未读取到文字",
};

export function MaterialReportView({ report }: { report: MaterialReportData }) {
  return (
    <section className="material-report" aria-label="材料解析报告">
      <div className="material-report-head">
        <div>
          <span className="eyebrow">材料解析报告 · {report.moduleLabel}</span>
          <h3>{report.headline}</h3>
        </div>
        <span className={`status-pill material-status ${report.status}`}>{STATUS_LABEL[report.status]}</span>
      </div>

      <p className="document-meta">
        {report.file.name} · {report.file.typeLabel} · {report.file.sizeLabel}
        {report.file.pages ? ` · ${report.file.pages} 页` : ""} · {report.file.textLength} 字 · 来源：{report.file.source}
        {report.file.source === "图片识别（OCR）" ? `（置信度 ${report.file.ocrConfidence ?? 0}%）` : ""}
      </p>

      <div className="material-checks" aria-label="材料要点核对">
        {report.checks.map((check) => (
          <span key={check.label} className={`check-chip ${check.hit ? "check-hit" : "check-miss"}`}>
            <span aria-hidden="true">{check.hit ? "✓" : "○"}</span>
            {check.label}
          </span>
        ))}
      </div>

      {report.findings.length > 0 && (
        <div className="material-section">
          <strong>识别到的关键信息</strong>
          <ul>{report.findings.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}

      {report.warnings.length > 0 && (
        <div className="material-section material-warnings">
          <strong>需要注意</strong>
          <ul>{report.warnings.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}

      <div className="material-section">
        <strong>建议下一步</strong>
        <ol>{report.nextSteps.map((item) => <li key={item}>{item}</li>)}</ol>
      </div>
    </section>
  );
}
