/**
 * Strapi's exported `PolicyContext` type is incomplete (no `state` / `params`),
 * so every policy casts the runtime context to this shape once. It is the Koa
 * ctx surface the policies actually touch — identity, route params, body.
 */
export type PolicyContext = {
  state: {
    user?: {
      id: number;
      role?: { type?: string } | null;
    } | null;
  };
  params: Record<string, string | undefined>;
  request: {
    body?: {
      data?: Record<string, unknown> & {
        course?:
          | string
          | number
          | { documentId?: string; id?: number; connect?: Array<string | { documentId?: string }> };
      };
    };
  };
};
