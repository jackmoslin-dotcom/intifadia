import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("Arabic RTL navigation and all public pages", async ({ page }) => {
  for (const [path, title] of [
    ["/", "صوتك يصنع"],
    ["/survey", "رأيك يهمّنا"],
    ["/results", "النتائج العامة"],
    ["/demands", "المطالب الاقتصادية"],
    ["/about", "من نحن"],
    ["/goals", "أهدافنا"],
    ["/methodology", "المنهجية"],
    ["/privacy", "سياسة الخصوصية"],
    ["/contact", "تواصل معنا"],
    ["/admin/login", "لوحة الإدارة"],
    ["/admin", "لوحة الإدارة"],
    ["/admin/analytics", "لوحة الإدارة"],
    ["/admin/moderation", "لوحة الإدارة"],
    ["/admin/settings", "لوحة الإدارة"],
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toContainText(title);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("all six optional sections navigate to review without requiring demographics", async ({
  page,
}) => {
  await page.goto("/survey");
  for (let i = 0; i < 6; i++)
    await page.getByRole("button", { name: "التالي" }).click();
  await expect(
    page.getByRole("heading", { name: "مراجعة وإرسال" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "إرسال الاستبيان" }),
  ).toBeDisabled();
  await expect(page.getByText("الإرسال متوقف:")).toBeVisible();
});
test("conditional salary, rental and search questions; multiple-selection limit", async ({
  page,
}) => {
  await page.goto("/survey");
  await page.getByText("موظف في القطاع العام", { exact: true }).click();
  await page.getByRole("button", { name: "التالي" }).click();
  await expect(
    page.getByText("خلال الأشهر الثلاثة الماضية، ما أطول تأخر"),
  ).toBeVisible();
  await page.getByRole("button", { name: "السابق", exact: true }).click();
  await page.getByText("أبحث عن عمل", { exact: true }).click();
  await page.getByRole("button", { name: "التالي" }).click();
  await expect(
    page.getByText("خلال الأشهر الثلاثة الماضية، ما أطول تأخر"),
  ).toHaveCount(0);
  const options = page.locator("fieldset").first().locator("input");
  await options.nth(0).check();
  await options.nth(1).check();
  await options.nth(2).check();
  await expect(options.nth(3)).toBeDisabled();
  await page.getByRole("button", { name: "التالي" }).click();
  await page.getByText("إيجار", { exact: true }).click();
  await expect(page.getByText("ما نسبة دخل الأسرة")).toBeVisible();
  await page.getByRole("button", { name: "التالي" }).click();
  await expect(page.getByText("منذ متى تبحث عن عمل؟")).toBeVisible();
});
test("basic keyboard accessibility and no fabricated statistics", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByText("انتقل إلى المحتوى")).toBeFocused();
  await page.goto("/results");
  await expect(page.getByText("قاعدة البيانات غير متصلة")).toBeVisible();
  await page.goto("/admin/login");
  await expect(page.getByLabel("البريد الإلكتروني")).toBeVisible();
  await expect(page.getByLabel("كلمة المرور")).toBeVisible();
});

test("accessibility scan and visual evidence", async ({ page }, testInfo) => {
  for (const path of ["/", "/survey", "/admin/login", "/privacy"]) {
    await page.goto(path);
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(report.violations).toEqual([]);
  }
  await page.goto("/");
  await page.screenshot({
    path: `docs/preview-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
