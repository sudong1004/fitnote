"use client";

import { type FormEvent, useTransition } from "react";

/**
 * form 의 action 에 함수를 직접 주면 React 가 제출이 끝날 때 입력칸을 모두 비운다.
 * 실패해도 비워지므로 글을 다시 써야 하고, 체크박스는 화면(state)은 체크로 보이는데 실제 값은
 * 풀려서 "동의했는데 동의 안 했다"는 오류가 반복된다.
 *
 * 제출을 직접 받아 같은 액션을 부르면 입력이 그대로 남는다. 어느 버튼으로 냈는지는 submitter 로 담는다.
 * 성공하면 어차피 다른 화면으로 가거나 상태가 바뀌므로 비울 필요가 없다.
 */
export function useSubmitKeep(formAction: (formData: FormData) => void) {
  const [, startTransition] = useTransition();

  return function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(
      event.currentTarget,
      (event.nativeEvent as SubmitEvent).submitter,
    );
    startTransition(() => formAction(data));
  };
}
