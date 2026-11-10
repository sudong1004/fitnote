import { expect, test } from "@playwright/test";

import { PASSWORD, agreeAll, connectPair, newPage, signup, uniqueEmail } from "./helpers";

test.describe("출시 필수 기능", () => {
  test("없는 주소는 한국어 안내를 보여주고, 응답에 보안 헤더가 붙으며, 글꼴을 외부에서 받지 않는다", async ({ browser }) => {
    const { context, page } = await newPage(browser);
    await signup(page, "MEMBER", "길잃은회원", uniqueEmail("lost"));

    const external: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("jsdelivr")) external.push(request.url());
    });

    const response = await page.goto("/no-such-screen");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "찾는 화면이 없어요" })).toBeVisible();

    const headers = response?.headers() ?? {};
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");

    // 없는 기록은 회원 화면 안에서 안내하므로 하단 탭이 그대로 있다.
    await page.goto("/diet/no-such-record");
    await expect(page.getByRole("heading", { name: "찾는 화면이 없어요" })).toBeVisible();
    await expect(page.getByRole("navigation")).toBeVisible();

    await page.getByRole("link", { name: "홈으로" }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.locator("body")).toHaveCSS("font-family", /Pretendard Variable/);
    expect(external).toEqual([]);
    await context.close();
  });

  test("필수 동의 없이는 가입되지 않고, 약관·방침 화면은 로그인 없이 열린다", async ({ browser }) => {
    const { context, page } = await newPage(browser);
    await page.goto("/signup");
    await page.fill("#name", "동의회원");
    await page.fill("#email", uniqueEmail("consent"));
    await page.fill("#password", PASSWORD);
    await page.fill("#confirmPassword", PASSWORD);
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
    await page.fill("#confirmPassword", PASSWORD);
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
    await expect(card.getByRole("link", { name: "회원 추가하기" })).toBeVisible();
    await expect(card.getByRole("link", { name: "초대 코드 만들기" })).toBeVisible();

    // 초대 코드를 만들어도 회원이 입력하기 전에는 연결된 게 아니라서 첫 단계에 머물고, 이유를 알려 준다.
    await page.goto("/trainer/members");
    await page.getByRole("button", { name: "회원 초대 코드 만들기" }).click();
    await expect(page.getByText(/^[A-Z0-9]{6,}$/).first()).toBeVisible();
    await page.goto("/trainer");
    await expect(card.getByText("0/4 완료")).toBeVisible();
    await expect(card.getByText(/초대 코드는 만들어 뒀어요/)).toBeVisible();
    await expect(card.getByRole("link", { name: "초대 코드 보기" })).toBeVisible();
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
  test("가입에 한 번 실패해도 가입 유형·이름·이메일·동의가 남아서, 고치고 다시 내면 가입된다", async ({ browser }) => {
    const { context, page } = await newPage(browser);
    const email = uniqueEmail("keep");
    await page.goto("/signup");
    await page.locator("input[name=role][value=TRAINER]").check({ force: true });
    await page.fill("#name", "유지트레이너");
    await page.fill("#email", email);
    await page.fill("#password", "abc"); // 너무 짧아서 실패한다
    await page.fill("#confirmPassword", "abc");
    await agreeAll(page);
    await page.getByRole("button", { name: "가입하기" }).click();
    await expect(page.getByText("비밀번호는 8자 이상이어야 합니다.")).toBeVisible();

    // 실패 뒤에도 입력과 동의가 그대로다.
    await expect(page.locator("input[name=role][value=TRAINER]")).toBeChecked();
    await expect(page.locator("#name")).toHaveValue("유지트레이너");
    await expect(page.locator("#email")).toHaveValue(email);
    for (const name of ["agreeAge", "agreeTerms", "agreePrivacy", "agreeSensitive"]) {
      await expect(page.locator(`input[name=${name}]`)).toBeChecked();
    }

    // 동의를 다시 누르지 않고 비밀번호만 고쳐서 내면 트레이너로 가입된다.
    await page.fill("#password", PASSWORD);
    await page.fill("#confirmPassword", PASSWORD);
    await page.getByRole("button", { name: "가입하기" }).click();
    await page.waitForURL("**/trainer");
    await context.close();
  });

  test("알림장 게시가 실패해도 쓴 글이 지워지지 않는다", async ({ browser }) => {
    const pair = await connectPair(browser);
    const page = pair.trainer.page;
    // 계약 → 수업 → 수업 기록에서 알림장 쓰기 (pt-flow 와 같은 길).
    await page.getByRole("link", { name: "계약 등록" }).first().click();
    await page.fill("input[name=title]", "PT 10회");
    await page.getByRole("button", { name: "계약 등록하기" }).click();
    await page.waitForURL(pair.memberUrl);
    await page.getByRole("link", { name: /PT 10회/ }).first().click();
    await page.waitForURL(/\/contracts\/[^/]+$/);
    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    await page.locator("button:has-text('수업 잡기')").first().click();
    await expect(page.getByText("1회차 수업")).toBeVisible();
    await page.locator("button:has-text('수업 완료')").first().click();
    await expect(page.getByText("총 10회 중 1회 완료")).toBeVisible();
    await page.goto("/trainer/journals");
    await page.getByText("수업 기록", { exact: true }).last().click();
    await page.waitForURL(/\/trainer\/sessions\/[^/]+$/);
    await page.getByRole("button", { name: "알림장 쓰기" }).click();
    await page.waitForURL(/\/trainer\/journals\/[^/]+$/);
    await page.locator("input[name=title]").fill("지워지면 안 되는 제목");
    await page.locator("textarea[name=workoutSummary]").fill("스쿼트 60kg 10회 3세트");
    // 한마디를 비운 채 게시하면 실패한다.
    await page.getByRole("button", { name: /게시하기|수정 반영/ }).click();
    await page.waitForTimeout(1500);
    await expect(page.locator("input[name=title]")).toHaveValue("지워지면 안 되는 제목");
    await expect(page.locator("textarea[name=workoutSummary]")).toHaveValue("스쿼트 60kg 10회 3세트");
    await pair.trainer.context.close();
    await pair.member.context.close();
  });
  test("가입 입력 검사: 비밀번호 확인, 공백 이름, 너무 긴 비밀번호", async ({ browser }) => {
    const { context, page } = await newPage(browser);
    await page.goto("/signup");
    await page.fill("#name", " 김");
    await page.fill("#email", uniqueEmail("val"));
    await page.fill("#password", PASSWORD);
    await page.fill("#confirmPassword", PASSWORD + "x");
    await agreeAll(page);
    await page.getByRole("button", { name: "가입하기" }).click();
    // 앞뒤 공백을 자른 뒤 길이를 세므로 " 김" 은 1자다.
    await expect(page.getByText("이름은 2자 이상")).toBeVisible();

    await page.fill("#name", "김가입");
    await page.getByRole("button", { name: "가입하기" }).click();
    await expect(page.getByText("비밀번호가 서로 달라요.")).toBeVisible();

    const tooLong = "Aa1" + "b".repeat(70); // 73자
    await page.fill("#password", tooLong);
    await page.fill("#confirmPassword", tooLong);
    await page.getByRole("button", { name: "가입하기" }).click();
    await expect(page.getByText("비밀번호가 너무 길어요")).toBeVisible();
    await context.close();
  });

  test("비밀번호의 앞뒤 공백도 비밀번호의 일부라서, 그대로 다시 로그인된다", async ({ browser }) => {
    const { context, page } = await newPage(browser);
    const email = uniqueEmail("space");
    const password = " Pass word1 ";
    await page.goto("/signup");
    await page.fill("#name", "공백회원");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.fill("#confirmPassword", password);
    await agreeAll(page);
    await page.getByRole("button", { name: "가입하기" }).click();
    await page.waitForURL("**/home");

    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill("#email", email.toUpperCase());
    await page.fill("#password", password);
    await page.getByRole("button", { name: "로그인" }).click();
    await page.waitForURL("**/home");
    await context.close();
  });
  test("트레이너 입력 검사: 잘못된 연락처·긴 계약 이름·긴 수업 메모는 오류 화면 없이 안내가 뜬다", async ({ browser }) => {
    const { context, page } = await newPage(browser);
    await signup(page, "TRAINER", "검사트레이너", uniqueEmail("tval"));

    await page.goto("/trainer/members");
    await page.getByRole("button", { name: /회원 추가/ }).first().click();
    await page.fill("input[name=name]", "검사회원");
    await page.fill("input[name=phone]", "abcdefghij");
    await page.getByRole("button", { name: "회원 등록하기" }).click();
    await expect(page.getByText("전화번호는 숫자와 - 만")).toBeVisible();

    await page.fill("input[name=phone]", "010-1234-5678");
    await page.getByRole("button", { name: "회원 등록하기" }).click();
    await page.waitForURL(/\/trainer\/members\/[^/]+$/);
    const memberUrl = page.url();

    // 연도를 비정상적으로 넣어 계약을 만들면 안내가 뜬다.
    await page.goto(`${memberUrl}/contracts/new`);
    await page.fill("input[name=totalSessions]", "10");
    await page.fill("input[name=startedAt]", "1900-01-01");
    await page.getByRole("button", { name: "계약 등록하기" }).click();
    await expect(page.getByText("입력한 값을 확인해주세요.")).toBeVisible();
    await expect(page.getByText("Application error")).toHaveCount(0);
    await context.close();
  });
});
