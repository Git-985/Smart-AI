import { NextResponse } from "next/server";
import { createDemoTask } from "@/lib/demo-data";

export async function POST(request: Request) {
  const body = await request.json() as { message?: string; region?: string; year?: string };
  if (!body.message?.trim()) return NextResponse.json({ error: "MESSAGE_REQUIRED" }, { status: 400 });
  return NextResponse.json(createDemoTask({ message: body.message, region: body.region, year: body.year }));
}
