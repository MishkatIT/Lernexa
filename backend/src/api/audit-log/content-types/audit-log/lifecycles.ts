/**
 * The audit log is append-only — DECISIONS.md / DESIGN_SYSTEM.md.
 *
 * There is no update or delete route for this type, and it is granted to no
 * role. These lifecycle guards are the last line: they also stop the Strapi
 * admin panel (Content Manager) and any accidental programmatic write from
 * mutating history. Only `create` and reads are allowed through.
 */
const frozen = () => {
  throw new Error(
    'Audit log entries are append-only and cannot be modified or deleted.',
  );
};

export default {
  beforeUpdate: frozen,
  beforeUpdateMany: frozen,
  beforeDelete: frozen,
  beforeDeleteMany: frozen,
};
