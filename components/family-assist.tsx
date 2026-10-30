"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardCheck } from "lucide-react";

const steps = [
  "和办理人确认本次要办理的事项及所在地区。",
  "从当地政府或主管部门官网核对最新办理要求。",
  "按官方清单准备材料；不要在本系统上传真实证件。",
  "办理资格、费用或权益事项时，由本人或授权家属向官方窗口确认。",
];

export function FamilyAssist({ taskId }: { taskId: string }) {
  const [checked, setChecked] = useState<boolean[]>(steps.map(() => false));
  const storageKey = `smart-ai:family-checklist:${taskId}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === steps.length && parsed.every((item) => typeof item === "boolean")) {
          setChecked(parsed);
        }
      }
    } catch {
      // Storage may be disabled; keep the current page checklist available.
    }
  }, [storageKey]);

  function toggle(index: number) {
    setChecked((current) => {
      const next = current.map((value, itemIndex) => itemIndex === index ? !value : value);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Checklist remains available for the current page session.
      }
      return next;
    });
  }

  return (
    <section className="family-checklist" aria-labelledby="family-title">
      <div className="panel-heading">
        <div><span className="eyebrow">家属协助清单</span><h2 id="family-title">逐项协助确认</h2></div>
        <ClipboardCheck size={21} aria-hidden="true" />
      </div>
      <p className="family-intro">任务编号：{taskId}。勾选状态只保存在当前浏览器，不代表已向政府部门提交申请。</p>
      <div className="checklist-items">
        {steps.map((step, index) => (
          <label className="checklist-item" key={step}>
            <input checked={checked[index]} onChange={() => toggle(index)} type="checkbox" />
            <span className="check-icon" aria-hidden="true">{checked[index] && <Check size={16} />}</span>
            <span>{step}</span>
          </label>
        ))}
      </div>
      <p className="notice" role="status">{checked.filter(Boolean).length} / {steps.length} 项已勾选</p>
    </section>
  );
}
