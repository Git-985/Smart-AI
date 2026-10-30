import { NextResponse } from "next/server";
import { DocumentParseError, parseDocument } from "@/lib/documents/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "INVALID_CONTENT_TYPE", message: "请使用 multipart/form-data 上传文件。" },
      { status: 415 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "INVALID_FORM_DATA", message: "无法读取上传内容。" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "MISSING_FILE", message: "请选择一个文件。" }, { status: 400 });
  }

  try {
    return NextResponse.json(await parseDocument(file));
  } catch (error) {
    if (error instanceof DocumentParseError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "PARSE_FAILED", message: "文件解析失败，请稍后重试或更换文件。" },
      { status: 500 },
    );
  }
}
