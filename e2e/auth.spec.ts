import { expect, test } from "@playwright/test";

import {
  PASSWORD,
  expectPath,
  login,
  mailsTo,
  newPage,
  randomIpHeaders,
  agreeAll,
  signup,
  uniqueEmail,
  verificationLink,
} from "./helpers";

test.describe("가입과 로그인", () => {
  test.beforeEach(async ({ context }) => {
    await context.setExtraHTTPHeaders(randomIpHeaders());
  });

  test("로그인 화면에서 회원가입으로 갈 수 있다", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "회원가입" }).click();

    await expectPath(page, "/signup");
    await expect(page.getByRole("heading", { name: "회원가입" })).toBeVisible();
  });

  test("가입 입력이 잘못되면 이유를 보여주고 가입하지 않는다", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.fill("#name", "김");
    await page.fill("#email", "ok@e2e.test");
    await page.fill("#password", "short");
    await page.fill("#confirmPassword", "short");
    await page.getByRole("button", { name: "가입하기" }).click();

    await expect(page.getByText("이름은 2자 이상")).toBeVisible();
    await expect(page.getByText("비밀번호는 8자 이상")).toBeVisible();
    await expectPath(page, "/signup");
  });

  test("회원으로 가입하면 회원 화면으로, 트레이너로 가입하면 트레이너 화면으로 간다", async ({
    browser,
  }) => {
    const member = await newPage(browser);
    await signup(member.page, "MEMBER", "회원이", uniqueEmail("member"));
    await expectPath(member.page, "/home");

    const trainer = await newPage(browser);
    await signup(trainer.page, "TRAINER", "트레이너", uniqueEmail("trainer"));
    await expectPath(trainer.page, "/trainer");

    await member.context.close();
    await trainer.context.close();
  });

  test("한 계정은 다른 역할의 화면에 들어가지 못한다", async ({ browser }) => {
    const member = await newPage(browser);
    await signup(member.page, "MEMBER", "회원이", uniqueEmail("member"));
    await member.page.goto("/trainer");
    await expectPath(member.page, "/home");

    const trainer = await newPage(browser);
    await signup(trainer.page, "TRAINER", "트레이너", uniqueEmail("trainer"));
    await trainer.page.goto("/home");
    await expectPath(trainer.page, "/trainer");

    await member.context.close();
    await trainer.context.close();
  });

  test("가입하면 메일을 확인하라는 화면이 뜨고, 인증하기 전에는 로그인되지 않는다", async ({
    browser,
  }) => {
    const { context, page } = await newPage(browser);
    const email = uniqueEmail("verify");

    await page.goto("/signup");
    await page.fill("#name", "인증회원");
    await page.fill("#email", email);
    await page.fill("#password", PASSWORD);
    await page.fill("#confirmPassword", PASSWORD);
    await agreeAll(page);
    await page.getByRole("button", { name: "가입하기" }).click();

    await expectPath(page, "/verify-email");
    await expect(page.getByRole("heading", { name: "메일을 확인해 주세요" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // 아직 로그인된 것이 아니다.
    await page.goto("/home");
    await expectPath(page, "/login");

    const firstLink = await verificationLink(email);

    // 비밀번호가 맞아도 인증 전에는 들어가지 못하고, 인증 메일이 다시 온다.
    await page.fill("#email", email);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
    await expectPath(page, "/verify-email");
    await expect.poll(async () => (await mailsTo(email)).length).toBe(2);

    // 새 메일이 나가면 예전 링크는 쓸 수 없다.
    await page.goto(firstLink);
    await expect(page.getByText("링크가 만료됐거나 새 링크가 나간 뒤예요.")).toBeVisible();

    // 링크를 여는 것만으로는 인증되지 않고, 버튼을 눌러야 끝난다.
    const link = await verificationLink(email);
    expect(link).not.toBe(firstLink);
    await page.goto(link);
    await page.goto("/login");
    await page.fill("#email", email);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
    await expectPath(page, "/verify-email");

    await page.goto(await verificationLink(email));
    await page.getByRole("button", { name: "이메일 인증 끝내기" }).click();
    await expect(page.getByText("이메일 인증이 끝났어요. 로그인해 주세요.")).toBeVisible();

    await page.fill("#email", email);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
    await expectPath(page, "/home");

    // 같은 링크를 다시 열면 이미 끝났다고 알려 준다.
    const done = await newPage(browser);
    await done.page.goto(await verificationLink(email));
    await expect(done.page.getByText("이미 인증이 끝난 이메일이에요.")).toBeVisible();

    await done.context.close();
    await context.close();
  });

  test("이미 가입한 이메일로 다시 가입해도 화면은 같고, 그 주소로 안내 메일만 간다", async ({
    browser,
  }) => {
    const email = uniqueEmail("dup");
    const first = await newPage(browser);
    await signup(first.page, "MEMBER", "첫번째", email);

    const second = await newPage(browser);
    await second.page.goto("/signup");
    await second.page.fill("#name", "두번째");
    await second.page.fill("#email", email);
    await second.page.fill("#password", "Other1234pw");
    await second.page.fill("#confirmPassword", "Other1234pw");
    await agreeAll(second.page);
    await second.page.getByRole("button", { name: "가입하기" }).click();

    // 가입된 주소인지 화면으로는 알 수 없다.
    await expectPath(second.page, "/verify-email");
    await expect(second.page.getByRole("heading", { name: "메일을 확인해 주세요" })).toBeVisible();

    await expect
      .poll(async () => (await mailsTo(email)).at(-1)?.subject)
      .toBe("FitNote 가입 안내");

    // 원래 계정은 그대로다: 두 번째 사람이 적은 비밀번호로는 못 들어오고, 원래 비밀번호로는 들어온다.
    await second.page.goto("/login");
    await second.page.fill("#email", email);
    await second.page.fill("#password", "Other1234pw");
    await second.page.getByRole("button", { name: "로그인" }).click();
    await expect(second.page.getByText("이메일 또는 비밀번호가 올바르지 않습니다.")).toBeVisible();

    await login(second.page, email);
    await expectPath(second.page, "/home");
    await expect(second.page.getByText("첫번째").first()).toBeVisible();

    await first.context.close();
    await second.context.close();
  });

  test("인증하지 않은 주소는 다시 가입하면 새 가입이 그 자리를 가져간다", async ({ browser }) => {
    const email = uniqueEmail("retake");
    const squatter = await newPage(browser);
    await squatter.page.goto("/signup");
    await squatter.page.fill("#name", "먼저온사람");
    await squatter.page.fill("#email", email);
    await squatter.page.fill("#password", "Squat1234pw");
    await squatter.page.fill("#confirmPassword", "Squat1234pw");
    await agreeAll(squatter.page);
    await squatter.page.getByRole("button", { name: "가입하기" }).click();
    await expectPath(squatter.page, "/verify-email");
    const staleLink = await verificationLink(email);

    const owner = await newPage(browser);
    await signup(owner.page, "TRAINER", "진짜주인", email);
    await expectPath(owner.page, "/trainer");

    // 먼저 적어 둔 사람의 링크와 비밀번호는 쓸 수 없다.
    await squatter.page.goto(staleLink);
    await expect(squatter.page.getByText("링크가 만료됐거나 새 링크가 나간 뒤예요.")).toBeVisible();
    await squatter.page.goto("/login");
    await squatter.page.fill("#email", email);
    await squatter.page.fill("#password", "Squat1234pw");
    await squatter.page.getByRole("button", { name: "로그인" }).click();
    await expect(squatter.page.getByText("이메일 또는 비밀번호가 올바르지 않습니다.")).toBeVisible();

    await squatter.context.close();
    await owner.context.close();
  });

  test("로그아웃한 뒤 다시 로그인하면 역할에 맞는 화면으로 간다", async ({
    page,
  }) => {
    const email = uniqueEmail("trainer");
    await signup(page, "TRAINER", "트레이너", email);

    await page.goto("/trainer/profile");
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expectPath(page, "/login");

    // 로그아웃 상태에서는 보호된 화면이 로그인으로 돌려보낸다.
    await page.goto("/trainer");
    await expectPath(page, "/login");

    await login(page, email);
    await expectPath(page, "/trainer");
  });

  test("비밀번호가 틀리면 로그인되지 않는다", async ({ page }) => {
    const email = uniqueEmail("member");
    await signup(page, "MEMBER", "회원이", email);
    await page.context().clearCookies();

    await page.goto("/login");
    await page.fill("#email", email);
    await page.fill("#password", "Wrong-pass-1");
    await page.getByRole("button", { name: "로그인" }).click();

    await expect(
      page.getByText("이메일 또는 비밀번호가 올바르지 않습니다."),
    ).toBeVisible();
    await expectPath(page, "/login");
  });
});
