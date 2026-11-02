import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Skillcheck" })).toBeVisible();
});

test("single-file review shows quality, injection, and spec via worker analysis", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Try review example" }).click();
  await expect(page.getByText("Quality score").first()).toBeVisible();
  await page.getByRole("tab", { name: "Prompt injection" }).click();
  await expect(page.getByText(/instruction-override|Ignore/i).first()).toBeVisible();
  await page.getByRole("tab", { name: "Spec compliance" }).click();
  await expect(page.getByText("Agent Skills spec").first()).toBeVisible();
});

test("compare mode shows a diff between revisions", async ({ page }) => {
  await page.getByRole("button", { name: "Compare revisions" }).click();
  await page.getByRole("button", { name: "Try review example" }).click();
  await page.getByRole("tab", { name: "Diff" }).click();
  await expect(page.getByLabel("Diff viewer")).toBeVisible();
  await expect(page.getByText(/Changed lines/).first()).toBeVisible();
});

test("folder review analyzes the sample package", async ({ page }) => {
  await page.getByRole("button", { name: "Review folder" }).click();
  await page.getByRole("button", { name: "Try sample package" }).click();
  await expect(page.getByRole("heading", { name: /files reviewed/u })).toBeVisible();
  await expect(page.getByText(/spec findings/u).first()).toBeVisible();
});

test("light color scheme renders a light background", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [r = 0, g = 0, b = 0] = bodyBg.match(/\d+/gu)?.map(Number) ?? [];
  expect(r + g + b).toBeGreaterThan(600);
  await page.screenshot({ path: "/tmp/skillcheck-light.png", fullPage: false });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [dr = 0, dg = 0, db = 0] = darkBg.match(/\d+/gu)?.map(Number) ?? [];
  expect(dr + dg + db).toBeLessThan(120);
  await page.screenshot({ path: "/tmp/skillcheck-dark.png", fullPage: false });
});

test("mobile viewport keeps primary actions reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("button", { name: "Try review example" })).toBeVisible();
  await page.getByRole("button", { name: "Try review example" }).click();
  await expect(page.getByText("Quality score").first()).toBeVisible();
  await page.screenshot({ path: "/tmp/skillcheck-mobile.png", fullPage: false });
});
