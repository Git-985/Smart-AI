import { NextResponse } from "next/server";
import { documentMetadataSchema } from "@/lib/api/schemas";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = documentMetadataSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_FILE_METADATA", message: "仅支持不超过 10MB 的 JPG、PNG 或 PDF 文件。" }, { status: 400 });
  return NextResponse.json({
    status: "METADATA_ONLY",
    documentId: `demo_doc_${Date.now().toString(36)}`,
    mimeType: parsed.data.mimeType,
    size: parsed.data.size,
    message: "只验证了文件类型和大小。文件内容没有上传，未执行 OCR 或质量评分。",
  });
}
