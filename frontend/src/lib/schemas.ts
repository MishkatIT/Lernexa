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

/**
 * Per-course lesson progression rule (D-038). Mirrors the backend enum. A course
 * form that omits the field (or sends anything unexpected) defaults to `free`,
 * matching the server.
 */
export const LESSON_PROGRESSION_MODES = [
  "free",
  "complete_locked",
  "open_locked",
] as const;
export type LessonProgressionMode = (typeof LESSON_PROGRESSION_MODES)[number];

export const courseSchema = z.object({
  title: z.string().trim().min(3, "At least 3 characters").max(160),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  coverImageUrl: z.url("Must be a URL").optional().or(z.literal("")),
  lessonProgression: z
    .enum(LESSON_PROGRESSION_MODES)
    .optional()
    .default("free"),
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

export const profileNameSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name").max(120),
  // Optional author bio shown on blog posts. "" clears it.
  bio: z.string().trim().max(280, "Keep it under 280 characters").optional(),
});
export type ProfileNameInput = z.infer<typeof profileNameSchema>;

/**
 * `avatarUrl` is either an http(s) link or a small client-resized image data
 * URL (see the avatar picker on /settings). Empty string clears the photo. The
 * ceiling mirrors the backend's — a 256px re-encode lands far below it.
 */
export const avatarSchema = z.object({
  avatarUrl: z
    .string()
    .trim()
    .max(200_000, "That image is too large — try a smaller one")
    .refine(
      (v) =>
        v === "" ||
        /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v) ||
        /^https?:\/\//.test(v),
      "Choose an image file",
    ),
});
export type AvatarInput = z.infer<typeof avatarSchema>;

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    password: z.string().min(6, "At least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((d) => d.password !== d.currentPassword, {
    message: "Choose a password different from the current one",
    path: ["password"],
  });
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
