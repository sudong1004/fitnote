import { Skeleton } from "@/components/ui/skeleton";

/**
 * 화면을 옮길 때 서버 응답을 기다리는 동안 보여 줄 뼈대.
 *
 * 탭을 누르면 바로 이 화면으로 바뀌어서, 앱이 멈춘 것처럼 보이지 않는다.
 * 실제 화면 구성(제목 → 큰 카드 → 목록)을 대략 따라간다.
 */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="불러오는 중" className="flex flex-col gap-3.5 px-4 pt-5">
      <div className="flex flex-col gap-2 px-1">
        <Skeleton className="h-7 w-28 rounded-lg bg-line" />
        <Skeleton className="h-4 w-44 rounded-md bg-line" />
      </div>
      <Skeleton className="h-36 w-full rounded-[1.375rem] bg-line" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-18 rounded-2xl bg-line" />
        <Skeleton className="h-18 rounded-2xl bg-line" />
        <Skeleton className="h-18 rounded-2xl bg-line" />
      </div>
      <div className="flex flex-col gap-2.5 pt-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-1">
            <Skeleton className="size-10 shrink-0 rounded-xl bg-line" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-3/5 rounded-md bg-line" />
              <Skeleton className="h-3 w-2/5 rounded-md bg-line" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">불러오는 중</span>
    </div>
  );
}
