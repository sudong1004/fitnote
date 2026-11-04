import { expect, test } from "@playwright/test";

import { PASSWORD, agreeAll, connectPair, newPage, signup, uniqueEmail } from "./helpers";

test.describe("출시 필수 기능", () => {
  test("필수 동의 없이는 가입되지 않고, 약관·방침 화면은 로그인 없이 열린다", async ({ browser }) => {
    const { context, page } = await newPage(browser);
    await page.goto("/signup");
    await page.fill("#name", "동의회원");
    await page.fill("#email", uniqueEmail("consent"));
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: "가입하기" }).click();
    await expect(page.getByText("필수 항목에 모두 동의해 주세요.")).toBeVisible();

    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: /이용약관/ }).first()).toBeVisible();
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: /개인정보/ }).first()).toBeVisible();

    await page.goto("/signup");
    await page.fill("#name", "동의회원");
    await page.fill("#email", uniqueEmail("consent2"));
    await page.fill("#password", PASSWORD);
    await agreeAll(page);
    await page.getByRole("button", { name: "가입하기" }).click();
    await page.waitForURL(/\/(home|trainer)/);
    await context.close();
  });

  test("비밀번호 찾기는 가입 여부와 상관없이 같은 안내를 보여주고, 잘못된 링크는 거절한다", async ({ browser }) => {
    const { context, page } = await newPage(browser);
    await page.goto("/login");
    await page.getByRole("link", { name: "비밀번호를 잊으셨나요?" }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await page.fill("#email", `nobody-${Date.now()}@e2e.test`);
    await page.getByRole("button", { name: "재설정 링크 받기" }).click();
    await expect(page.getByText("가입된 이메일이면 비밀번호 재설정 링크를 보냈어요.", { exact: false })).toBeVisible();

    await page.goto("/reset-password?token=not-a-real-token-not-a-real-token");
    await expect(page.getByText("링크가 만료됐거나 이미 쓴 링크예요.")).toBeVisible();
    await context.close();
  });

  test("회원 탈퇴: 비밀번호가 맞아야 하고, 탈퇴하면 로그인할 수 없다", async ({ browser }) => {
    const { context, page } = await newPage(browser);
    const email = uniqueEmail("bye");
    await signup(page, "MEMBER", "떠날회원", email);

    await page.goto("/profile");
    await page.getByRole("link", { name: "회원 탈퇴" }).click();
    await expect(page).toHaveURL(/\/profile\/delete$/);

    await page.fill("#password", "wrongpass1");
    await page.locator("input[name=confirm]").check();
    await page.getByRole("button", { name: "탈퇴하기" }).click();
    await expect(page.getByText("비밀번호가 맞지 않아요.")).toBeVisible();

    // 제출하면 입력칸이 비워지므로 다시 채운다.
    await page.fill("#password", PASSWORD);
    await page.locator("input[name=confirm]").check();
    await page.getByRole("button", { name: "탈퇴하기" }).click();
    await page.waitForURL("**/login?deleted=1");
    await expect(page.getByText("탈퇴했어요.", { exact: false })).toBeVisible();

    await page.fill("#email", email);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test("로그인한 채로도 약관·방침이 열리고 머물러 있는다", async ({ browser }) => {
    const { context, page } = await newPage(browser);
    await signup(page, "MEMBER", "약관보는회원", uniqueEmail("legal"));
    for (const path of ["/terms", "/privacy"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    await context.close();
  });
  test("처음 쓰는 트레이너 홈에 시작하기 카드가 보이고, 단계가 끝나면 체크된다", async ({ browser }) => {
    const { context, page } = await newPage(browser);
    await signup(page, "TRAINER", "새트레이너", uniqueEmail("guide"));
    const card = page.getByRole("region", { name: "시작하기" });
    await expect(card).toBeVisible();
    await expect(card.getByText("0/4 완료")).toBeVisible();
    await expect(card.getByRole("link", { name: "초대 코드 만들기" })).toBeVisible();
    await context.close();

    // 회원이 연결되면 첫 단계가 끝나고 다음 단계가 안내된다.
    const pair = await connectPair(browser);
    await pair.trainer.page.goto("/trainer");
    const next = pair.trainer.page.getByRole("region", { name: "시작하기" });
    await expect(next.getByText("1/4 완료")).toBeVisible();
    await expect(next.getByRole("link", { name: "회원 고르기" })).toBeVisible();
    await pair.trainer.context.close();
    await pair.member.context.close();
  });
});
