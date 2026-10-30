"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="main"><h1>页面暂时无法打开</h1><p>请重试；如果问题持续出现，请返回首页重新创建任务。</p>
    <button className="primary-button" onClick={reset}>重试</button>{" "}
    <Link href="/">返回首页</Link></main>;
}
