"use client";

export function PrintButton() {
  return (
    <button className="small-action" type="button" onClick={() => window.print()}>
      导出 PDF / 打印
    </button>
  );
}
