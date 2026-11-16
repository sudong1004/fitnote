import { requireUser } from "@/app/lib/dal";
import { PageHeader } from "@/components/layout/page-header";

import { ExerciseForm } from "../exercise-form";

export const metadata = { title: "운동 만들기 | FitNote" };

export default async function NewExercisePage() {
  await requireUser();

  return (
    <main className="mx-auto w-full max-w-md pb-6">
      <PageHeader
        backHref="/exercises"
        backLabel="운동 목록"
        title="운동 만들기"
        subtitle="라이브러리에 없는 운동을 적어 두세요. 나만 볼 수 있어요"
      />
      <div className="flex flex-col gap-3 px-4 pt-1.5">
        <ExerciseForm defaults={{ name: "", bodyPart: null, targetMuscle: null, description: null }} />
      </div>
    </main>
  );
}
