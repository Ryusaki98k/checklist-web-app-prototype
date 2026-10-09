import { createBrowserClient } from "@supabase/ssr";

export const getSupabaseConfig = () => {
    const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.SUPABASE_URL;

    const supabaseKey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.SUPABASE_ANON_KEY;

    return { supabaseUrl, supabaseKey };
};

export const isSupabaseConfigured = (): boolean => {
    const { supabaseUrl, supabaseKey } = getSupabaseConfig();
    return Boolean(supabaseUrl && supabaseKey);
};

export const createClient = () => {
    const { supabaseUrl, supabaseKey } = getSupabaseConfig();

    if (!supabaseUrl || !supabaseKey) {
        throw new Error(
            "@supabase/ssr: Your project's URL and API key are required to create a Supabase client!\n\n" +
            "Check your Supabase project's API settings to find these values:\n\n" +
            "https://supabase.com/dashboard/project/_/settings/api"
        );
    }

    return createBrowserClient(
        supabaseUrl,
        supabaseKey,
    );
};