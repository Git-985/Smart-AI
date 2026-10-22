import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "NOT_IMPLEMENTED",
      message: "任务服务尚未接入。当前阶段不会持久化用户输入。",
    },
    { status: 501 },
  );
}
