import { expect, test, type Page } from "@playwright/test";

import { kstDateKey, newPage, signup, uniqueEmail } from "./helpers";

const BROKEN = "화면을 불러오지 못했어요";

/** 폼의 브라우저 검사를 끄고 값을 그대로 넣는다. 요청을 직접 만들어 보내는 경우를 흉내 낸다. */
async function forceValues(page: Page, values: Record<string, string>) {
  await page.evaluate((values) => {
    for (const form of document.querySelectorAll("form")) form.noValidate = true;

    for (const [name, value] of Object.entries(values)) {
      const input = document.querySelector<HTMLInputElement>(`[name="${name}"]`);
      if (!input) continue;
      if (input.type !== "hidden") input.type = "text";
      input.removeAttribute("max");
      input.removeAttribute("min");
      input.value = value;
    }
  }, values);
}

test.describe("회원 화면의 입력 검사", () => {
  test("주소에 이상한 값을 넣어도 오류 화면이 뜨지 않는다", async ({ browser }) => {
    const member = await newPage(browser);
    const { page } = member;
    await signup(page, "MEMBER", "주소회원", uniqueEmail("url"));

    for (const url of [
      "/calendar?month=2026-13",
      "/calendar?month=0000-00",
      "/calendar?month=9999-99&date=9999-99-99",
      "/calendar?date=0001-01-01",
      "/calendar?date=2026-02-31",
      "/exercises?page=99999999999999999999",
      "/exercises?page=-3&bodyPart=ZZZ",
      "/diet?date=9999-12-31",
      "/diet?date=0001-01-01",
      "/diet/new?date=9999-12-31&meal=ZZZ",
      "/body?metric=ZZZ",
      "/body/goal?type=ZZZ",
    ]) {
      await page.goto(url);
      await expect(page.locator("main").first(), url).toBeVisible();
      await expect(page.getByText(BROKEN), url).toHaveCount(0);
    }

    await member.context.close();
  });

  test("체성분과 목표는 받을 수 없는 날짜를 한국어로 거절한다", async ({ browser }) => {
    const member = await newPage(browser);
    const { page } = member;
    await signup(page, "MEMBER", "날짜회원", uniqueEmail("date"));

    for (const dateKey of ["0001-01-01", "2026-02-31", "2999-01-01"]) {
      await page.goto("/body/new");
      await forceValues(page, { dateKey, weightKg: "70" });
      await page.getByRole("button", { name: "저장하기" }).click();
      await expect(page.getByText(/^날짜를 확인해주세요\./), dateKey).toBeVisible();
    }

    await page.goto("/body/new");
    await forceValues(page, { bodyFatPercent: "99" });
    await page.getByRole("button", { name: "저장하기" }).click();
    await expect(
      page.getByText("체지방률은 1~70% 사이 숫자로 넣어주세요."),
    ).toBeVisible();

    for (const targetDate of ["zzzz", kstDateKey(1), "9999-12-31"]) {
      await page.goto("/body/goal");
      await forceValues(page, { targetValue: "68", targetDate });
      await page.getByRole("button", { name: "목표 세우기" }).click();
      await expect(page.getByText(/^날짜를 확인해주세요\./), targetDate).toBeVisible();
    }

    await page.goto("/body");
    await expect(page.getByText("아직 잰 기록이 없어요")).toBeVisible();

    await member.context.close();
  });

  test("식단은 내일 날짜로 남길 수 없고, 이미 지운 기록을 또 지워도 목록으로 돌아간다", async ({
    browser,
  }) => {
    const member = await newPage(browser);
    const { page, context } = member;
    await signup(page, "MEMBER", "식단검사", uniqueEmail("dietcheck"));

    await page.goto("/diet/new");
    await forceValues(page, { date: "2999-01-01" });
    await page.fill("#foodName", "내일 먹을 밥");
    await page.getByRole("button", { name: "남기기" }).click();
    await expect(
      page.getByText("날짜를 확인해주세요. 오늘까지만 남길 수 있어요."),
    ).toBeVisible();

    await page.fill("#foodName", "오늘 먹은 밥");
    await page.getByRole("button", { name: "남기기" }).click();
    await page.waitForURL(/\/diet\/[0-9a-f-]{36}$/);

    // 같은 기록을 두 탭에서 열어 두고 양쪽에서 지운다.
    const second = await context.newPage();
    await second.goto(page.url());

    await page.getByRole("button", { name: "삭제" }).click();
    await page.waitForURL(/\/diet(\?|$)/);

    await second.getByRole("button", { name: "삭제" }).click();
    await second.waitForURL(/\/diet(\?|$)/);
    await expect(second.getByText(BROKEN)).toHaveCount(0);
    await expect(second.getByText("오늘 먹은 밥")).toHaveCount(0);

    await context.close();
  });
});
