import Link from "next/link";
import { cookies } from "next/headers";
import { ownedTask } from "@/lib/demo-data";
import { sessionCookie } from "@/lib/security/session";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = ownedTask(id, (await cookies()).get(sessionCookie)?.value);
  if (!task) return <main className="main"><h1>任务不可用</h1><Link href="/task/new">重新创建任务</Link></main>;
  return <main className="main"><Link href={`/task/${id}`}>← 返回工作台</Link>
    <section className="compose" style={{ marginTop: 28 }}>
      <span className="eyebrow">演示办理指南</span><h1 style={{ fontSize: 30 }}>{task.title}</h1>
      <p>以下是准备与咨询步骤，不是官方资格结论；没有执行任何正式申请。</p>
      <h2>现在该做什么</h2>{task.plan.length ? <ol>{task.plan.slice(0, 3).map(step => <li key={step}>{step}</li>)}</ol> : <p>请先回到工作台补充信息。</p>}
      <h2>需要准备什么</h2><p>尚未接入官方材料清单，请到官方窗口核对；本演示不读取上传文件。</p>
      <h2>为什么这样判断</h2>{task.evidence.length ? task.evidence.map(item => <p key={item.policyId}>{item.title}：{item.quote}</p>) : <p>没有适用政策证据，不能形成确定性判断。</p>}
      <h2>需要注意什么</h2><p>办理资格、缴费或权益事项前请向官方部门确认。演示范围知情确认：{task.userConfirmed ? "已记录" : "尚未记录"}。</p>
      <Link className="small-action" href={`/family/${id}`}>家属协助清单</Link>
    </section></main>;
}
