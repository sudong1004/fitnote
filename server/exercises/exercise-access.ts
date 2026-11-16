import type { Prisma } from "@/generated/prisma/client";

/**
 * 누가 어떤 운동을 쓸 수 있는가.
 *
 * 운동은 두 종류다. 시스템 운동(만든 사람이 없음)은 모두가 쓰고, 사용자가 직접 만든 운동
 * (`createdByUserId` 가 있음)은 만든 사람만 쓴다. 트레이너가 만든 운동도 담당 회원이 목록에서
 * 고를 수는 없다. 회원에게 보이는 것은 그 운동이 들어간 기록(PT 수업 등)뿐이다.
 *
 * 운동을 읽거나 기록에 넣는 곳은 모두 이 조건을 거친다. 새로 만들 때 빠뜨리면 남의 운동이
 * 목록에 섞이거나, 남의 운동 id 로 기록을 만들 수 있게 된다.
 */

/** 목록, 검색, 기록에 추가, 즐겨찾기에서 고를 수 있는 운동. */
export function usableBy(userId: string): Prisma.ExerciseWhereInput {
  return {
    isActive: true,
    OR: [{ createdByUserId: null }, { createdByUserId: userId }],
  };
}

/**
 * 상세 화면에서 열 수 있는 운동.
 *
 * 쓸 수 있는 운동에 더해, 내 기록에 들어 있는 운동도 연다. 트레이너가 PT 수업에 넣은 운동이나,
 * 만든 사람이 지운 뒤에도 기록에 남아 있는 운동을 기록 화면에서 눌렀을 때 404 가 되지 않게 한다.
 */
export function viewableBy(userId: string): Prisma.ExerciseWhereInput {
  return {
    OR: [
      usableBy(userId),
      { workoutRecords: { some: { session: { userId } } } },
    ],
  };
}
