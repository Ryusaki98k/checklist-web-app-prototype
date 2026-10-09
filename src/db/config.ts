/**
 * Database and Schema Environment Configuration
 *
 * This configuration determines the active PostgreSQL schema and database connection
 * for Vercel deployments (Production vs. Preview) as well as local development.
 *
 * Defaults:
 * - Production: "checklist_prod"
 * - Preview:    "checklist_prev"
 *
 * Configuration rules:
 * 1. Explicit schema override:
 *    If `NEXT_PUBLIC_DB_SCHEMA` or `DB_SCHEMA` or `DATABASE_SCHEMA` is set, that value is used directly.
 * 2. Preview determination (`is_preview`):
 *    - Explicitly set `NEXT_PUBLIC_IS_PREVIEW`, `IS_PREVIEW`, or `is_preview` ("true" / "1" / "false" / "0").
 *    - Or automatically detected via Vercel's environment: `VERCEL_ENV === "preview"` (or `NEXT_PUBLIC_VERCEL_ENV === "preview"`).
 * 3. Database URL:
 *    If in preview mode and `DATABASE_URL_PREVIEW` or `PREVIEW_DATABASE_URL` is provided, that connection
 *    string is used; otherwise, it falls back to `DATABASE_URL`.
 */

export function isPreviewMode(): boolean {
  // 1. Explicit preview flags
  const explicit =
    process.env.NEXT_PUBLIC_IS_PREVIEW ??
    process.env.IS_PREVIEW ??
    process.env.is_preview;

  if (explicit !== undefined && explicit !== "") {
    return explicit === "true" || explicit === "1";
  }

  // 2. Vercel environment detection
  const vercelEnv =
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.VERCEL_ENV;

  return vercelEnv === "preview";
}

export function getDatabaseSchema(): string {
  // 1. Explicit schema override
  const explicitSchema =
    process.env.NEXT_PUBLIC_DB_SCHEMA ??
    process.env.DB_SCHEMA ??
    process.env.DATABASE_SCHEMA;

  if (explicitSchema && explicitSchema.trim() !== "") {
    return explicitSchema.trim();
  }

  // 2. Environment-based schema selection
  return isPreviewMode() ? "checklist_prev" : "checklist_prod";
}

export function getDatabaseUrl(): string {
  if (isPreviewMode()) {
    const previewUrl =
      process.env.DATABASE_URL_PREVIEW ??
      process.env.PREVIEW_DATABASE_URL;

    if (previewUrl && previewUrl.trim() !== "") {
      return previewUrl.trim();
    }
  }

  return process.env.DATABASE_URL ?? "";
}

export const CURRENT_SCHEMA_NAME = getDatabaseSchema();
export const IS_PREVIEW_MODE = isPreviewMode();
