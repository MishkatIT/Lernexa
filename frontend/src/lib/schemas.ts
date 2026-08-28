import { z } from "zod";

/**
 * Shared by the client form (UX validation) and the route handler (re-validated
 * server-side — client validation is never trusted). Close to the backend's yup
 * allowlist by intent, not by sharing (different runtimes — D-030).
 */

export const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const courseSchema = z.object({
  title: z.string().trim().min(3, "At least 3 characters").max(160),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  coverImageUrl: z.url("Must be a URL").optional().or(z.literal("")),
});
export type CourseInput = z.infer<typeof courseSchema>;

export const lessonSchema = z.object({
  title: z.string().trim().min(2, "At least 2 characters").max(160),
  content: z.string().trim().max(20000).optional().or(z.literal("")),
  videoUrl: z.url("Must be a URL").optional().or(z.literal("")),
  order: z.coerce.number().int().min(1, "Order starts at 1"),
});
export type LessonInput = z.infer<typeof lessonSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter your name").max(120),
    email: z.email("Enter a valid email"),
    password: z.string().min(6, "At least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type RegisterInput = z.infer<typeof registerSchema>;
