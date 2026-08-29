"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addEnrollments,
  removeEnrollments,
  type AddEnrollmentRow,
} from "@/actions/enrollments";
import type { StudentProgressRow } from "@/lib/courses";
import { shortDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { ProgressBar } from "@/components/progress/ProgressBar";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";

const OUTCOME_COPY: Record<AddEnrollmentRow["status"], string> = {
  enrolled: "added",
  "already-enrolled": "already enrolled",
  "not-found": "no account with that email",
  "not-a-student": "not a student account",
  blocked: "account is blocked",
};

function AddPanel({
  courseDocumentId,
  onDone,
}: {
  courseDocumentId: string;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [raw, setRaw] = useState("");
  const [resetProgress, setResetProgress] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AddEnrollmentRow[] | null>(null);

  async function submit() {
    const emails = raw
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (emails.length === 0) {
      setError("Enter at least one email address.");
      return;
    }
    setError(null);
    setBusy(true);
    const res = await addEnrollments(courseDocumentId, emails, resetProgress);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRows(res.results ?? []);
    const added = res.added ?? 0;
    toast(
      added === 0
        ? "No new students added"
        : `${added} student${added === 1 ? "" : "s"} added`,
    );
    if (added > 0) {
      setRaw("");
      onDone();
    }
  }

  const problems = (rows ?? []).filter((r) => r.status !== "enrolled");

  return (
    <div className="mt-4 rounded-lg border border-ink-200 bg-paper-raised p-4">
      {error ? (
        <Alert className="mb-3" tone="danger">
          {error}
        </Alert>
      ) : null}

      <Textarea
        label="Student emails — one per line"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={"ada@example.com\ngrace@example.com"}
        rows={4}
      />

      <label className="mt-3 flex items-start gap-2 text-small text-ink-700">
        <input
          type="checkbox"
          checked={resetProgress}
          onChange={(e) => setResetProgress(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-accent-600"
        />
        <span>
          Start fresh — clear any earlier progress these students have in this
          course. Leave unchecked to let a re-added student resume where they
          left off.
        </span>
      </label>

      <div className="mt-3 flex gap-3">
        <Button size="sm" onClick={submit} loading={busy} loadingLabel="Adding…">
          Add to course
        </Button>
      </div>

      {rows && problems.length > 0 ? (
        <div className="mt-4 border-t border-ink-200 pt-3 text-small text-ink-700">
          <p className="mb-1 font-medium text-ink-900">
            {problems.length} not added:
          </p>
          <ul className="flex flex-col gap-0.5">
            {problems.map((r) => (
              <li key={r.email} className="font-mono">
                {r.email} — {OUTCOME_COPY[r.status]}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function RosterManager({
  courseDocumentId,
  students,
}: {
  courseDocumentId: string;
  students: StudentProgressRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [purgeProgress, setPurgeProgress] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ids = useMemo(() => students.map((s) => s.student.id), [students]);
  const allSelected = ids.length > 0 && selected.size === ids.length;

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(ids));
  }

  function resetRemoveUI() {
    setConfirming(false);
    setPurgeProgress(false);
    setSelected(new Set());
  }

  async function remove() {
    setError(null);
    setBusy(true);
    const res = await removeEnrollments(
      courseDocumentId,
      [...selected],
      purgeProgress,
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setConfirming(false);
      return;
    }
    const n = res.removed ?? 0;
    toast(`${n} student${n === 1 ? "" : "s"} removed`);
    resetRemoveUI();
    router.refresh();
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-small text-ink-500">
          {students.length} enrolled
          {selected.size > 0 ? ` · ${selected.size} selected` : ""}
        </p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setAdding((v) => !v)}
          aria-expanded={adding}
        >
          {adding ? "Close" : "Add students"}
        </Button>
      </div>

      {adding ? (
        <AddPanel
          courseDocumentId={courseDocumentId}
          onDone={() => router.refresh()}
        />
      ) : null}

      {error ? (
        <Alert className="mt-4" tone="danger">
          {error}
        </Alert>
      ) : null}

      {selected.size > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-ink-200 bg-paper-raised px-3 py-2.5">
          {confirming ? (
            <>
              <span className="text-small text-ink-700">
                Remove {selected.size} student
                {selected.size === 1 ? "" : "s"} from this course?
              </span>
              <label className="flex items-center gap-2 text-small text-ink-700">
                <input
                  type="checkbox"
                  checked={purgeProgress}
                  onChange={(e) => setPurgeProgress(e.target.checked)}
                  className="h-4 w-4 accent-accent-600"
                />
                also delete their progress
              </label>
              <Button
                size="sm"
                variant="danger"
                onClick={remove}
                loading={busy}
                loadingLabel="Removing…"
              >
                Confirm remove
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <span className="text-small text-ink-700">
                {selected.size} selected
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setConfirming(true)}
              >
                Remove from course
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
            </>
          )}
        </div>
      ) : null}

      {students.length === 0 ? (
        <p className="mt-4 text-body text-ink-500">No students enrolled yet.</p>
      ) : (
        <div className="mt-4 rounded-lg border border-ink-200">
          <Table>
            <THead>
              <Th className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all students"
                  className="h-4 w-4 accent-accent-600"
                />
              </Th>
              <Th>Student</Th>
              <Th className="w-44">Progress</Th>
              <Th>Lessons</Th>
              <Th>Last activity</Th>
            </THead>
            <TBody>
              {students.map((s) => (
                <Tr key={s.student.id}>
                  <Td>
                    <input
                      type="checkbox"
                      checked={selected.has(s.student.id)}
                      onChange={() => toggle(s.student.id)}
                      aria-label={`Select ${s.student.name}`}
                      className="h-4 w-4 accent-accent-600"
                    />
                  </Td>
                  <Td>{s.student.name}</Td>
                  <Td>
                    <ProgressBar
                      completed={s.progress.completed}
                      total={s.progress.total}
                    />
                  </Td>
                  <Td className="font-mono text-small text-ink-500">
                    {s.progress.completed}/{s.progress.total}
                  </Td>
                  <Td className="font-mono text-small text-ink-500">
                    {s.lastActivity ? shortDate(s.lastActivity) : "—"}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
