import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
        Create an account
      </h1>
      <p className="mt-1 text-[15px] text-ink-500">
        New accounts start as students.
      </p>
      <RegisterForm />
    </div>
  );
}
