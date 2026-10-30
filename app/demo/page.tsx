import Link from "next/link";

export default function DemoPage() {
  return <main className="main"><Link href="/">← 返回首页</Link><section className="compose" style={{ marginTop: 28 }}><span className="eyebrow">虚拟演示入口</span><h1 style={{ fontSize: 30 }}>选择一个演示场景</h1><p className="intro-copy">演示数据使用虚构人物与模拟政策材料。点击场景后可直接进入任务工作台。</p><div className="service-grid" style={{ marginTop: 20 }}><Link className="service" href="/task/new?scenario=medical"><h3>居民医保缴费咨询</h3><p>虚拟老人 · 地区信息待确认</p></Link><Link className="service" href="/task/new?scenario=student"><h3>高校学生资助申请</h3><p>虚拟学生 · 材料清单咨询</p></Link><Link className="service" href="/task/new?scenario=elderly"><h3>老年服务材料办理</h3><p>虚拟家属 · 协助准备材料</p></Link></div></section></main>;
}
