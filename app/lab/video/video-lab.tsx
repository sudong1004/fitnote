"use client";

import { useRef, useState } from "react";

/** 시험용으로만 CDN 에서 불러온다. 방식이 정해지면 패키지로 넣는다. */
const MUXER_URL = "https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.mjs";

const LONG_SIDE = 1280; // 720p: 짧은 쪽 720, 긴 쪽 1280
const BITRATE = 1_500_000;
const FPS = 30;

type Result = {
  inSize: number;
  outSize: number;
  seconds: number;
  took: number;
  width: number;
  height: number;
  url: string;
};

function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function even(n: number) {
  return Math.max(2, Math.round(n / 2) * 2);
}

export function VideoLab() {
  const input = useRef<HTMLInputElement>(null);
  const [rate, setRate] = useState(1);
  const [status, setStatus] = useState("영상을 골라 주세요.");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run(file: File) {
    setResult(null);
    setBusy(true);
    setProgress(0);

    try {
      if (typeof VideoEncoder === "undefined") {
        setStatus("이 브라우저는 WebCodecs(VideoEncoder)를 지원하지 않아요.");
        return;
      }

      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.src = URL.createObjectURL(file);

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("영상을 읽지 못했어요."));
      });

      const seconds = video.duration;
      const scale = Math.min(1, LONG_SIDE / Math.max(video.videoWidth, video.videoHeight));
      const width = even(video.videoWidth * scale);
      const height = even(video.videoHeight * scale);

      const config: VideoEncoderConfig = {
        codec: "avc1.42001f",
        width,
        height,
        bitrate: BITRATE,
        framerate: FPS,
      };
      const support = await VideoEncoder.isConfigSupported(config);
      if (!support.supported) {
        setStatus("이 브라우저는 H.264 인코딩을 지원하지 않아요.");
        return;
      }

      const { Muxer, ArrayBufferTarget } = await import(/* webpackIgnore: true */ MUXER_URL);
      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: "avc", width, height },
        fastStart: "in-memory",
      });

      let encodeError: Error | null = null;
      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => {
          encodeError = e;
        },
      });
      encoder.configure(config);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("캔버스를 만들지 못했어요.");

      setStatus(`변환 중… (${seconds.toFixed(0)}초 영상, ${width}×${height})`);
      const started = performance.now();
      const frameStep = 1 / FPS;
      let lastTs = -1;
      let frames = 0;

      video.playbackRate = rate;
      await new Promise<void>((resolve, reject) => {
        const onFrame = (_now: number, meta: VideoFrameCallbackMetadata) => {
          if (encodeError) return reject(encodeError);
          const t = meta.mediaTime;
          if (t - lastTs >= frameStep * 0.9) {
            ctx.drawImage(video, 0, 0, width, height);
            const frame = new VideoFrame(canvas, { timestamp: Math.round(t * 1_000_000) });
            // 인코더가 밀리면 잠깐 쉰다. 쌓아 두면 메모리가 터진다.
            if (encoder.encodeQueueSize > 8) {
              video.pause();
              const resume = () => {
                if (encoder.encodeQueueSize <= 2) void video.play();
                else setTimeout(resume, 20);
              };
              setTimeout(resume, 20);
            }
            encoder.encode(frame, { keyFrame: frames % (FPS * 2) === 0 });
            frame.close();
            lastTs = t;
            frames += 1;
            setProgress(Math.min(100, Math.round((t / seconds) * 100)));
          }
          video.requestVideoFrameCallback(onFrame);
        };
        video.requestVideoFrameCallback(onFrame);
        video.onended = () => resolve();
        video.onerror = () => reject(new Error("재생 중 오류가 났어요."));
        video.play().catch(reject);
      });

      await encoder.flush();
      encoder.close();
      muxer.finalize();

      const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
      setResult({
        inSize: file.size,
        outSize: blob.size,
        seconds,
        took: (performance.now() - started) / 1000,
        width,
        height,
        url: URL.createObjectURL(blob),
      });
      setStatus("끝났어요.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "알 수 없는 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <label className="flex items-center gap-2">
        재생 속도
        <select
          value={rate}
          disabled={busy}
          onChange={(e) => setRate(Number(e.target.value))}
          className="rounded border px-2 py-1"
        >
          <option value={1}>1배 (안전)</option>
          <option value={2}>2배</option>
          <option value={4}>4배</option>
        </select>
      </label>

      <input
        ref={input}
        type="file"
        accept="video/*"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void run(file);
        }}
      />

      <p>{status}</p>
      {busy ? (
        <div className="h-2 overflow-hidden rounded bg-line">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      {result ? (
        <div className="flex flex-col gap-2">
          <ul className="rounded-xl bg-surface p-3 leading-relaxed">
            <li>영상 길이: {result.seconds.toFixed(1)}초</li>
            <li>걸린 시간: {result.took.toFixed(1)}초</li>
            <li>
              용량: {mb(result.inSize)} → {mb(result.outSize)}
            </li>
            <li>
              크기: {result.width}×{result.height}
            </li>
          </ul>
          <video src={result.url} controls playsInline className="w-full rounded-xl" />
        </div>
      ) : null}
    </div>
  );
}
