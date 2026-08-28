import "server-only";

import { strapiFetch } from "./strapi";
import { getToken } from "./session";

export type PlatformStats = {
  users: {
    total: number;
    admins: number;
    contentManagers: number;
    instructors: number;
    students: number;
    blocked: number;
    activeLast7Days: number;
  };
  content: {
    courses: number;
    coursesWithoutLessons: number;
    enrollments: number;
    quizAttempts: number;
    overallCompletionPercent: number;
  };
  attention: {
    quizzesWithoutCorrectAnswer: number;
    coursesWithoutLessons: number;
    blockedUsers: number;
  };
};

export type PlatformUser = {
  id: number;
  fullName: string | null;
  username: string;
  email: string;
  blocked: boolean;
  blockedReason: string | null;
  blockedAt: string | null;
  role: { type: string; name: string } | null;
};

export async function getPlatformStats(): Promise<PlatformStats> {
  const token = await getToken();
  const res = await strapiFetch<{ data: PlatformStats }>("/api/platform/stats", {
    token,
  });
  return res.data;
}

export async function listPlatformUsers(params: {
  page?: number;
  q?: string;
  role?: string;
  status?: string;
}): Promise<{ users: PlatformUser[]; page: number; pageCount: number; total: number }> {
  const token = await getToken();
  const qs = new URLSearchParams({ pageSize: "20" });
  if (params.page) qs.set("page", String(params.page));
  if (params.q) qs.set("q", params.q);
  if (params.role) qs.set("role", params.role);
  if (params.status) qs.set("status", params.status);

  const res = await strapiFetch<{
    data: PlatformUser[];
    meta: { pagination: { page: number; pageCount: number; total: number } };
  }>(`/api/platform/users?${qs}`, { token });

  return {
    users: res.data,
    page: res.meta.pagination.page,
    pageCount: res.meta.pagination.pageCount,
    total: res.meta.pagination.total,
  };
}

export type SiteSettings = { siteName: string; registrationEnabled: boolean };

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const res = await strapiFetch<{ data: SiteSettings | null }>(
      "/api/site-setting",
      { cache: "no-store" },
    );
    return {
      siteName: res.data?.siteName ?? "Lernexa",
      registrationEnabled: res.data?.registrationEnabled ?? true,
    };
  } catch {
    return { siteName: "Lernexa", registrationEnabled: true };
  }
}
