import { createClient } from "@supabase/supabase-js";
import { LeaderboardEntry, BranchLeaderboardEntry } from "../types";

export interface WeeklyLeaderboardStorageData {
  weekStartDate: string;
  weekEndDate: string;
  processedAt: string;
  totalParticipants: number;
  topScore: number;
  overall: LeaderboardEntry[];
  branches: Record<string, LeaderboardEntry[]>;
  branchRankings?: BranchLeaderboardEntry[];
}

const BUCKET_NAME = "leaderboard";
const FILE_NAME = "weekly_leaderboard.json";

// In-memory cache to prevent redundant network fetches
let cachedWeeklyLeaderboard: {
  data: WeeklyLeaderboardStorageData;
  cachedAt: number;
} | null = null;

const CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory cache

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    "";
  return createClient(url, key);
}

/**
 * Uploads processed weekly leaderboard JSON to database's Supabase Storage
 */
export async function saveWeeklyLeaderboardToStorage(
  data: WeeklyLeaderboardStorageData
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const jsonString = JSON.stringify(data, null, 2);
    const buffer = Buffer.from(jsonString, "utf-8");

    // Ensure bucket exists
    try {
      await supabase.storage.createBucket(BUCKET_NAME, { public: true });
    } catch {
      // Ignore if bucket already exists
    }

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(FILE_NAME, buffer, {
        contentType: "application/json",
        upsert: true,
      });

    if (error) {
      console.error("saveWeeklyLeaderboardToStorage upload error:", error);
      return false;
    }

    // Update in-memory cache
    cachedWeeklyLeaderboard = {
      data,
      cachedAt: Date.now(),
    };

    return true;
  } catch (err) {
    console.error("saveWeeklyLeaderboardToStorage unexpected error:", err);
    return false;
  }
}

/**
 * Fetches processed weekly leaderboard JSON from database's Supabase Storage
 */
export async function getWeeklyLeaderboardFromStorage(): Promise<WeeklyLeaderboardStorageData | null> {
  // Check memory cache
  if (cachedWeeklyLeaderboard && Date.now() - cachedWeeklyLeaderboard.cachedAt < CACHE_TTL_MS) {
    return cachedWeeklyLeaderboard.data;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(FILE_NAME);

    if (error || !data) {
      // If file not found yet (e.g. before first Sunday run)
      return null;
    }

    const text = await data.text();
    const parsed: WeeklyLeaderboardStorageData = JSON.parse(text);

    cachedWeeklyLeaderboard = {
      data: parsed,
      cachedAt: Date.now(),
    };

    return parsed;
  } catch (err) {
    console.error("getWeeklyLeaderboardFromStorage error:", err);
    return null;
  }
}

/**
 * Invalidate in-memory cache
 */
export function invalidateWeeklyLeaderboardCache(): void {
  cachedWeeklyLeaderboard = null;
}
