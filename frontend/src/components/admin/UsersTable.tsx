"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setUserRole, setUserBlock } from "@/actions/admin";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Textarea } from "@/components/ui/Textarea";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
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
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockModal, setBlockModal] = useState<PlatformUser | null>(null);

  async function changeRole(u: PlatformUser, role: string) {
    if (role === u.role?.type) return;
    setBusyId(u.id);
    setError(null);
    const res = await setUserRole(u.id, role);
    setBusyId(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast(`${u.fullName ?? u.email} is now ${LABEL[role] ?? role}`);
    router.refresh();
  }

  async function toggleBlock(u: PlatformUser, reason?: string) {
    setBusyId(u.id);
    setError(null);
    const res = await setUserBlock(u.id, !u.blocked, reason);
    setBusyId(null);
    setBlockModal(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast(
      u.blocked
        ? `${u.fullName ?? u.email} unblocked`
        : `${u.fullName ?? u.email} blocked`,
    );
    router.refresh();
  }

  return (
    <div>
      {error ? <Alert className="mb-3">{error}</Alert> : null}

      <Table>
        <THead>
          <Th>Name</Th>
          <Th>Email</Th>
          <Th>Role</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <Tr key={u.id}>
                <Td>{u.fullName ?? "—"}</Td>
                <Td className="font-mono text-small text-ink-500">{u.email}</Td>
                <Td>
                  <select
                    aria-label={`Role for ${u.fullName ?? u.email}`}
                    value={u.role?.type ?? ""}
                    disabled={isSelf || busyId === u.id}
                    onChange={(e) => changeRole(u, e.target.value)}
                    className="h-8 rounded-md border border-ink-200 bg-paper-raised px-2 text-small text-ink-900 outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {LABEL[r]}
                      </option>
                    ))}
                  </select>
                </Td>
                <Td>
                  <Badge tone={u.blocked ? "danger" : "neutral"}>
                    {u.blocked ? "Blocked" : "Active"}
                  </Badge>
                </Td>
                <Td className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isSelf || busyId === u.id}
                    onClick={() =>
                      u.blocked ? toggleBlock(u) : setBlockModal(u)
                    }
                  >
                    {u.blocked ? "Unblock" : "Block"}
                  </Button>
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>

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
        className="w-full max-w-md rounded-lg border border-ink-200 bg-paper-raised p-6 shadow-[var(--shadow-overlay)]"
      >
        <h2 className="text-h3 text-ink-900">Block {name}</h2>
        <p className="mt-1 text-small text-ink-500">
          They&apos;ll be signed out on their next request and shown this reason.
        </p>
        <div className="mt-4">
          <Textarea
            ref={textareaRef}
            label="Reason (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={busy || reason.trim().length === 0}
            loading={busy}
            loadingLabel="Blocking…"
            onClick={() => onConfirm(reason.trim())}
          >
            Block {name}
          </Button>
        </div>
      </div>
    </div>
  );
}
