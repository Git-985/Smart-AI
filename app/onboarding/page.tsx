import Link from "next/link";
import { Accessibility } from "lucide-react";
import { AccessibilitySettings } from "@/components/accessibility-settings";

export default function OnboardingPage() {
  return (
    <main className="main">
      <Link href="/">← 返回首页</Link>
      <section className="compose" style={{ marginTop: 28 }}>
        <h1 style={{ fontSize: 30 }}>无障碍偏好设置</h1>
        <p className="intro-copy">选择适合您的阅读方式。所有偏好仅保存在当前浏览器，您可以随时调整。</p>
        <AccessibilitySettings />
        <p className="notice"><Accessibility size={18} aria-hidden="true" /> 设置不会改变政策内容或风险提示。</p>
      </section>
    </main>
  );
}
