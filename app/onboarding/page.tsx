import Link from "next/link";
import { Accessibility } from "lucide-react";

export default function OnboardingPage() {
  return (
    <main className="main">
      <Link href="/">← 返回首页</Link>
      <section className="compose" style={{ marginTop: 28 }}>
        <h1 style={{ fontSize: 30 }}>无障碍偏好设置</h1>
        <p className="intro-copy">基础键盘操作与屏幕阅读器标签已启用。字体缩放、高对比度和语音引导控制将在后续阶段完善。</p>
        <p className="notice"><Accessibility size={18} aria-hidden="true" /> 当前为第一阶段框架页面。</p>
      </section>
    </main>
  );
}
