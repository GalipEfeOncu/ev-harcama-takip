import { Suspense } from "react";
import StartClient from "./start-client";

export default function StartPage() {
  return (
    <Suspense fallback={<main className="onboarding-shell" />}>
      <StartClient />
    </Suspense>
  );
}
