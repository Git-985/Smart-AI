import Link from "next/link";
import { PolicyAdmin } from "@/components/policy-admin";

export default function PolicyAdminPage() {
  return (
    <main className="main">
      <Link href="/">← 返回首页</Link>
      <div style={{ marginTop: 28 }}>
        <PolicyAdmin />
      </div>
    </main>
  );
}
