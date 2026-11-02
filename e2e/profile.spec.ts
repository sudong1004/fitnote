import { expect, test } from "@playwright/test";

import { PASSWORD, newPage, signup, uniqueEmail } from "./helpers";

test.describe("내 정보 수정", () => {
  test("회원이 이름을 바꾸면 내 정보에 바로 보인다", async ({ browser }) => {
    const { context, page } = await newPage(browser);
    await signup(page, "MEMBER", "처음이름", uniqueEmail("edit"));

    await page.goto("/profile");
    await page.getByRole("link", { name: "수정" }).click();
    await expect(page).toHaveURL(/\/profile\/edit$/);

    await page.locator("input[name=name]").fill("바꾼이름");
    await page.locator("input[name=phone]").fill("010-1234-5678");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("저장했어요.")).toBeVisible();

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "바꾼이름" })).toBeVisible();

    await context.close();
  });

  test("비밀번호는 지금 비밀번호가 맞아야 바뀌고, 바꾼 비밀번호로 다시 로그인된다", async ({ browser }) => {
    const { context, page } = await newPage(browser);
    const email = uniqueEmail("pw");
    await signup(page, "MEMBER", "비번회원", email);

    await page.goto("/profile/edit");
    await page.locator("input[name=currentPassword]").fill("wrongpass1");
    await page.locator("input[name=newPassword]").fill("Newpass456");
    await page.locator("input[name=confirmPassword]").fill("Newpass456");
    await page.getByRole("button", { name: "비밀번호 바꾸기" }).click();
    await expect(page.getByText("지금 비밀번호가 맞지 않아요.")).toBeVisible();

    await page.locator("input[name=currentPassword]").fill(PASSWORD);
    await page.locator("input[name=newPassword]").fill("Newpass456");
    await page.locator("input[name=confirmPassword]").fill("Newpass456");
    await page.getByRole("button", { name: "비밀번호 바꾸기" }).click();
    await expect(page.getByText("비밀번호를 바꿨어요.", { exact: false })).toBeVisible();

    // 지금 기기는 로그인이 유지된다.
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "비번회원" })).toBeVisible();

    // 새 비밀번호로 다른 창에서 로그인된다.
    const other = await newPage(browser);
    await other.page.goto("/login");
    await other.page.fill("#email", email);
    await other.page.fill("#password", "Newpass456");
    await other.page.getByRole("button", { name: "로그인" }).click();
    await other.page.waitForURL("**/home");

    await other.context.close();
    await context.close();
  });

  test("트레이너가 소개를 쓰면 내 정보에 보인다", async ({ browser }) => {
    const { context, page } = await newPage(browser);
    await signup(page, "TRAINER", "코치", uniqueEmail("intro"));

    await page.goto("/trainer/profile");
    await page.getByRole("link", { name: "회원에게 보일 소개 쓰기" }).click();
    await expect(page).toHaveURL(/\/trainer\/profile\/edit$/);

    await page.locator("input[name=specialty]").fill("재활, 체형 교정");
    await page.locator("input[name=careerYears]").fill("7");
    await page.locator("textarea[name=bio]").fill("천천히, 다치지 않게.");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("저장했어요.")).toBeVisible();

    await page.goto("/trainer/profile");
    await expect(page.getByText("체형 교정")).toBeVisible();
    await expect(page.getByText("경력 7년")).toBeVisible();
    await expect(page.getByText("천천히, 다치지 않게.")).toBeVisible();

    await context.close();
  });
});
