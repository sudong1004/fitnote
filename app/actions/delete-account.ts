"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import type { AccountFormState } from "@/app/lib/definitions";
import { deleteSession } from "@/app/lib/session";
import { deleteMyAccount } from "@/server/account/delete-account.service";

export async function deleteAccount(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await requireUser();

  if (formData.get("confirm") !== "on") {
    return { errors: { confirm: ["안내를 읽고 확인란을 눌러 주세요."] } };
  }

  const result = await deleteMyAccount(user.id, String(formData.get("password") ?? ""));
  if (!result.ok) {
    if (result.reason === "wrong-password") {
      return { errors: { password: ["비밀번호가 맞지 않아요."] } };
    }
    return {
      message: `진행 중인 PT 계약이 ${result.count}건 있어요. 남은 회차를 마무리하거나 계약을 끝낸 뒤 탈퇴할 수 있어요.`,
    };
  }

  await deleteSession();
  redirect("/login?deleted=1");
}
