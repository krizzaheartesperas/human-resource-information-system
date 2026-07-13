import { Suspense } from "react";
import AuthConsumeClient from "./AuthConsumeClient";

function Fallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef3ff] dark:bg-[#0b1220]">
      <div className="size-10 animate-spin rounded-full border-2 border-[#0E1F63] border-t-transparent dark:border-slate-200" />
    </div>
  );
}

export default function AuthConsumePage() {
  return (
    <Suspense fallback={<Fallback />}>
      <AuthConsumeClient />
    </Suspense>
  );
}
