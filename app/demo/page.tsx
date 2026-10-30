import Link from "next/link";

export default function DemoPage() {
  return <main className="main"><Link href="/">← 返回首页</Link><section className="compose" style={{ marginTop: 28 }}><span className="eyebrow">场景入口</span><h1 style={{ fontSize: 30 }}>选择一个办事场景</h1><p className="intro-copy">示例数据使用虚构人物和内置政策摘要；可在政策库替换为当地正式政策。点击场景后可直接进入任务工作台。</p><div className="service-grid" style={{ marginTop: 20 }}><Link className="service" href="/task/new?scenario=medical"><h3>居民医保缴费咨询</h3><p>示例老人 · 地区信息待确认</p></Link><Link className="service" href="/task/new?scenario=student"><h3>高校学生资助申请</h3><p>示例学生 · 材料清单咨询</p></Link><Link className="service" href="/task/new?scenario=elderly"><h3>老年服务材料办理</h3><p>示例家属 · 协助准备材料</p></Link></div></section></main>;
}
