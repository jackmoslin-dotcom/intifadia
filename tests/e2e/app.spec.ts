import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("organizer announcement and official Telegram links", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "مظاهرة سلمية — 28 أكتوبر 2026" }),
  ).toBeVisible();
  await expect(
    page.getByText("موعد معلن من المنظم", { exact: true }),
  ).toBeVisible();
  const links = page.getByRole("link", { name: "قناتنا الرسمية على تيليجرام" });
  await expect(links).toHaveCount(3);
  for (const link of await links.all())
    await expect(link).toHaveAttribute(
      "href",
      "https://t.me/LibyaYouthAwareness",
    );
});
test("Q36 is optional and last, with yes/no and aggregate-only notice", async ({
  page,
}) => {
  await page.goto("/survey");
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: "التالي" }).click();
  const last = page.locator("fieldset").last();
  await expect(last).toContainText(
    "هل تنوي المشاركة في المظاهرة السلمية المقترحة يوم 28 أكتوبر 2026؟",
  );
  await expect(last).toContainText("عدادات مجمّعة منفصلة");
  await expect(last.getByRole("radio")).toHaveCount(2);
  await last.getByLabel("نعم", { exact: true }).check();
  await page.getByRole("button", { name: "التالي" }).click();
  await expect(
    page.getByRole("heading", { name: "مراجعة وإرسال" }),
  ).toBeVisible();
});
test("public intention statistics show question denominator and interpretation", async ({
  page,
}) => {
  await page.route("**/api/results", (route) =>
    route.fulfill({
      json: {
        total: 20,
        threshold: 5,
        distributions: {},
        weekly: [],
        demonstration: {
          answered: 10,
          yes: 5,
          no: 5,
          yesPercent: 50,
          noPercent: 50,
        },
      },
    }),
  );
  await page.goto("/results");
  const card = page.locator(".participation-stats");
  await expect(card).toContainText("عدد الإجابات الصالحة لهذا السؤال:");
  await expect(card).toContainText("50٪");
  await expect(card).toContainText("ليست تسجيلاً رسمياً");
  await expect(card).toContainText("إجابات «نعم/لا» الصالحة فقط");
});
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
