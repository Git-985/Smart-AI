import Link from "next/link";
import { ArrowRight, HeartHandshake, Landmark, ShieldCheck, Sparkles, Accessibility } from "lucide-react";
import { StartTask } from "@/components/start-task";

const services = [
  { title: "城乡居民医保", description: "参保、缴费与常见问题", icon: HeartHandshake, tone: "tone-green" },
  { title: "高校学生资助", description: "助学金与困难学生申请", icon: Landmark, tone: "tone-blue" },
  { title: "老年与残障服务", description: "材料准备与办理路径", icon: Accessibility, tone: "tone-orange" },
];

export default function HomePage() {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">跳到主要内容</a>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Smart AI 明白办首页">
          <span className="brand-mark"><Sparkles size={19} aria-hidden="true" /></span>
          <span className="brand-name">Smart AI<span className="brand-caption">明白办 · 公共服务助手</span></span>
        </Link>
        <nav className="nav" aria-label="主导航">
          <Link href="/demo">场景体验</Link>
          <Link href="/documents">材料解析</Link>
          <Link href="/onboarding">无障碍设置</Link>
          <Link href="/admin/policies">政策资料</Link>
        </nav>
        <div className="header-actions">
          <Link className="icon-button" href="/onboarding" aria-label="无障碍偏好设置" title="无障碍偏好设置">
            <Accessibility size={19} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <main className="main" id="main">
        <section className="intro" aria-labelledby="welcome-title">
          <div>
            <span className="eyebrow"><span className="eyebrow-dot" />公共服务办理助手</span>
            <h1 id="welcome-title">把事情说清楚，<br />把办理步骤弄明白。</h1>
            <p className="intro-copy">描述您想办理的事情，Smart AI 会帮您梳理所需信息、材料与下一步。重要判断附有依据，信息不足时会先向您确认。</p>
          </div>
          <aside className="trust-note">
            <ShieldCheck size={21} aria-hidden="true" />
            <p><strong>有依据，也有边界</strong><br />结果用于办理指引；涉及资格、费用或正式提交时，请以当地官方信息和人工确认结果为准。</p>
          </aside>
        </section>

        <section aria-labelledby="services-title">
          <div className="section-heading">
            <h2 id="services-title">选择您要了解的事项</h2>
            <span>支持 3 类公共服务</span>
          </div>
          <div className="service-grid">
            {services.map(({ title, description, icon: Icon, tone }) => (
              <Link className="service" href="/task/new" key={title} aria-label={`开始办理咨询：${title}`}>
                <div className="service-top">
                  <span className={`service-icon ${tone}`}><Icon size={22} aria-hidden="true" /></span>
                  <ArrowRight className="service-arrow" size={18} aria-hidden="true" />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="workspace" aria-label="创建办理任务">
          <div className="compose">
            <div className="compose-head">
              <h2>我想办一件事</h2>
              <span className="eyebrow"><span className="eyebrow-dot" />匿名开始</span>
            </div>
            <p className="compose-sub">可以直接描述情况，不确定的地方我们会再询问。</p>
            <StartTask />
          </div>
          <aside className="demo-panel">
            <h2><Sparkles size={18} aria-hidden="true" />快速体验</h2>
            <p>使用虚拟场景查看办理流程，不需要填写真实个人信息。</p>
            <Link className="demo-button" href="/task/new?scenario=medical">医保缴费咨询 <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link className="demo-button" href="/task/new?scenario=student">学生资助申请 <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link className="demo-button" href="/task/new?scenario=elderly">老年服务材料准备 <ArrowRight size={16} aria-hidden="true" /></Link>
          </aside>
        </section>
        <footer className="footer">
          <span>Smart AI · 明白办</span>
          <span>请勿上传身份证、银行卡等真实敏感材料</span>
        </footer>
      </main>
    </div>
  );
}
