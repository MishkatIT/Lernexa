import type { PolicyContext } from './_policy-context';

/**
 * global::has-role — the caller's role must be one of `config.roles`.
 *
 *   { name: 'global::has-role', config: { roles: ['admin', 'content-manager'] } }
 *
 * Role membership only. Ownership of a specific row is a separate policy.
 */
export default (policyContext: unknown, config: unknown): boolean => {
  const ctx = policyContext as PolicyContext;
  const allowed = (config as { roles?: string[] } | undefined)?.roles ?? [];
  const type = ctx.state.user?.role?.type;
  return Boolean(type && allowed.includes(type));
};
