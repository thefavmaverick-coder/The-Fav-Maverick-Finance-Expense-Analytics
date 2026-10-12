
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UserRole = {
  user_id: string;
  role: string;
};

type AdminUsersRequest = {
  page?: number;
  perPage?: number;
};

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  // Handle browser CORS preflight requests.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  try {
    // Read server-side environment variables.
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Required Supabase environment variables are missing.");
      return respond({ error: "Server configuration error" }, 500);
    }

    // Verify the request contains a valid access token.
    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return respond({ error: "Authentication required" }, 401);
    }

    const accessToken = authorization.slice("Bearer ".length).trim();

    if (!accessToken) {
      return respond({ error: "Authentication required" }, 401);
    }

    // Client used to verify the current user's identity.
    const authClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user: currentUser },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !currentUser) {
      return respond({ error: "Invalid or expired session" }, 401);
    }

    // Service-role client is used only inside this server function.
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check whether the requesting user is an administrator.
    const {
      data: roleData,
      error: roleError,
    } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (roleError) {
      console.error("Admin role lookup failed:", roleError.message);
      return respond({ error: "Unable to verify administrator role" }, 500);
    }

    if (roleData?.role !== "admin") {
      return respond({ error: "Administrator access required" }, 403);
    }

    // Validate pagination parameters.
    let requestBody: AdminUsersRequest = {};

    try {
      requestBody = await req.json();
    } catch {
      return respond({ error: "Invalid JSON request body" }, 400);
    }

    const requestedPage = Number(requestBody.page ?? 1);
    const requestedPerPage = Number(requestBody.perPage ?? 50);

    if (
      !Number.isInteger(requestedPage) ||
      requestedPage < 1 ||
      !Number.isInteger(requestedPerPage) ||
      requestedPerPage < 1
    ) {
      return respond({ error: "Invalid pagination parameters" }, 400);
    }

    const page = requestedPage;
    const perPage = Math.min(requestedPerPage, 100);

    // Fetch registered accounts using the server-side Admin API.
    const {
      data: usersData,
      error: usersError,
    } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (usersError) {
      console.error("Unable to list registered users:", usersError.message);
      return respond({ error: "Unable to retrieve registered users" }, 500);
    }

    const users = usersData.users;

    // Retrieve application roles for the users on this page.
    const userIds = users.map((item) => item.id);
    const roleMap = new Map<string, string>();

    if (userIds.length > 0) {
      const {
        data: rolesData,
        error: rolesError,
      } = await adminClient
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      if (rolesError) {
        console.error("Unable to retrieve user roles:", rolesError.message);
        return respond({ error: "Unable to retrieve user roles" }, 500);
      }

      const roles: UserRole[] = (rolesData ?? []) as UserRole[];

      for (const item of roles) {
        roleMap.set(item.user_id, item.role);
      }
    }

    // Return only the account fields needed by the admin dashboard.
    const result = users.map((item) => ({
      id: item.id,
      email: item.email ?? null,
      created_at: item.created_at,
      last_sign_in_at: item.last_sign_in_at ?? null,
      email_confirmed: Boolean(item.email_confirmed_at),
      role: roleMap.get(item.id) ?? "user",
    }));

    return respond({
      users: result,
      page,
      perPage,
      total: usersData.total ?? null,
    });
  } catch (error) {
    console.error(
      "Unexpected admin-users function error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return respond({ error: "An unexpected server error occurred" }, 500);
  }
});
