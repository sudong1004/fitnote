import { notFound } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import { PageHeader } from "@/components/layout/page-header";
import { getExerciseById } from "@/server/exercises/exercise.service";

import { ExerciseForm } from "../../exercise-form";

export const metadata = { title: "운동 수정 | FitNote" };

export default async function EditExercisePage({ params }: PageProps<"/exercises/[id]/edit">) {
  const user = await requireUser();
  const { id } = await params;
  const exercise = await getExerciseById(id, user.id);

  // 내가 만든 운동만 고친다. 남의 운동과 라이브러리 운동은 없는 것과 같다.
  if (!exercise || !exercise.isCustom || !exercise.isActive || exercise.createdByUserId !== user.id) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-md pb-6">
      <PageHeader backHref={`/exercises/${exercise.id}`} backLabel="운동 상세" title="운동 수정" />
      <div className="flex flex-col gap-3 px-4 pt-1.5">
        <ExerciseForm
          defaults={{
            id: exercise.id,
            name: exercise.name,
            bodyPart: exercise.bodyPart,
            targetMuscle: exercise.targetMuscle,
            description: exercise.description,
          }}
        />
      </div>
    </main>
  );
}
