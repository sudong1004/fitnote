"use client";

import { ErrorScreen } from "@/components/layout/error-screen";

export default function Error(props: { error: unknown; retry: () => void }) {
  return <ErrorScreen {...props} full />;
}
