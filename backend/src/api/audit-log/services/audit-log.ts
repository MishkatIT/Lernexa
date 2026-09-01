import { factories } from '@strapi/strapi';

const UID = 'api::audit-log.audit-log';

export type AuditCategory = 'security' | 'content' | 'account';

type Actor = {
  id?: number | null;
  label?: string | null;
  role?: string | null;
};

type Target = {
  type?: string | null;
  id?: string | number | null;
  label?: string | null;
};

type RecordInput = {
  action: string;
  category: AuditCategory;
  /** Koa ctx — actor identity and request IP are read from it when present. */
  ctx?: any;
  /** Overrides / fills in actor when there is no authenticated ctx (e.g. register). */
  actor?: Actor;
  target?: Target;
  metadata?: Record<string, unknown>;
};

// Defence in depth — the call sites already pass only safe fields, but never
// let a key that looks like a credential reach the stored row.
const SENSITIVE = /pass|token|secret|jwt|auth|cookie|otp|api[-_]?key|credential/i;
const MAX_STRING = 500;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? '[redacted]' : sanitize(v, depth + 1);
    }
    return out;
  }
  return value;
}

function actorFromCtx(ctx: any): Actor {
  const u = ctx?.state?.user;
  if (!u) return {};
  const name = u.fullName || u.username || u.email || `user ${u.id}`;
  return {
    id: u.id ?? null,
    label: u.email ? `${name} <${u.email}>` : name,
    role: u.role?.type ?? null,
  };
}

function ipFromCtx(ctx: any): string | null {
  if (!ctx?.request) return null;
  const fwd = ctx.request.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return ctx.request.ip ?? null;
}

export default factories.createCoreService(UID, ({ strapi }) => ({
  /**
   * Append one entry. Never throws — an audit failure must not break the user
   * action it describes; it is logged and swallowed.
   *
   * The row is never on the critical path of the action it records, so in
   * production the INSERT is fired without holding the response for it (it
   * still swallows its own errors). Under the test runner it stays awaited —
   * the suite asserts on audit rows immediately after the action that writes
   * them, and needs that to be deterministic.
   */
  async record(input: RecordInput): Promise<void> {
    // Read everything off the Koa ctx now, synchronously — the INSERT may run
    // after the response has been sent and the ctx is on its way out.
    const actor: Actor = {
      ...(input.ctx ? actorFromCtx(input.ctx) : {}),
      ...(input.actor ?? {}),
    };
    const row = {
      action: input.action,
      category: input.category,
      actorId: actor.id ?? null,
      actorLabel: actor.label ?? null,
      actorRole: actor.role ?? null,
      targetType: input.target?.type ?? null,
      targetId: input.target?.id != null ? String(input.target.id) : null,
      targetLabel: input.target?.label ?? null,
      metadata: input.metadata
        ? (sanitize(input.metadata) as Record<string, unknown>)
        : null,
      ip: input.ctx ? ipFromCtx(input.ctx) : null,
    };

    const write = async (): Promise<void> => {
      try {
        await strapi.db.query(UID).create({ data: row });
      } catch (err) {
        strapi.log.warn(
          `[audit] failed to record "${input.action}": ${(err as Error).message}`,
        );
      }
    };

    if (process.env.NODE_ENV === 'test') {
      await write();
    } else {
      void write();
    }
  },
}));
