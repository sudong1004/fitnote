import { requireUser } from "@/app/lib/dal";
import { PasswordForm, ProfileForm } from "@/components/account/account-edit";
import { PageHeader } from "@/components/layout/page-header";
import { getMyAccount } from "@/server/account/account.service";

export const metadata = { title: "내 정보 수정 | FitNote" };

export default async function EditProfilePage() {
  const user = await requireUser();
  const account = await getMyAccount(user.id);

  return (
    <main className="mx-auto w-full max-w-md pb-6">
      <PageHeader backHref="/profile" backLabel="내 정보로" title="내 정보 수정" />
      <div className="flex flex-col gap-3 px-4 pt-1.5">
        <ProfileForm
          defaults={{
            name: account.name,
            email: account.email,
            phone: account.phone,
            trainer: account.trainerProfile,
          }}
        />
        {account.hasPassword ? <PasswordForm /> : null}
      </div>
    </main>
  );
}
