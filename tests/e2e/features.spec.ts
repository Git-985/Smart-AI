import path from "node:path";
import { expect, test } from "@playwright/test";

test("政策资料库只读展示且没有管理入口", async ({ page }) => {
  await page.goto("/admin/policies");
  await expect(page.getByRole("heading", { name: "政策资料库" })).toBeVisible();
  await expect(page.getByText(/找到 63 条政策/)).toBeVisible();
  await expect(page.locator(".policy-card")).toHaveCount(9);
  await expect(page.getByRole("button", { name: "删除" })).toHaveCount(0);
  await expect(page.getByText("管理口令")).toHaveCount(0);
});

test("图片上传返回本地 OCR 结果", async ({ page }) => {
  await page.goto("/documents");
  await page.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), "tests/fixtures/ocr-fixture.png"));
  await page.getByRole("button", { name: "解析文档" }).click();
  const result = page.locator(".document-result");
  await expect(result).toBeVisible({ timeout: 60000 });
  await expect(result.locator(".material-report")).toContainText("图片识别");
  await expect(result).toContainText("演示材料");
});
