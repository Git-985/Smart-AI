import { maskSensitiveText } from "@/lib/security/pii";

/**
 * 可选的联网检索（用于“辅以联网查询”的旁证）。
 *
 * - 只做线索补充，不把搜索结果当作政策结论；回答里必须与本地知识库区分。
 * - 优先用 Tavily / 博查 / Serper 的 Key；一个都没配置时，回退到搜狗网页检索（无需 Key），
 *   仍拿不到结果才返回 used=false，界面会明确显示“本次未启用联网核验”，不会假装查过。
 * - 想指定通道可设 WEB_SEARCH_PROVIDER=tavily|bocha|serper|sogou|bing。
 * - 任何异常都降级为“没有联网结果”，不阻塞主流程。
 */

export type WebResult = { title: string; url: string; snippet: string };

export type WebSearchOutcome = {
  used: boolean;
  provider: string | null;
  results: WebResult[];
  note: string | null;
};

const EMPTY: WebSearchOutcome = { used: false, provider: null, results: [], note: "本次未启用联网核验。" };

function trimText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function safeUrl(value: unknown): string {
  const text = trimText(value, 500);
  return /^https?:\/\//i.test(text) ? text : "";
}

const NOISE_HOSTS = /(^|\.)(baike\.baidu\.com|hanyu\.baidu\.com|zdic\.net|dict\.|wikipedia\.org)$/i;

function normalize(items: WebResult[], provider: string): WebSearchOutcome {
  const results = items
    .filter((item) => item.title && item.url)
    .filter((item) => {
      try {
        return !NOISE_HOSTS.test(new URL(item.url).hostname);
      } catch {
        return false;
      }
    })
    // 政府站点优先，其余按原顺序，便于用户直接核对官方原文
    .sort((a, b) => Number(b.url.includes(".gov.cn")) - Number(a.url.includes(".gov.cn")))
    .slice(0, 5);
  return results.length
    ? { used: true, provider, results, note: `已通过${provider}补充 ${results.length} 条公开线索，需与官方原文核对。` }
    : { used: false, provider, results: [], note: "联网检索没有返回可用结果。" };
}

async function requestJson(url: string, init: RequestInit, timeoutMs = 7000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function searchTavily(query: string, apiKey: string): Promise<WebSearchOutcome> {
  const payload = await requestJson("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, max_results: 5, search_depth: "basic", include_answer: false }),
  });
  const rows = (payload as { results?: Array<Record<string, unknown>> } | null)?.results;
  if (!Array.isArray(rows)) return EMPTY;
  return normalize(rows.map((row) => ({
    title: trimText(row.title, 120),
    url: safeUrl(row.url),
    snippet: trimText(row.content, 240),
  })), "Tavily");
}

async function searchBocha(query: string, apiKey: string): Promise<WebSearchOutcome> {
  const payload = await requestJson("https://api.bochaai.com/v1/web-search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, count: 5, summary: true }),
  });
  const rows = (payload as { data?: { webPages?: { value?: Array<Record<string, unknown>> } } } | null)
    ?.data?.webPages?.value;
  if (!Array.isArray(rows)) return EMPTY;
  return normalize(rows.map((row) => ({
    title: trimText(row.name, 120),
    url: safeUrl(row.url),
    snippet: trimText(row.summary ?? row.snippet, 240),
  })), "博查");
}

async function searchSerper(query: string, apiKey: string): Promise<WebSearchOutcome> {
  const payload = await requestJson("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({ q: query, num: 5, hl: "zh-cn", gl: "cn" }),
  });
  const rows = (payload as { organic?: Array<Record<string, unknown>> } | null)?.organic;
  if (!Array.isArray(rows)) return EMPTY;
  return normalize(rows.map((row) => ({
    title: trimText(row.title, 120),
    url: safeUrl(row.link),
    snippet: trimText(row.snippet, 240),
  })), "Serper");
}

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function decodeEntities(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)));
}

function resolveBingUrl(href: string): string {
  try {
    const url = new URL(href, "https://cn.bing.com");
    if (url.hostname.endsWith("bing.com") && url.pathname.startsWith("/ck/a")) {
      const target = url.searchParams.get("u");
      if (target?.startsWith("a1")) {
        const base64 = target.slice(2).replace(/-/g, "+").replace(/_/g, "/");
        const decoded = Buffer.from(base64, "base64").toString("utf8");
        return /^https?:\/\//.test(decoded) ? decoded : "";
      }
      return "";
    }
    return url.href;
  } catch {
    return "";
  }
}

/**
 * 无 Key 的回退通道：抓必应网页检索结果。
 * 只取标题、链接和摘要，作为“可核对线索”，不参与政策结论。
 */
async function searchBing(query: string): Promise<WebSearchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(
      `https://cn.bing.com/search?q=${encodeURIComponent(`${query} 官方办理`)}&ensearch=0`,
      {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "zh-CN,zh;q=0.9" },
        signal: controller.signal,
        cache: "no-store",
      },
    );
    if (!response.ok) return EMPTY;
    const html = await response.text();
    const blocks = html.split(/<li class="b_algo"/i).slice(1, 6);
    const items: WebResult[] = [];
    for (const block of blocks) {
      const link = block.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!link) continue;
      const url = resolveBingUrl(link[1]);
      const title = trimText(decodeEntities(link[2]), 120);
      const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      const snippet = trimText(decodeEntities(snippetMatch?.[1] ?? ""), 240);
      if (url && title) items.push({ title, url, snippet });
      if (items.length >= 4) break;
    }
    return normalize(items, "必应网页检索");
  } catch {
    return EMPTY;
  } finally {
    clearTimeout(timer);
  }
}


async function resolveSogouLink(href: string): Promise<string> {
  if (!href.startsWith("http")) return "";
  try {
    const response = await fetch(href, { method: "GET", redirect: "manual", headers: { "User-Agent": USER_AGENT } });
    const location = response.headers.get("location");
    if (location && /^https?:\/\//.test(location)) return location;
    // 搜狗多数情况下返回 200 + JS/meta 跳转
    const text = await response.text();
    const meta = text.match(/<meta[^>]+http-equiv=["']?refresh[^>]*url=([^"'>\s]+)/i);
    const js = text.match(/location\.(?:replace|href)\s*[=(]\s*["']([^"']+)["']/i);
    const target = meta?.[1] ?? js?.[1];
    return target && /^https?:\/\//.test(target) ? target : href;
  } catch {
    return href;
  }
}

/**
 * 无 Key 的默认通道：搜狗网页检索。
 * 只取标题、摘要与跳转后的真实链接；拿不到就返回空，不阻塞主流程。
 */
async function searchSogou(query: string): Promise<WebSearchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(
      `https://www.sogou.com/web?query=${encodeURIComponent(query)}&ie=utf8`,
      {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "zh-CN,zh;q=0.9" },
        signal: controller.signal,
        cache: "no-store",
      },
    );
    if (!response.ok) return EMPTY;
    const html = await response.text();
    const blocks = html.split(/<h3 class="vr-title"/i).slice(1, 6);
    const items: WebResult[] = [];
    for (const block of blocks) {
      const link = block.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!link) continue;
      const title = trimText(decodeEntities(link[2]), 120);
      const snippetMatch = block.match(/<div class="[^"]*cacheresult_summary[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
        ?? block.match(/<p class="[^"]*star-wiki[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
      const snippet = trimText(decodeEntities(snippetMatch?.[1] ?? ""), 240);
      const raw = link[1].startsWith("/") ? `https://www.sogou.com${link[1]}` : link[1];
      if (title && raw) items.push({ title, url: raw, snippet });
      if (items.length >= 4) break;
    }
    // 跳转链接还原成真实站点，最多解析 3 条，避免拖慢
    const resolved = await Promise.all(items.map(async (item, index) => (
      index < 3 ? { ...item, url: (await resolveSogouLink(item.url)) || item.url } : item
    )));
    return normalize(resolved, "搜狗网页检索");
  } catch {
    return EMPTY;
  } finally {
    clearTimeout(timer);
  }
}

export function webSearchConfigured(): boolean {
  if (process.env.WEB_SEARCH_DISABLED === "true") return false;
  return true;
}

const CACHE_TTL = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: WebSearchOutcome }>();

export async function searchWeb(rawQuery: string): Promise<WebSearchOutcome> {
  if (!webSearchConfigured()) return EMPTY;
  const query = maskSensitiveText(rawQuery).replace(/\s+/g, " ").trim().slice(0, 120);
  if (query.length < 4) return EMPTY;

  const cached = cache.get(query);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.value;

  try {
    const forced = process.env.WEB_SEARCH_PROVIDER?.trim().toLowerCase();
    const tavily = process.env.TAVILY_API_KEY?.trim();
    const bocha = process.env.BOCHA_API_KEY?.trim();
    const serper = process.env.SERPER_API_KEY?.trim();

    if (forced === "tavily" && tavily) return await searchTavily(query, tavily);
    if (forced === "bocha" && bocha) return await searchBocha(query, bocha);
    if (forced === "serper" && serper) return await searchSerper(query, serper);
    if (forced === "bing") return await searchBing(query);
    if (forced === "sogou") return await searchSogou(query);

    const outcome = tavily
      ? await searchTavily(query, tavily)
      : bocha
        ? await searchBocha(query, bocha)
        : serper
          ? await searchSerper(query, serper)
          : await searchSogou(query);
    cache.set(query, { at: Date.now(), value: outcome });
    return outcome;
  } catch {
    return { used: false, provider: null, results: [], note: "联网检索暂时不可用，本次仅依据本地知识库作答。" };
  }
}
