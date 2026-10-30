import { expect, test } from "@playwright/test";

test("首页到指南、元数据检查、家属协助与刷新恢复", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByLabel("描述您想办理的事情").fill("帮父亲咨询居民医保缴费，联系电话13800138000");
  await page.getByRole("button", { name: "开始梳理" }).click();
  await expect(page.getByLabel("描述办理需求")).toHaveValue(/138\*\*\*\*8000/);
  await page.getByRole("button", { name: "识别事项" }).click();
  await expect(page).toHaveURL(/\/task\/demo_/);
  await page.getByLabel("所在省、市、区").fill("演示地区");
  await page.getByLabel("办理年份").fill("2026");
  await page.getByRole("button", { name: "继续梳理" }).click();
  await expect(page.locator(".evidence-title").first()).toContainText("演示政策");
  await page.reload();
  await expect(page.locator(".evidence-title").first()).toContainText("演示政策");
  await page.getByRole("button", { name: "重新检查任务" }).click();
  await expect(page.getByRole("status").last()).toContainText("已完成演示检索");

  // Arbitrary bytes are never inspected: the UI and API must say metadata-only.
  await page.locator('input[type="file"]').setInputFiles({
    name: "fixture.png", mimeType: "image/png", buffer: Buffer.from("metadata-only fixture"),
  });
  await expect(page.locator(".material-card")).toContainText("未执行 OCR");
  await page.getByLabel("我已了解上述演示范围").check();
  await page.getByRole("button", { name: "确认并记录" }).click();
  await expect(page.getByRole("button", { name: "已记录确认" })).toBeDisabled();
  const taskUrl = page.url();
  await page.getByRole("link", { name: "查看演示指南" }).click();
  await expect(page.getByRole("heading", { name: "现在该做什么" })).toBeVisible();
  await page.getByRole("link", { name: "家属协助清单" }).click();
  const first = page.getByRole("checkbox").first();
  await first.check({ force: true });
  await page.reload();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
  await page.goto(taskUrl);
  await expect(page.getByRole("button", { name: "已记录确认" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("无证据地区明确兜底", async ({ page }) => {
  await page.goto("/task/new");
  await page.getByLabel("描述办理需求").fill("居民医保缴费");
  await page.getByRole("button", { name: "识别事项" }).click();
  await page.getByLabel("所在省、市、区").fill("上海市");
  await page.getByRole("button", { name: "继续梳理" }).click();
  await expect(page.getByRole("status").last()).toContainText("没有找到适用的政策证据");
  await expect(page.locator(".evidence-title")).toHaveCount(0);
});

test("未知事项先追问具体事项", async ({ page }) => {
  await page.goto("/task/new");
  await page.getByLabel("描述办理需求").fill("我想咨询一件事情");
  await page.getByRole("button", { name: "识别事项" }).click();
  await page.getByLabel("请描述具体办理事项").fill("是居民医保缴费");
  await page.getByRole("button", { name: "继续梳理" }).click();
  await expect(page.getByLabel("所在省、市、区")).toBeVisible();
});

test("三个演示场景直达工作台并带入对应描述", async ({ page }) => {
  await page.goto("/demo");
  const cases = [
    { title: "居民医保缴费咨询", expected: /居民医保/ },
    { title: "高校学生资助申请", expected: /助学金/ },
    { title: "老年服务材料办理", expected: /老人/ },
  ];
  for (const scenario of cases) {
    await page.goto("/demo");
    await page.getByRole("link", { name: new RegExp(scenario.title) }).click();
    await expect(page).toHaveURL(/\/task\/new\?scenario=/);
    await expect(page.getByLabel("描述办理需求")).toHaveValue(scenario.expected);
  }
});

test("网络失败保留输入并允许重试", async ({ page }) => {
  await page.goto("/task/new");
  await page.getByLabel("描述办理需求").fill("居民医保缴费");
  await page.route("**/api/tasks", route => route.abort("failed"));
  await page.getByRole("button", { name: "识别事项" }).click();
  await expect(page.getByRole("status")).toContainText("网络连接失败");
  await expect(page.getByLabel("描述办理需求")).toHaveValue("居民医保缴费");
  await page.unroute("**/api/tasks");
  await page.getByRole("button", { name: "识别事项" }).click();
  await expect(page).toHaveURL(/\/task\/demo_/);
});

test("大字体、高对比度刷新保留并可用键盘切换", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "175%" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("checkbox", { name: "高对比度" }).check();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-font-scale", "175");
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
  await page.getByRole("button", { name: "100%" }).click();
  await expect(page.getByRole("button", { name: "100%" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("任务页面和变更 API 隔离不同会话", async ({ page, browser, request }) => {
  const created = await request.post("/api/tasks", { data: { message: "居民医保缴费" } });
  const { id } = await created.json();
  const outsider = await browser.newContext();
  const denied = await outsider.request.post("http://127.0.0.1:3107/api/chat", {
    data: { taskId: id, region: "演示地区", year: "2026" },
  });
  expect(denied.status()).toBe(404);
  const confirmed = await outsider.request.post("http://127.0.0.1:3107/api/confirmations", {
    data: { taskId: id, acknowledged: true },
  });
  expect(confirmed.status()).toBe(404);
  await page.goto(`/task/${id}`);
  await expect(page.getByRole("heading", { name: "任务不可用" })).toBeVisible();
  await outsider.close();
});

test("无效 JSON 和非法文件元数据返回可控错误", async ({ request }) => {
  expect((await request.post("/api/tasks", { data: "{", headers: { "Content-Type": "application/json" } })).status()).toBe(400);
  expect((await request.post("/api/documents", { data: { mimeType: "text/html", size: 1024 } })).status()).toBe(400);
  expect((await request.post("/api/documents", { data: { mimeType: "image/png", size: 10485761 } })).status()).toBe(400);
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect((await health.json()).storage).toBe("process-memory");
});
