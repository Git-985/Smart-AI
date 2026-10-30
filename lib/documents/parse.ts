const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TEXT_LENGTH = 20000;

export type ParsedDocument = {
  filename: string;
  mimeType: string;
  size: number;
  pages?: number;
  textLength: number;
  truncated: boolean;
  text: string;
};

export class DocumentParseError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "DocumentParseError";
  }
}

function normalizeText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeText(buffer: Buffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const replacementCount = (utf8.match(/\uFFFD/g) ?? []).length;
  if (replacementCount > Math.max(3, utf8.length * 0.02)) {
    try {
      return new TextDecoder("gbk", { fatal: false }).decode(buffer);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

export async function parseDocument(file: File): Promise<ParsedDocument> {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new DocumentParseError("INVALID_FILE", "没有收到文件。", 400);
  }
  if (file.size <= 0) {
    throw new DocumentParseError("EMPTY_FILE", "文件为空。", 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new DocumentParseError("FILE_TOO_LARGE", "文件不能超过 10MB。", 413);
  }

  const name = file.name.toLowerCase();
  const mimeType = file.type || "";
  const buffer = Buffer.from(await file.arrayBuffer());
  const isPdf = mimeType === "application/pdf" || name.endsWith(".pdf");
  const isDocx =
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx");
  const isText = mimeType.startsWith("text/") || name.endsWith(".txt");

  let text = "";
  let pages: number | undefined;

  try {
    if (isPdf) {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        text = result.text;
        pages = result.total;
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    } else if (isDocx) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (isText) {
      text = decodeText(buffer);
    } else {
      throw new DocumentParseError(
        "UNSUPPORTED_TYPE",
        "当前支持 PDF、DOCX、TXT。图片 OCR 尚未启用，请先转换为 PDF 或文字。",
        415,
      );
    }
  } catch (error) {
    if (error instanceof DocumentParseError) throw error;
    throw new DocumentParseError(
      "PARSE_FAILED",
      "文件解析失败。若为扫描版 PDF，请先进行 OCR 或转换为文字后再上传。",
      422,
    );
  }

  const normalized = normalizeText(text);
  if (!normalized) {
    throw new DocumentParseError(
      "NO_TEXT",
      "没有提取到可读文本。扫描版 PDF 或纯图片需要 OCR，当前演示未启用。",
      422,
    );
  }

  const textLength = normalized.length;
  const truncated = textLength > MAX_TEXT_LENGTH;

  return {
    filename: file.name,
    mimeType: mimeType || (isPdf ? "application/pdf" : isDocx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain"),
    size: file.size,
    pages,
    textLength,
    truncated,
    text: truncated ? normalized.slice(0, MAX_TEXT_LENGTH) : normalized,
  };
}
