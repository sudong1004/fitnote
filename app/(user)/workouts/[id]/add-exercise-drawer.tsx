"use client";

import {
  Bookmark,
  Check,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { WorkoutBodyPart } from "@/generated/prisma/enums";
import {
  BODY_PART_LABEL,
  BODY_PART_OPTIONS,
  DIFFICULTY_LABEL,
} from "@/lib/exercise-labels";
import { cn } from "@/lib/utils";

import { createExerciseInline } from "../../exercises/actions";
import {
  addExercisesToSession,
  toggleExerciseFavorite,
} from "../actions";

type ExerciseItem = {
  id: string;
  name: string;
  bodyPart: WorkoutBodyPart;
  difficulty: keyof typeof DIFFICULTY_LABEL;
  /** 직접 만든 운동. 난이도는 자리표시 값이라 "내 운동" 으로 대신 보여 준다. */
  isCustom?: boolean;
};

/** "전체" 와 즐겨찾기는 부위 enum 이 아니므로 따로 표현한다. */
type Tab =
  | { kind: "all" }
  | { kind: "favorite" }
  | { kind: "part"; value: WorkoutBodyPart };

export function AddExerciseDrawer({
  sessionId,
  bodyPartCounts,
  favoriteIds,
  addedExerciseIds,
}: {
  sessionId: string;
  bodyPartCounts: Partial<Record<WorkoutBodyPart, number>>;
  favoriteIds: string[];

  /**
   * 이 운동에 이미 담긴 운동들.
   *
   * 고르지 못하게 막지는 않는다. 서킷으로 같은 운동을 두 번 돌리거나,
   * 몰아서 입력할 때 오전 · 오후를 나눠 적는 사람이 있다.
   */
  addedExerciseIds: string[];
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>({ kind: "all" });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>(favoriteIds);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  // 찾는 운동이 없을 때 이 자리에서 바로 만든다.
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPart, setNewPart] = useState<WorkoutBodyPart | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const keyword = search.trim();

  // 검색 중에는 부위 탭을 무시하고 전체에서 찾는다.
  const bodyPart =
    keyword || tab.kind !== "part"
      ? null
      : tab.value;

  const queryKey = keyword
    ? `search:${keyword}:${refresh}`
    : `part:${bodyPart ?? "all"}:${refresh}`;

  // 받아온 조건을 함께 들고 있다가 조건이 맞을 때만 보여준다.
  const [result, setResult] = useState<{
    key: string;
    items: ExerciseItem[];
  }>({
    key: "",
    items: [],
  });

  const fetched =
    result.key === queryKey
      ? result.items
      : [];

  // 즐겨찾기 탭은 서버를 다시 부르지 않고 받아온 목록에서 걸러낸다.
  const items =
    !keyword && tab.kind === "favorite"
      ? fetched.filter((exercise) =>
          favorites.includes(exercise.id),
        )
      : fetched;

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          limit: "100",
        });

        if (keyword) {
          params.set("search", keyword);
        } else if (bodyPart) {
          params.set("bodyPart", bodyPart);
        }

        const res = await fetch(
          `/api/exercises?${params}`,
          {
            signal: controller.signal,
          },
        );

        const body = await res.json();

        if (!controller.signal.aborted) {
          setResult({
            key: queryKey,
            items: res.ok
              ? (body.data ?? [])
              : [],
          });
        }
      } catch {
        // abort는 정상 흐름이라 무시한다.
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [
    open,
    keyword,
    bodyPart,
    queryKey,
  ]);

  function reset() {
    setSearch("");
    setTab({ kind: "all" });
    setSelected([]);
    setError(null);
    setCreating(false);
    setNewName("");
    setNewPart(null);
    setCreateError(null);
  }

  function openCreate() {
    setError(null);
    setCreateError(null);
    // 검색하던 말이 있으면 그대로 이름 칸에 넣어 준다.
    setNewName(keyword);
    setNewPart(null);
    setCreating(true);
  }

  function createExercise() {
    setCreateError(null);

    if (newPart === null) {
      setCreateError("부위를 골라주세요.");
      return;
    }

    startTransition(async () => {
      const res = await createExerciseInline({ name: newName, bodyPart: newPart });

      if (res.error !== null) {
        setCreateError(res.error);
        return;
      }

      // 만든 운동은 바로 선택해 두고, 이름으로 검색한 결과에서 보이게 한다.
      setSelected((prev) => [...prev, res.exercise.id]);
      setTab({ kind: "all" });
      setSearch(res.exercise.name);
      setRefresh((value) => value + 1);
      setCreating(false);
    });
  }

  function toggle(exerciseId: string) {
    setError(null);

    setSelected((prev) =>
      prev.includes(exerciseId)
        ? prev.filter(
            (id) => id !== exerciseId,
          )
        : [...prev, exerciseId],
    );
  }

  function toggleBookmark(exerciseId: string) {
    const wasFavorite =
      favorites.includes(exerciseId);

    // 먼저 UI 반영
    setFavorites((prev) =>
      wasFavorite
        ? prev.filter(
            (id) => id !== exerciseId,
          )
        : [...prev, exerciseId],
    );

    startTransition(async () => {
      const res =
        await toggleExerciseFavorite(
          exerciseId,
        );

      if (res.error) {
        // 실패 시 되돌림
        setFavorites((prev) =>
          wasFavorite
            ? [...prev, exerciseId]
            : prev.filter(
                (id) => id !== exerciseId,
              ),
        );
      }
    });
  }

  function submit() {
    setError(null);

    if (selected.length === 0) {
      setError("운동을 선택해주세요.");
      return;
    }

    startTransition(async () => {
      const res =
        await addExercisesToSession(
          sessionId,
          selected,
        );

      if (res.error) {
        setError(res.error);
        return;
      }

      setOpen(false);
      reset();

      /*
       * 중요:
       *
       * 이 컴포넌트는 /workouts/[id] 화면에서도 쓰이고
       * /trainer/sessions/[id] 화면에서도 쓰인다.
       *
       * 서버에서 운동은 정상 저장됐더라도 현재 트레이너
       * 수업 화면은 서버 컴포넌트이므로 자동으로 최신
       * workout.records를 들고 있지 않을 수 있다.
       *
       * 현재 페이지를 다시 서버 렌더링한다.
       */
      router.refresh();
    });
  }

  const tabs: {
    key: string;
    label: string;
    tab: Tab;
  }[] = [
    {
      key: "all",
      label: "전체",
      tab: { kind: "all" },
    },

    ...BODY_PART_OPTIONS.filter(
      ([value]) =>
        (bodyPartCounts[value] ?? 0) > 0,
    ).map(([value, label]) => ({
      key: value,
      label,
      tab: {
        kind: "part",
        value,
      } as Tab,
    })),
  ];

  const activeKey =
    tab.kind === "part"
      ? tab.value
      : tab.kind === "favorite"
        ? "favorite"
        : "all";

  const duplicateCount =
    selected.filter((id) =>
      addedExerciseIds.includes(id),
    ).length;

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        className="h-12 w-full rounded-full border border-border bg-card text-sm font-bold hover:bg-surface"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        운동 추가
      </Button>

      <Drawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);

          if (!next) {
            reset();
          }
        }}
      >
        <DrawerContent className="mx-auto flex h-[85dvh] max-w-md flex-col">
          <DrawerHeader className="pb-3 text-center">
            <DrawerTitle>
              운동 선택하기
            </DrawerTitle>
          </DrawerHeader>

          {/* 만드는 동안에는 검색과 부위 탭을 숨긴다. 같은 부위 이름이 두 군데 보이면 헷갈린다. */}
          <div className={cn("px-4", creating && "hidden")}>
            <div className="relative">
              <Search
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="찾으시는 운동을 검색해보세요"
                aria-label="운동 검색"
                className="h-11 w-full rounded-full bg-surface pr-10 pl-9 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />

              {keyword ? (
                <button
                  type="button"
                  aria-label="검색어 지우기"
                  onClick={() =>
                    setSearch("")
                  }
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          </div>

          <div
            className={cn(
              "mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              creating && "hidden",
            )}
          >
            <button
              type="button"
              aria-label="즐겨찾기만 보기"
              aria-pressed={
                tab.kind === "favorite"
              }
              onClick={() =>
                setTab(
                  tab.kind ===
                    "favorite"
                    ? { kind: "all" }
                    : { kind: "favorite" },
                )
              }
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",

                tab.kind ===
                  "favorite"
                  ? "border-ink bg-ink text-white"
                  : "border-border text-muted-foreground",
              )}
            >
              <Bookmark className="size-4" />
            </button>

            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={
                  activeKey === item.key
                }
                onClick={() =>
                  setTab(item.tab)
                }
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.75 text-[0.8125rem] font-bold transition-colors",

                  activeKey === item.key
                    ? "border-ink bg-ink text-white"
                    : "border-border text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {error ? (
            <p
              role="alert"
              className="px-4 pt-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2">
            {creating ? (
              <div className="flex flex-col gap-4 py-3">
                <div>
                  <p className="text-sm font-bold">운동 직접 만들기</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    나만 볼 수 있어요. 만들면 바로 선택돼요.
                  </p>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="px-1 text-[0.8125rem] font-bold">운동 이름</span>
                  <input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    maxLength={40}
                    placeholder="예: 케이블 힙 어브덕션"
                    className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-[0.9375rem] outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                  />
                </label>

                <div className="flex flex-col gap-1.5">
                  <span className="px-1 text-[0.8125rem] font-bold">부위</span>
                  <div className="flex flex-wrap gap-2">
                    {BODY_PART_OPTIONS.map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={newPart === value}
                        onClick={() => setNewPart(value)}
                        className={cn(
                          "h-9 rounded-full border px-3.5 text-[0.8125rem] font-bold transition-colors",
                          newPart === value
                            ? "border-ink bg-ink text-white"
                            : "border-border text-foreground",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {createError ? (
                  <p role="alert" className="px-1 text-sm text-destructive">
                    {createError}
                  </p>
                ) : null}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-12 flex-1 rounded-full font-bold"
                    onClick={() => setCreating(false)}
                  >
                    취소
                  </Button>
                  <Button
                    className="h-12 flex-1 rounded-full font-bold"
                    disabled={pending || newName.trim() === ""}
                    onClick={createExercise}
                  >
                    {pending ? <Loader2 className="size-4 animate-spin" /> : "만들기"}
                  </Button>
                </div>
              </div>
            ) : loading &&
            fetched.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                불러오는 중…
              </p>
            ) : items.length === 0 ? (
              <EmptyResult
                keyword={keyword}
                favoriteTab={
                  !keyword &&
                  tab.kind ===
                    "favorite"
                }
                onReset={() => {
                  setSearch("");
                  setTab({ kind: "all" });
                }}
                onCreate={openCreate}
              />
            ) : (
              <ul className="divide-y divide-border">
                {items.map((exercise) => {
                  const checked =
                    selected.includes(
                      exercise.id,
                    );

                  const favorite =
                    favorites.includes(
                      exercise.id,
                    );

                  const added =
                    addedExerciseIds.includes(
                      exercise.id,
                    );

                  return (
                    <li
                      key={exercise.id}
                      className="flex items-center gap-3 py-1"
                    >
                      <button
                        type="button"
                        aria-pressed={checked}
                        onClick={() =>
                          toggle(
                            exercise.id,
                          )
                        }
                        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-5.5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",

                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input",
                          )}
                        >
                          {checked ? (
                            <Check className="size-3.5" />
                          ) : null}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold">
                              {exercise.name}
                            </span>

                            {added ? (
                              <span className="shrink-0 rounded-full border border-brand px-1.5 text-[0.6875rem] leading-4 font-bold text-primary">
                                담김
                              </span>
                            ) : null}
                          </span>

                          <span className="block text-xs text-muted-foreground">
                            {
                              BODY_PART_LABEL[
                                exercise.bodyPart
                              ]
                            }{" "}
                            ·{" "}
                            {exercise.isCustom
                              ? "내 운동"
                              : DIFFICULTY_LABEL[
                                  exercise
                                    .difficulty
                                ]}
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        aria-label={
                          favorite
                            ? "즐겨찾기 해제"
                            : "즐겨찾기에 추가"
                        }
                        aria-pressed={favorite}
                        onClick={() =>
                          toggleBookmark(
                            exercise.id,
                          )
                        }
                        className="shrink-0 rounded-full p-2 hover:bg-surface"
                      >
                        <Bookmark
                          className={cn(
                            "size-4",

                            favorite
                              ? "fill-primary text-primary"
                              : "text-muted-foreground",
                          )}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {creating || (items.length === 0 && !loading) ? null : (
              <button
                type="button"
                onClick={openCreate}
                className="my-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-border text-[0.8125rem] font-bold text-muted-foreground"
              >
                <Plus className="size-3.5" />
                찾는 운동이 없나요? 직접 만들기
              </button>
            )}
          </div>

          <div className="border-t border-border px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {duplicateCount > 0 ? (
              <p className="mb-2 text-center text-xs font-semibold text-primary">
                이미 담긴 운동{" "}
                {duplicateCount}
                개가 있어요. 그대로 담으면
                따로 기록됩니다.
              </p>
            ) : null}

            <Button
              size="lg"
              disabled={
                selected.length === 0 ||
                pending
              }
              onClick={submit}
              className="h-12 w-full rounded-full font-bold"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : selected.length ===
                0 ? (
                "운동을 선택해주세요"
              ) : (
                `${selected.length}개 추가`
              )}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function EmptyResult({
  keyword,
  favoriteTab,
  onReset,
  onCreate,
}: {
  keyword: string;
  favoriteTab: boolean;
  onReset: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-muted">
        {favoriteTab ? (
          <Bookmark className="size-5 text-muted-foreground" />
        ) : (
          <Search className="size-5 text-muted-foreground" />
        )}
      </span>

      {favoriteTab ? (
        <>
          <p className="text-sm font-semibold">
            즐겨찾기가 비어 있어요
          </p>

          <p className="text-xs text-muted-foreground">
            자주 하는 운동의 북마크를
            눌러 두면 여기 모입니다.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold">
            {keyword
              ? `'${keyword}' 검색 결과가 없어요`
              : "표시할 운동이 없어요"}
          </p>

          <p className="text-xs text-muted-foreground">
            운동 이름이 떠오르지 않으면
            부위로 찾아보세요.
          </p>
        </>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg"
          onClick={onReset}
        >
          전체 보기
        </Button>

        {favoriteTab ? null : (
          <Button size="sm" className="rounded-lg" onClick={onCreate}>
            <Plus className="size-3.5" />
            직접 만들기
          </Button>
        )}
      </div>
    </div>
  );
}