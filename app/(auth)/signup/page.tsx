import { AuthShell } from "@/components/auth/auth-shell";
import { previewMemberClaimCode } from "@/server/trainers/connection-claim.service";

import { ClaimForm } from "./claim-form";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  const { code } = await searchParams;
  const claimCode = typeof code === "string" ? code : "";

  // 트레이너가 보낸 이어받기 링크(?code=)면 그 계정을 이어받는 화면을 보여 준다.
  const claim = claimCode ? await previewMemberClaimCode(claimCode) : null;

  return claim ? (
    <AuthShell
      compact
      title={`${claim.memberName}님, 반가워요`}
      subtitle={
        <>
          <b className="font-bold text-ink">{claim.trainerName}</b> 트레이너가 먼저 만들어 둔 계정이에요.
          이메일과 비밀번호만 정하면 그동안 쌓인 PT 기록과 알림장을 바로 볼 수 있어요.
        </>
      }
    >
      <ClaimForm code={claimCode} />
    </AuthShell>
  ) : (
    <AuthShell compact title="회원가입" subtitle="1분이면 시작할 수 있어요.">
      <SignupForm />
    </AuthShell>
  );
}
