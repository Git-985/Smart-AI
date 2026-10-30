import fs from "node:fs";

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
  ocrUsed?: boolean;
  ocrConfidence?: number;
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
    .replace(/(?<=[\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type OcrWorker = {
  recognize: (input: Buffer) => Promise<{ data: { text: string; confidence: number } }>;
};

const globalForOcr = globalThis as unknown as { smartAiOcrWorker?: Promise<OcrWorker> };

async function getOcrWorker(): Promise<OcrWorker> {
  if (!globalForOcr.smartAiOcrWorker) {
    globalForOcr.smartAiOcrWorker = (async () => {
      const [{ createWorker }, path] = await Promise.all([import("tesseract.js"), import("node:path")]);
      const candidates = [
        path.join(process.cwd(), "public", "tessdata"),
        path.join(process.cwd(), "..", "public", "tessdata"),
      ];
      const langPath = candidates.find((candidate) => {
        try {
          return fs.existsSync(path.join(candidate, "chi_sim.traineddata.gz"));
        } catch {
          return false;
        }
      }) ?? candidates[0];
      return await createWorker("chi_sim+eng", 1, {
        langPath,
        cachePath: path.join(process.cwd(), ".tesseract-cache"),
      }) as unknown as OcrWorker;
    })().catch((error) => {
      globalForOcr.smartAiOcrWorker = undefined;
      throw error;
    });
  }
  return globalForOcr.smartAiOcrWorker;
}

async function ocrImage(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  const worker = await getOcrWorker();
  const result = await worker.recognize(buffer);
  return { text: result.data.text, confidence: Math.round(result.data.confidence) };
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
  const isImage = mimeType.startsWith("image/") || /\.(png|jpe?g|webp|bmp)$/i.test(name);

  let text = "";
  let pages: number | undefined;
  let ocrUsed = false;
  let ocrConfidence: number | undefined;

  try {
    if (isImage) {
      const ocr = await ocrImage(buffer);
      text = ocr.text;
      pages = 1;
      ocrUsed = true;
      ocrConfidence = ocr.confidence;
    } else if (isPdf) {
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
        "当前支持 PDF、DOCX、TXT、PNG、JPG、WEBP 图片；扫描版 PDF 请转为图片后上传。",
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
      "没有提取到可读文本。请确认图片清晰、文字完整；扫描版 PDF 请转为图片后重试。",
      422,
    );
  }

  const textLength = normalized.length;
  const truncated = textLength > MAX_TEXT_LENGTH;

  return {
    filename: file.name,
    mimeType: mimeType || (isPdf ? "application/pdf" : isImage ? "image/png" : isDocx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain"),
    size: file.size,
    pages,
    textLength,
    truncated,
    text: truncated ? normalized.slice(0, MAX_TEXT_LENGTH) : normalized,
    ocrUsed,
    ocrConfidence,
  };
}
