"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function RegisterForm() {
  const router = useRouter();

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const fd = new FormData(e.currentTarget);
    const parsed = registerSchema.safeParse({
      fullName: String(fd.get("fullName") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      confirmPassword: String(fd.get("confirmPassword") ?? ""),
    });

    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
        ),
      );
      return;
    }
    setFieldErrors({});
    setPending(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const body = await res.json();

    if (!body.ok) {
      setPending(false);
      setFormError(body.error ?? "Could not create your account");
      return;
    }

    router.push(body.redirectTo || "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
      {formError ? (
        <p className="border-l-[3px] border-danger bg-accent-100/40 px-3 py-2 text-[13px] text-danger">
          {formError}
        </p>
      ) : null}

      <Input label="Full name" name="fullName" autoComplete="name" error={fieldErrors.fullName} />
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        error={fieldErrors.email}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        error={fieldErrors.password}
      />
      <Input
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={fieldErrors.confirmPassword}
      />

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create account"}
      </Button>

      <p className="text-[13px] text-ink-500">
        Already have an account?{" "}
        <Link href="/login" className="text-accent-600 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
