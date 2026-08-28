import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <Container size="content" className="py-16 sm:py-24">
      <div className="mx-auto max-w-sm">
        <h1 className="text-h1 text-ink-900">Create an account</h1>
        <p className="mt-1.5 text-body text-ink-500">
          New accounts start as students.
        </p>
        <RegisterForm />
        <p className="mt-6 text-small text-ink-500">
          Already have an account?{" "}
          <Link href="/login" className="text-accent-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </Container>
  );
}
