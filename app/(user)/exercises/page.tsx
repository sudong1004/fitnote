import Link from "next/link";

import { Plus } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import {
  BODY_PART_LABEL,
  DIFFICULTY_LABEL,
  MOVEMENT_TYPE_LABEL,
} from "@/lib/exercise-labels";
import { getExercises } from "@/server/exercises/exercise.service";
import { getFavoriteExerciseIds } from "@/server/workouts/favorite.service";
import { cn } from "@/lib/utils";

import { ExerciseCard } from "./exercise-card";
import { ExerciseFilters } from "./exercise-filters";

export const metadata = {
  title: "운동 라이브러리 | FitNote",
};

/** URL 로 임의의 값이 들어와도 Prisma 까지 내려가지 않도록 걸러낸다. */
function pickEnum<T extends Record<string, string>>(
  labels: T,
  value: string | string[] | undefined,
): keyof T | undefined {
  if (typeof value === "string" && value in labels) {
    return value as keyof T;
  }
  return undefined;
}

function toPage(value: string | string[] | undefined) {
  const parsed = Number(typeof value === "string" ? value : "1");
  // 상한이 없으면 건너뛸 줄 수가 DB 정수 범위를 넘어 쿼리가 실패한다.
  return Number.isFinite(parsed) && parsed >= 1
    ? Math.min(Math.floor(parsed), 1000)
    : 1;
}

export default async function ExercisesPage({
  searchParams,
}: PageProps<"/exercises">) {
  const user = await requireUser();

  const params = await searchParams;

  const search = typeof params.search === "string" ? params.search : undefined;
  const bodyPart = pickEnum(BODY_PART_LABEL, params.bodyPart);
  const difficulty = pickEnum(DIFFICULTY_LABEL, params.difficulty);
  const movementType = pickEnum(MOVEMENT_TYPE_LABEL, params.movementType);
  const favoriteOnly = params.favorite === "1";
  const customOnly = !favoriteOnly && params.custom === "1";
  const page = toPage(params.page);

  const [{ data, pagination }, favoriteIds] = await Promise.all([getExercises({
    viewerId: user.id,
    customOnly,
    search,
    bodyPart,
    difficulty,
    movementType,
    favoriteOfUserId: favoriteOnly ? user.id : undefined,
    page,
    limit: 20,
  }), getFavoriteExerciseIds(user.id)]);
  const favorites = new Set(favoriteIds);

  function pageHref(target: number) {
    const next = new URLSearchParams();

    if (search) next.set("search", search);
    if (bodyPart) next.set("bodyPart", bodyPart);
    if (difficulty) next.set("difficulty", difficulty);
    if (movementType) next.set("movementType", movementType);
    if (favoriteOnly) next.set("favorite", "1");
    if (customOnly) next.set("custom", "1");
    if (target > 1) next.set("page", String(target));

    const query = next.toString();
    return query ? `/exercises?${query}` : "/exercises";
  }

  /** 탭을 오갈 때 검색·부위 조건은 그대로 두고 페이지만 1로 돌린다. */
  function scopeHref(target: "all" | "favorite" | "custom") {
    const next = new URLSearchParams();

    if (search) next.set("search", search);
    if (bodyPart) next.set("bodyPart", bodyPart);
    if (difficulty) next.set("difficulty", difficulty);
    if (movementType) next.set("movementType", movementType);
    if (target === "favorite") next.set("favorite", "1");
    if (target === "custom") next.set("custom", "1");

    const query = next.toString();
    return query ? `/exercises?${query}` : "/exercises";
  }

  return (
    <main className="flex flex-col pt-4">
      <header className="flex items-start justify-between gap-3 px-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">운동</h1>
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
            부위·기구별로 찾고, 하트로 모아 둬요
          </p>
        </div>
        <Link
          href="/exercises/new"
          className="mt-1 flex h-9.5 shrink-0 items-center gap-1 rounded-full border border-border px-3.5 text-[0.8125rem] font-bold"
        >
          <Plus className="size-3.5" aria-hidden />새 운동
        </Link>
      </header>

      {/* 밑줄 탭: 전체 / 즐겨찾기 / 내 운동 */}
      <nav aria-label="목록 범위" className="mt-2 flex gap-5 border-b border-line px-5">
        {(
          [
            { label: "전체", value: "all" },
            { label: "즐겨찾기", value: "favorite" },
            { label: "내 운동", value: "custom" },
          ] as const
        ).map((tab) => {
          const current = favoriteOnly ? "favorite" : customOnly ? "custom" : "all";
          const active = current === tab.value;
          return (
            <Link
              key={tab.label}
              href={scopeHref(tab.value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10.5 items-center px-0.5 text-sm",
                active
                  ? "font-extrabold text-ink shadow-[inset_0_-3px_0_var(--primary)]"
                  : "font-semibold text-faint",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3 px-4 pt-3.5">
        <ExerciseFilters total={pagination.total} />

        {data.length === 0 ? (
          <p className="rounded-[1.375rem] bg-[#f7f8f7] px-6 py-14 text-center text-sm text-muted-foreground">
            {favoriteOnly
              ? "즐겨찾기한 운동이 없어요. 운동 상세에서 하트를 눌러 두면 여기 모여요."
              : customOnly
                ? "직접 만든 운동이 없어요. 오른쪽 위 '새 운동'으로 라이브러리에 없는 운동을 적어 두세요."
                : "조건에 맞는 운동이 없어요."}
          </p>
        ) : (
          <ul className="flex flex-col">
            {data.map((exercise) => (
              <li key={exercise.id}>
                <ExerciseCard exercise={exercise} favorite={favorites.has(exercise.id)} />
              </li>
            ))}
          </ul>
        )}

        {pagination.totalPages > 1 && (
          <nav aria-label="페이지 이동" className="flex items-center justify-between pb-2">
            {pagination.hasPreviousPage ? (
              <Link
                href={pageHref(pagination.page - 1)}
                className="flex h-9.5 items-center rounded-full border border-border px-4 text-[0.8125rem] font-bold"
              >
                이전
              </Link>
            ) : (
              <span className="flex h-9.5 items-center rounded-full border border-border px-4 text-[0.8125rem] font-bold text-[#c4cbc7]">
                이전
              </span>
            )}

            <span className="text-[0.8125rem] text-muted-foreground tabular-nums">
              {pagination.page} / {pagination.totalPages}
            </span>

            {pagination.hasNextPage ? (
              <Link
                href={pageHref(pagination.page + 1)}
                className="flex h-9.5 items-center rounded-full border border-border px-4 text-[0.8125rem] font-bold"
              >
                다음
              </Link>
            ) : (
              <span className="flex h-9.5 items-center rounded-full border border-border px-4 text-[0.8125rem] font-bold text-[#c4cbc7]">
                다음
              </span>
            )}
          </nav>
        )}
      </div>
    </main>
  );
}
