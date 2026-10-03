import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getServices } from "../../../services/container";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Can be ignored if called from Server Component or middleware
            }
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      const authUser = data.user;
      const services = getServices();

      const username =
        authUser.user_metadata?.user_name ||
        authUser.email?.split("@")[0]?.toLowerCase() ||
        `user_${authUser.id.substring(0, 6)}`;

      const fullName =
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        username;

      const syncResult = await services.auth.syncOAuthUser({
        id: authUser.id,
        username,
        name: fullName,
      });

      const user = syncResult.user;

      if (user) {
        // Redirect according to role & branch
        const requiresBranch =
          user.role === "employee" ||
          user.role === "manager_assistant" ||
          user.role === "manager";

        if (requiresBranch && !user.branchName) {
          return NextResponse.redirect(new URL("/awaiting-assignment", request.url));
        }

        if (user.role === "admin" || user.role === "committee" || user.role === "general_manager") {
          return NextResponse.redirect(new URL("/admin/dashboard", request.url));
        } else if (user.role === "manager" || user.role === "manager_assistant") {
          return NextResponse.redirect(new URL("/manager/dashboard", request.url));
        } else {
          return NextResponse.redirect(new URL("/position", request.url));
        }
      }
    }
  }

  // Return user to an error page or destination with error instructions
  return NextResponse.redirect(new URL(next, request.url));
}
