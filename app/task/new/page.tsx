import Link from "next/link";

export default function NewTaskPage() {
  return (
    <main className="main">
      <Link href="/">← 返回首页</Link>
      <section className="compose" style={{ marginTop: 28 }}>
        <span className="eyebrow">新建办理任务</span>
        <h1 style={{ fontSize: 30 }}>先确认几项基本信息</h1>
        <p className="intro-copy">任务工作台与追问流程将在后续阶段实现。当前已保留任务路由和输入内容传递入口。</p>
        <ol>
          <li>识别办理事项与用户场景</li>
          <li>确认地区、办理年份等必要信息</li>
          <li>检索政策依据后再形成办理指引</li>
        </ol>
        <p className="notice" role="status">第一阶段演示框架：不会调用模型，也不会给出未经核实的政策结论。</p>
      </section>
    </main>
  );
}
