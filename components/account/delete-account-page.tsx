import { DeleteAccountForm } from "@/components/account/delete-account-form";
import { PageHeader } from "@/components/layout/page-header";

/** 회원·트레이너 탈퇴 화면. 무엇이 지워지고 무엇이 남는지 먼저 보여준다. */
export function DeleteAccountPage({
  backHref,
  isTrainer,
  hasPassword,
  blockingContracts,
}: {
  backHref: string;
  isTrainer: boolean;
  hasPassword: boolean;
  blockingContracts: number;
}) {
  return (
    <main className="mx-auto w-full max-w-md pb-6">
      <PageHeader backHref={backHref} backLabel="내 정보로" title="회원 탈퇴" />
      <div className="flex flex-col gap-3 px-4 pt-1.5">
        <section className="rounded-[1.375rem] border border-border bg-card p-4.5 text-sm leading-relaxed">
          <h2 className="mb-2 text-[0.9375rem] font-extrabold">탈퇴하면 이렇게 돼요</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-4.5 text-muted-foreground">
            <li>
              <b className="text-foreground">바로 지워져요</b>: 이름·이메일·전화번호, 식단과 사진, 체성분, 목표, 혼자
              한 운동 기록, 알림
            </li>
            <li>
              <b className="text-foreground">이름 없이 남아요</b>: 트레이너와 함께 남긴 PT 계약·수업 회차·알림장·댓글.
              상대방의 업무 기록이라 지우지 않고, 작성자는 &ldquo;탈퇴한 {isTrainer ? "트레이너" : "회원"}&rdquo;으로
              보여요.
            </li>
            <li>앞으로 잡힌 PT 수업은 취소되고 횟수는 차감되지 않아요.</li>
            {isTrainer ? <li>담당 회원과의 연결이 끝나고 초대 코드는 더 쓸 수 없어요.</li> : null}
            <li>같은 이메일로 다시 가입할 수 있지만, 지운 기록은 되살릴 수 없어요.</li>
          </ul>
        </section>

        {blockingContracts > 0 ? (
          <p className="rounded-2xl bg-status-urgent-bg px-4 py-3.5 text-sm font-bold leading-relaxed text-status-urgent">
            진행 중인 PT 계약이 {blockingContracts}건 있어요. 남은 회차를 마무리하거나 계약을 끝낸 뒤 탈퇴할 수 있어요.
          </p>
        ) : (
          <DeleteAccountForm hasPassword={hasPassword} />
        )}
      </div>
    </main>
  );
}
