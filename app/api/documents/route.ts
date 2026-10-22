import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "NOT_IMPLEMENTED",
      message: "材料上传与识别尚未启用。请勿上传真实个人材料。",
    },
    { status: 501 },
  );
}
