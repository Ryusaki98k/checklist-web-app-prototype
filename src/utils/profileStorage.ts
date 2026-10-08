/**
 * Helper utilities for User Profile Images and Supabase Storage integration
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

/**
 * Returns the public image URL for a given profile_id from Supabase storage.
 * If the profile_id is already a full URL, it returns it directly.
 * Returns null if profile_id is missing or empty.
 */
export function getProfileImageUrl(profile_id?: string | null): string | null {
  if (!profile_id || profile_id.trim() === "") return null;
  const clean = profile_id.trim();
  if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("data:")) {
    return clean;
  }
  if (!SUPABASE_URL) return null;
  const cleanBase = SUPABASE_URL.replace(/\/+$/, "");
  return `${cleanBase}/storage/v1/object/public/profiles/${clean}`;
}

/**
 * Formats user initial letters for avatar fallback (e.g., "สมศรี ใจดี" -> "สม", "Admin" -> "AD")
 */
export function getUserInitials(name?: string, role?: string): string {
  if (!name || name.trim() === "") {
    if (role === "admin") return "AD";
    if (role === "manager") return "M";
    if (role === "manager_assistant") return "A";
    if (role === "committee" || role === "general_manager") return "EX";
    return "US";
  }

  const trimmed = name.trim();
  // If English name
  const words = trimmed.split(/\s+/);
  if (words.length >= 2 && /^[a-zA-Z]/.test(trimmed)) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  // Strip common Thai titles like "คุณ"
  let cleanName = trimmed;
  if (cleanName.startsWith("คุณ")) {
    cleanName = cleanName.substring(3).trim();
  }

  if (cleanName.length >= 2) {
    return cleanName.slice(0, 2);
  }
  return cleanName || "US";
}
