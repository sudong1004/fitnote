import Link from "next/link";

import { SearchX } from "lucide-react";

import {
  StatusScreen,
  statusPrimaryAction,
} from "@/components/layout/status-screen";

/** 없는 주소이거나, 지워졌거나 볼 수 없는 기록을 열었을 때 보여 준다. */
export function NotFoundScreen({ full = false }: { full?: boolean }) {
  return (
    <StatusScreen
      full={full}
      icon={<SearchX aria-hidden />}
      title="찾는 화면이 없어요"
      description="주소가 바뀌었거나 지워진 기록일 수 있어요."
    >
      {/* 루트가 로그인 여부와 역할을 보고 알맞은 첫 화면으로 보낸다. */}
      <Link href="/" className={statusPrimaryAction}>
        홈으로
      </Link>
    </StatusScreen>
  );
}
