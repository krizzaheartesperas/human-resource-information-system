import { Suspense } from "react";
import AuthCallbackContent from "./CallbackClient";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthCallbackContent />
    </Suspense>
  );
}
