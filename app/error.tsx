"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="main"><h1>页面暂时无法打开</h1><p>请重试；若服务已重启，演示任务需要重新创建。</p>
    <button className="primary-button" onClick={reset}>重试</button>{" "}
    <Link href="/">返回首页</Link></main>;
}
