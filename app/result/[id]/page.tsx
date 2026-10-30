import Link from "next/link";
import { cookies } from "next/headers";
import { ownedTask } from "@/lib/demo-data";
import { sessionCookie } from "@/lib/security/session";
import { PrintButton } from "@/components/print-button";

const MATERIALS: Record<string, string[]> = {
  medical_insurance: ["身份证或医保电子凭证", "户口簿（按当地要求）", "参保登记所需的其他材料"],
  student_aid: ["学生证或在读证明", "家庭经济困难认定材料", "申请表及学校要求的佐证材料"],
  elderly_disability_service: ["身份证、户口簿", "残疾人证或老年人能力评估材料", "补贴申请表及当地要求的证明"],
};

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = ownedTask(id, (await cookies()).get(sessionCookie)?.value);
  if (!task) return <main className="main"><h1>任务不可用</h1><Link href="/task/new">重新创建任务</Link></main>;
  const materials = MATERIALS[task.serviceType] ?? ["请以当地官方材料清单为准"];
  return <main className="main"><Link href={`/task/${id}`}>← 返回工作台</Link>
    <section className="compose" style={{ marginTop: 28 }}>
      <span className="eyebrow">办理指南</span><h1 style={{ fontSize: 30 }}>{task.title}</h1>
      <p>以下是准备与咨询步骤，不是官方资格结论；没有执行任何正式申请。</p>
      <h2>现在该做什么</h2>{task.plan.length ? <ol>{task.plan.slice(0, 3).map(step => <li key={step}>{step}</li>)}</ol> : <p>请先回到工作台补充信息。</p>}
      <h2>需要准备什么</h2><ul>{materials.map((item) => <li key={item}>{item}</li>)}</ul><p className="notice">材料清单为常见项，具体以当地官方窗口或学校资助中心要求为准。</p>
      <h2>为什么这样判断</h2>{task.evidence.length ? task.evidence.map(item => <article className="evidence-card" key={item.policyId}><div className="evidence-title">{item.title}</div><p>{item.quote}</p><small>{item.region ?? "全国"} · {item.applicabilityReason}</small><a href={item.sourceUrl} target="_blank" rel="noreferrer">查看来源</a></article>) : <p>没有适用政策证据，不能形成确定性判断。</p>}
      <h2>需要注意什么</h2><p>办理资格、缴费或权益事项前请向官方部门确认。办理范围知情确认：{task.userConfirmed ? "已记录" : "尚未记录"}。</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><PrintButton /><Link className="small-action" href={`/family/${id}`}>家属协助清单</Link></div>
    </section></main>;
}
