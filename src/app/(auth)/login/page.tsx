import { Suspense } from "react";
import LoginPage from "@/features/auth/pages/LoginPage";

function Fallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <LoginPage />
    </Suspense>
  );
}
