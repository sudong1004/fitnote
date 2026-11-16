import { expect, test, type Page } from "@playwright/test";

import { newPage, signup, uniqueEmail } from "./helpers";

async function startWorkout(page: Page) {
  await page.goto("/home");
  await page.getByRole("button", { name: /운동 시작하기/ }).click();
  await page.waitForURL(/\/workouts\/[0-9a-f-]{36}$/);
}

test.describe("운동 직접 만들기", () => {
  test("운동 선택창에서 바로 만들어 기록하고, 고치고, 지울 수 있다. 남에게는 보이지 않는다", async ({
    browser,
  }) => {
    const owner = await newPage(browser);
    const other = await newPage(browser);
    const name = `케이블 힙 어브덕션 ${Date.now().toString(36)}`;

    await signup(owner.page, "MEMBER", "만든이", uniqueEmail("ce"));
    await signup(other.page, "MEMBER", "다른이", uniqueEmail("ce2"));

    // 찾는 운동이 없으면 선택창 안에서 바로 만든다.
    await startWorkout(owner.page);
    await owner.page.getByRole("button", { name: "운동 추가" }).first().click();
    await owner.page.getByLabel("운동 검색").fill(name);
    await expect(owner.page.getByText(/검색 결과가 없어요/)).toBeVisible();
    await owner.page.getByRole("button", { name: "직접 만들기" }).click();

    await expect(owner.page.getByLabel("운동 이름")).toHaveValue(name);
    await owner.page.getByRole("button", { name: "만들기", exact: true }).click();
    await expect(owner.page.getByRole("alert")).toHaveText("부위를 골라주세요.");

    await owner.page.getByRole("button", { name: "둔근", exact: true }).click();
    await owner.page.getByRole("button", { name: "만들기", exact: true }).click();

    // 만들면 바로 선택된 채로 목록에 나온다.
    await expect(owner.page.getByRole("button", { name: "1개 추가" })).toBeVisible();
    await expect(owner.page.getByText("둔근 · 내 운동")).toBeVisible();
    await owner.page.getByRole("button", { name: "1개 추가" }).click();
    await expect(owner.page.getByRole("button", { name: "세트 추가" })).toBeVisible();

    // 같은 이름으로 또 만들 수 없다.
    await owner.page.getByRole("button", { name: "운동 추가" }).first().click();
    await owner.page.getByLabel("운동 검색").fill(name);
    await owner.page.getByRole("button", { name: "찾는 운동이 없나요? 직접 만들기" }).click();
    await owner.page.getByRole("button", { name: "둔근", exact: true }).click();
    await owner.page.getByRole("button", { name: "만들기", exact: true }).click();
    await expect(owner.page.getByRole("alert")).toHaveText("이미 만든 운동이에요.");
    await owner.page.keyboard.press("Escape");

    // "내 운동" 탭에서 보이고, 상세에는 난이도 대신 "내 운동" 이 붙는다.
    await owner.page.goto("/exercises?custom=1");
    await owner.page.getByRole("link", { name: new RegExp(name) }).click();
    await owner.page.waitForURL(/\/exercises\/[0-9a-f-]{36}$/);
    const detailUrl = owner.page.url();
    await expect(owner.page.getByRole("heading", { name })).toBeVisible();
    await expect(owner.page.getByText("내 운동").first()).toBeVisible();
    await expect(owner.page.getByText("필요한 기구")).toHaveCount(0);

    // 남에게는 목록에도, 주소로도 없는 운동이다.
    await other.page.goto(`/exercises?search=${encodeURIComponent(name)}`);
    await expect(other.page.getByText(name)).toHaveCount(0);
    await other.page.goto(detailUrl);
    await expect(other.page.getByRole("heading", { name: "찾는 화면이 없어요" })).toBeVisible();
    await other.page.goto(`${detailUrl}/edit`);
    await expect(other.page.getByRole("heading", { name: "찾는 화면이 없어요" })).toBeVisible();

    // 수정.
    await owner.page.goto(detailUrl);
    await owner.page.getByRole("link", { name: "수정" }).click();
    await owner.page.getByLabel("자극 부위").fill("중둔근");
    await owner.page.getByRole("button", { name: "저장하기" }).click();
    await owner.page.waitForURL(detailUrl);
    await expect(owner.page.getByText("중둔근").first()).toBeVisible();

    // 삭제는 두 번 눌러야 한다. 기록에 쓴 운동이라 목록에서만 사라진다.
    await owner.page.getByRole("button", { name: "삭제" }).click();
    await owner.page.getByRole("button", { name: "정말 지우기" }).click();
    await owner.page.waitForURL(/\/exercises\?custom=1$/);
    await expect(owner.page.getByText(/직접 만든 운동이 없어요/)).toBeVisible();

    await owner.context.close();
    await other.context.close();
  });
});
