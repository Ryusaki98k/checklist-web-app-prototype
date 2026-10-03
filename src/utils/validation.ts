/**
 * Shared validation helpers.
 *
 * User and row identifiers are `uuid` columns in the `checklist_web_app` schema.
 * Passing a non-UUID string (e.g. a preview placeholder) makes Postgres raise
 * 22P02 `invalid input syntax for type uuid`, so validate before it reaches the
 * database rather than letting the query throw.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id: unknown): id is string {
  return typeof id === "string" && UUID_PATTERN.test(id);
}