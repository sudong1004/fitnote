import { VideoLab } from "./video-lab";

/**
 * 영상 변환 시험 화면 (임시).
 *
 * 폰에서 영상을 줄이는 데 시간이 얼마나 걸리고 용량이 얼마나 나오는지 재 보려고 만들었다.
 * 결과를 보고 방식이 정해지면 지우거나 실제 업로드 화면으로 바꾼다. main 에는 넣지 않는다.
 * 로그인한 사람만 열 수 있다. (proxy.ts 가 공개 주소가 아니면 로그인으로 보낸다.)
 */
export default function VideoLabPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
      <h1 className="text-lg font-extrabold">영상 변환 시험</h1>
      <VideoLab />
    </main>
  );
}
