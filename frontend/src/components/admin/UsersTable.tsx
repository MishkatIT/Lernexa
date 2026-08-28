"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setUserRole, setUserBlock } from "@/actions/admin";
import { Button } from "@/components/ui/Button";
import type { PlatformUser } from "@/lib/admin";

const ROLES = ["admin", "content-manager", "instructor", "student"] as const;
const LABEL: Record<string, string> = {
  admin: "Admin",
  "content-manager": "Content Manager",
  instructor: "Instructor",
  student: "Student",
};

export function UsersTable({
  users,
  currentUserId,
}: {
  users: PlatformUser[];
  currentUserId: number;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockModal, setBlockModal] = useState<PlatformUser | null>(null);

  async function changeRole(u: PlatformUser, role: string) {
    if (role === u.role?.type) return;
    setBusyId(u.id);
    setError(null);
    const res = await setUserRole(u.id, role);
    setBusyId(null);
    if (!res.ok) setError(res.error);
    router.refresh();
  }

  async function toggleBlock(u: PlatformUser, reason?: string) {
    setBusyId(u.id);
    setError(null);
    const res = await setUserBlock(u.id, !u.blocked, reason);
    setBusyId(null);
    setBlockModal(null);
    if (!res.ok) setError(res.error);
    router.refresh();
  }

  return (
    <div>
      {error ? (
        <p className="mb-3 border-l-[3px] border-danger bg-accent-100/40 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="text-left text-[12px] uppercase tracking-wide text-ink-500">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Role</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-t border-ink-200">
                  <td className="py-2.5 pr-4 text-ink-900">
                    {u.fullName ?? "—"}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-[13px] text-ink-500">
                    {u.email}
                  </td>
                  <td className="py-2.5 pr-4">
                    <select
                      value={u.role?.type ?? ""}
                      disabled={isSelf || busyId === u.id}
                      onChange={(e) => changeRole(u, e.target.value)}
                      className="h-8 rounded-sm border border-ink-200 bg-paper-raised px-2 text-[13px] disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`rounded-sm border px-2 py-0.5 text-[12px] ${
                        u.blocked
                          ? "border-danger text-danger"
                          : "border-ink-200 text-ink-500"
                      }`}
                    >
                      {u.blocked ? "Blocked" : "Active"}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <Button
                      variant="ghost"
                      disabled={isSelf || busyId === u.id}
                      onClick={() =>
                        u.blocked ? toggleBlock(u) : setBlockModal(u)
                      }
                    >
                      {u.blocked ? "Unblock" : "Block"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {blockModal ? (
        <BlockModal
          user={blockModal}
          busy={busyId === blockModal.id}
          onCancel={() => setBlockModal(null)}
          onConfirm={(reason) => toggleBlock(blockModal, reason)}
        />
      ) : null}
    </div>
  );
}

function BlockModal({
  user,
  busy,
  onCancel,
  onConfirm,
}: {
  user: PlatformUser;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const name = user.fullName ?? user.email;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Block ${name}`}
        className="w-full max-w-md rounded-sm border border-ink-200 bg-paper-raised p-6 shadow-lg"
      >
        <h2 className="text-[17px] font-semibold text-ink-900">Block {name}</h2>
        <p className="mt-1 text-[13px] text-ink-500">
          They&apos;ll be signed out on their next request and shown this reason.
        </p>
        <label className="mt-4 block text-[13px] font-medium text-ink-700">
          Reason (required)
        </label>
        <textarea
          ref={textareaRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 min-h-20 w-full rounded-sm border border-ink-200 bg-paper-raised px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-accent-500"
        />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={busy || reason.trim().length === 0}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? "Blocking…" : `Block ${name}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
