import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json() as { fileName?: string; mimeType?: string; size?: number };
  const allowed = ["image/jpeg", "image/png", "application/pdf"];
  if (!body.fileName || !body.mimeType || !body.size) return NextResponse.json({ error: "FILE_METADATA_REQUIRED" }, { status: 400 });
  if (!allowed.includes(body.mimeType)) return NextResponse.json({ error: "UNSUPPORTED_FILE_TYPE", message: "只支持 JPG、PNG 或 PDF 文件。" }, { status: 415 });
  if (body.size > 10 * 1024 * 1024) return NextResponse.json({ error: "FILE_TOO_LARGE", message: "文件大小不能超过 10MB。" }, { status: 413 });
  return NextResponse.json({
    status: "REVIEW_READY",
    documentId: `demo_doc_${Date.now().toString(36)}`,
    fileName: body.fileName,
    quality: { score: 0.88, blur: false, glare: false, occlusion: false },
    fields: [{ name: "文件类型", value: body.mimeType, confidence: 1, needsConfirmation: true }],
    message: "这是本地演示检查结果，原始文件未上传或保存。",
  });
}
