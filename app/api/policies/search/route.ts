import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    items: [],
    status: "NO_POLICY_DATA",
    message: "当前没有已验证的政策资料，不能据此作出政策结论。",
  });
}
