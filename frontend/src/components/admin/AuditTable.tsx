"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { relativeTime } from "@/lib/format";
import {
  actionLabel,
  type AuditEntry,
  type AuditCategory,
} from "@/lib/audit-shared";

const CATEGORY_TONE: Record<AuditCategory, "warning" | "neutral"> = {
  security: "warning",
  content: "neutral",
  account: "neutral",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  "content-manager": "Content Manager",
  instructor: "Instructor",
  student: "Student",
};

function fullDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
}

/** Human summary of the metadata for the common shapes; raw JSON otherwise. */
function MetaDetail({ entry }: { entry: AuditEntry }) {
  const m = entry.metadata;
  if (!m || Object.keys(m).length === 0) {
    return <p className="text-small text-ink-500">No additional detail.</p>;
  }

  if (entry.action === "user.role_changed" && "from" in m && "to" in m) {
    return (
      <p className="text-body text-ink-900">
        <span className="font-mono text-ink-500">
          {ROLE_LABEL[String(m.from)] ?? String(m.from ?? "—")}
        </span>{" "}
        →{" "}
        <span className="font-mono">
          {ROLE_LABEL[String(m.to)] ?? String(m.to)}
        </span>
      </p>
    );
  }

  if (entry.action === "settings.updated" && m.changes && typeof m.changes === "object") {
    const changes = m.changes as Record<string, { from: unknown; to: unknown }>;
    return (
      <ul className="flex flex-col gap-1 text-body text-ink-900">
        {Object.entries(changes).map(([field, { from, to }]) => (
          <li key={field}>
            <span className="text-ink-500">{field}: </span>
            <span className="font-mono text-ink-500">{JSON.stringify(from)}</span>{" "}
            → <span className="font-mono">{JSON.stringify(to)}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (typeof m.reason === "string" && m.reason) {
    return (
      <p className="text-body text-ink-900">
        <span className="text-ink-500">Reason: </span>
        {m.reason}
      </p>
    );
  }

  const simple = ["title", "email"].find(
    (k) => typeof m[k] === "string" && m[k],
  );
  if (simple) {
    return (
      <p className="text-body text-ink-900">
        <span className="text-ink-500 capitalize">{simple}: </span>
        {String(m[simple])}
      </p>
    );
  }

  return (
    <pre className="overflow-x-auto rounded-md border border-ink-200 bg-paper p-3 font-mono text-small text-ink-700">
      {JSON.stringify(m, null, 2)}
    </pre>
  );
}

export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto rounded-lg border border-ink-200">
      <table className="w-full border-collapse text-body">
        <thead>
          <tr className="border-b border-ink-200 bg-paper/50 text-left text-small uppercase tracking-[0.08em] text-ink-500">
            <th className="px-4 py-2.5 font-medium">When</th>
            <th className="px-4 py-2.5 font-medium">Actor</th>
            <th className="px-4 py-2.5 font-medium">Event</th>
            <th className="px-4 py-2.5 font-medium">Target</th>
            <th className="w-10 px-4 py-2.5" />
          </tr>
        </thead>
        {entries.map((e) => {
          const isOpen = open === e.id;
          return (
            <tbody key={e.id} className="border-b border-ink-200 last:border-0">
                <tr
                  onClick={() => setOpen(isOpen ? null : e.id)}
                  className="cursor-pointer align-top hover:bg-ink-100/50"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-small text-ink-500">
                    <span title={fullDate(e.createdAt)}>
                      {relativeTime(e.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-body text-ink-900">
                        {e.actorLabel ?? "System"}
                      </span>
                      {e.actorRole ? (
                        <Badge>{ROLE_LABEL[e.actorRole] ?? e.actorRole}</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-body text-ink-900">
                        {actionLabel(e.action)}
                      </span>
                      <Badge tone={CATEGORY_TONE[e.category]}>{e.category}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-body text-ink-700">
                    {e.targetLabel ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-500">
                    <span
                      aria-hidden
                      className={`inline-block transition-transform ${
                        isOpen ? "rotate-90" : ""
                      }`}
                    >
                      ›
                    </span>
                    <span className="sr-only">
                      {isOpen ? "Hide detail" : "Show detail"}
                    </span>
                  </td>
                </tr>
                {isOpen ? (
                  <tr className="bg-paper/50">
                    <td colSpan={5} className="px-4 py-4">
                      <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-small">
                          <dt className="text-ink-500">Action</dt>
                          <dd className="font-mono text-ink-700">{e.action}</dd>
                          <dt className="text-ink-500">When</dt>
                          <dd className="font-mono text-ink-700">
                            {fullDate(e.createdAt)}
                          </dd>
                          <dt className="text-ink-500">Actor ID</dt>
                          <dd className="font-mono text-ink-700">
                            {e.actorId ?? "—"}
                          </dd>
                          <dt className="text-ink-500">Target</dt>
                          <dd className="font-mono text-ink-700">
                            {e.targetType ?? "—"}
                            {e.targetId ? ` · ${e.targetId}` : ""}
                          </dd>
                          <dt className="text-ink-500">IP</dt>
                          <dd className="font-mono text-ink-700">{e.ip ?? "—"}</dd>
                        </dl>
                        <div>
                          <p className="mb-1.5 text-small font-medium uppercase tracking-[0.12em] text-ink-500">
                            Detail
                          </p>
                          <MetaDetail entry={e} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            );
          })}
      </table>
    </div>
  );
}
