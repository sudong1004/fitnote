import { expect, test } from "@playwright/test";

import { connectPair } from "./helpers";

test.describe("다음 수업 잡기", () => {
  test("수업을 완료로 마치면 날짜를 직접 골라 다음 수업을 잡을 수 있다", async ({ browser }) => {
    const { trainer, member, memberUrl } = await connectPair(browser);
    const { page } = trainer;

    await page.getByRole("link", { name: "계약 등록" }).first().click();
    await page.fill("input[name=title]", "PT 10회");
    await page.getByRole("button", { name: "계약 등록하기" }).click();
    await page.waitForURL(memberUrl);
    await page.getByRole("link", { name: /PT 10회/ }).first().click();
    await page.waitForURL(/\/contracts\/[^/]+$/);

    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    await page.locator("button:has-text('수업 잡기')").first().click();
    await expect(page.getByText("1회차 수업")).toBeVisible();

    await page.locator('a[href*="/trainer/sessions/"]').first().click();
    await page.waitForURL(/\/trainer\/sessions\/[^/?]+$/);
    await page.getByRole("button", { name: "완료로 저장" }).click();

    // 날짜는 미리 골라 두지 않는다.
    const sheet = page.getByRole("dialog", { name: "다음 수업도 잡을까요?" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "날짜를 골라 주세요" })).toBeDisabled();

    await sheet.getByRole("radio").nth(2).click();
    await sheet.getByRole("button", { name: /잡기$/ }).click();

    await expect(page.getByText(/다음 수업을 .+에 잡았어요\./)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await trainer.context.close();
    await member.context.close();
  });

  test("나중에를 누르면 시트가 닫힌다", async ({ browser }) => {
    const { trainer, member, memberUrl } = await connectPair(browser);
    const { page } = trainer;

    await page.getByRole("link", { name: "계약 등록" }).first().click();
    await page.fill("input[name=title]", "PT 5회");
    await page.getByRole("button", { name: "계약 등록하기" }).click();
    await page.waitForURL(memberUrl);
    await page.getByRole("link", { name: /PT 5회/ }).first().click();
    await page.waitForURL(/\/contracts\/[^/]+$/);
    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    await page.locator("button:has-text('수업 잡기')").first().click();
    await page.locator('a[href*="/trainer/sessions/"]').first().click();
    await page.getByRole("button", { name: "완료로 저장" }).click();

    await page.getByRole("button", { name: "나중에" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(/완료했어요/)).toBeVisible();

    await trainer.context.close();
    await member.context.close();
  });
});
