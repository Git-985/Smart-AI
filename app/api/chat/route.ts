import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "NOT_IMPLEMENTED",
      message: "对话模型尚未配置，未生成政策建议。",
    },
    { status: 501 },
  );
}
