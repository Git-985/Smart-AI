import path from "node:path";
import { expect, test } from "@playwright/test";

test("政策库管理页展示 30 条内置政策", async ({ page }) => {
  await page.goto("/admin/policies");
  await expect(page.getByRole("heading", { name: "政策知识库管理" })).toBeVisible();
  await expect(page.getByText(/当前共 30 条/)).toBeVisible();
  await expect(page.locator(".evidence-card").first()).toBeVisible();
});

test("图片上传返回本地 OCR 结果", async ({ page }) => {
  await page.goto("/documents");
  await page.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), "tests/fixtures/ocr-fixture.png"));
  await page.getByRole("button", { name: "解析文档" }).click();
  const result = page.locator(".document-result");
  await expect(result).toBeVisible({ timeout: 60000 });
  await expect(result).toContainText("OCR 置信度");
  await expect(result).toContainText("演示材料");
});
