import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "NOT_IMPLEMENTED",
      message: "确认记录服务尚未接入。",
    },
    { status: 501 },
  );
}
