import { ShieldCheck } from "lucide-react";

/**
 * 敏感材料提示。
 * panel：首页/解析页的大块提示；compact：上传弹窗里的一行。
 */
export function PrivacyNotice({ variant = "panel" }: { variant?: "panel" | "compact" }) {
  if (variant === "compact") {
    return (
      <p className="privacy-inline">
        <ShieldCheck size={17} aria-hidden="true" />
        <span>请勿上传身份证、银行卡等真实敏感材料；证件号可先打码，文件只在本次请求内解析。</span>
      </p>
    );
  }

  return (
    <section className="privacy-notice" aria-labelledby="privacy-title">
      <div className="privacy-head">
        <span className="privacy-icon"><ShieldCheck size={26} aria-hidden="true" /></span>
        <div>
          <h2 id="privacy-title">上传材料前，请先看这一条</h2>
          <p>办事只需要关键信息，敏感内容先处理掉，既够用也更安全。</p>
        </div>
      </div>
      <ul className="privacy-list">
        <li><strong>不要上传：</strong>身份证正反面、银行卡、社保卡完整卡号、病历或诊断证明原件的照片。</li>
        <li><strong>先打码：</strong>证件号只留后四位，手机号中间四位可以遮住，住址写到区县就够用。</li>
        <li><strong>只传必需页：</strong>只上传与本次办理相关的那几页，不必把整本证件或整份档案传上来。</li>
        <li><strong>拿不准就别传：</strong>不确定要不要的材料，先用文字描述情况，系统会告诉您需要哪几页。</li>
        <li><strong>用完即弃：</strong>文件只在本次请求内解析，服务端不保存；解析结果仅作办理参考，不替代官方审核。</li>
      </ul>
    </section>
  );
}
