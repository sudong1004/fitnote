import { requireUser } from "@/app/lib/dal";
import { DeleteAccountPage } from "@/components/account/delete-account-page";
import { getMyAccount } from "@/server/account/account.service";
import { countBlockingContracts } from "@/server/account/delete-account.service";

export const metadata = { title: "회원 탈퇴 | FitNote" };

export default async function Page() {
  const user = await requireUser();
  const [account, blockingContracts] = await Promise.all([
    getMyAccount(user.id),
    countBlockingContracts(user.id),
  ]);

  return (
    <DeleteAccountPage
      backHref="/profile"
      isTrainer={user.isTrainer}
      hasPassword={account.hasPassword}
      blockingContracts={blockingContracts}
    />
  );
}
