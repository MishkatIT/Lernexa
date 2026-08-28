import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <Container size="content" className="py-16 sm:py-24">
      <div className="mx-auto max-w-sm">
        <h1 className="text-h1 text-ink-900">Log in</h1>
        <p className="mt-1.5 text-body text-ink-500">
          Welcome back to Lernexa.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-small text-ink-500">
          New here?{" "}
          <Link href="/register" className="text-accent-600 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </Container>
  );
}
