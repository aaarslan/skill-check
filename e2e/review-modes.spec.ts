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

for (const width of [390, 1440]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`comparison clarity and keyboard access at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await expect(page.getByRole("region", { name: "File", exact: true })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Diff", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Try review example" }).click();
      await page.getByRole("button", { name: "Create editable candidate" }).click();
      await expect(page.getByLabel("Quality score: 89 → 89", { exact: true })).toBeVisible();
      await expect(page.getByLabel("High-suspicion matches: 1 → 1", { exact: true })).toBeVisible();
      await expect(page.getByText("Score change: 0 points (unchanged)")).toBeVisible();
      await page.getByRole("region", { name: "Analysis results" }).scrollIntoViewIfNeeded();
      await page
        .getByRole("region", { name: "Analysis results" })
        .screenshot({ path: `/tmp/skillcheck-comparison-${width}-${colorScheme}.png` });
      const overview = page.getByRole("tab", { name: "Overview", exact: true });
      await overview.focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("tab", { name: "Diff", exact: true })).toBeFocused();
      await expect(page.getByLabel("Diff viewer")).toBeVisible();
      await page.keyboard.press("End");
      await expect(page.getByRole("tab", { name: "Spec compliance" })).toBeFocused();
      await page.keyboard.press("Home");
      await expect(overview).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("tabpanel")).toBeFocused();
      const importInput = page.getByLabel("Import decisions from a JSON report");
      await importInput.focus();
      await expect(importInput).toBeFocused();
      const chooser = page.waitForEvent("filechooser");
      await page.keyboard.press("Enter");
      await chooser;
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const labels = page
        .getByRole("region", { name: "Analysis results" })
        .locator('[class*="metricLabel"]');
      for (const label of await labels.all()) {
        expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      }
      await page.getByRole("button", { name: "Try review example" }).click();
      await expect(page.getByLabel("High-suspicion matches: 1 → 0", { exact: true })).toBeVisible();
      await expect(page.getByText(/Score change: \+\d+ points/)).toBeVisible();
    });
  }
}
