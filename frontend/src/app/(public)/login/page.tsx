import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Log in</h1>
      <p className="mt-1 text-[15px] text-ink-500">Welcome back to Lernexa.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
