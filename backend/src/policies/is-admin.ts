import type { PolicyContext } from './_policy-context';

/**
 * global::is-admin — the caller's application role must be `admin`.
 * Layer 3 (RBAC.md). Layer 1 (auth) already ran, so state.user is set.
 */
export default (policyContext: unknown): boolean => {
  const ctx = policyContext as PolicyContext;
  return ctx.state.user?.role?.type === 'admin';
};
