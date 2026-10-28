export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.message ?? "请求未能完成，请检查输入后重试。");
    return value as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("请求超时，请重试。");
    }
    if (error instanceof TypeError) throw new Error("网络连接失败，请检查网络后重试。");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
