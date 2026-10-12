
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import "./AdminUsers.css";

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  role: string;
};

type AdminUsersResponse = {
  users: AdminUser[];
  page: number;
  perPage: number;
  total: number | null;
};

type AdminUsersProps = {
  userId: string;
};

const PAGE_SIZE = 50;

function formatDate(value: string | null | undefined): string {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(email: string | null): string {
  if (!email) return "U";

  const name = email.split("@")[0];

  return name.slice(0, 2).toUpperCase();
}

export default function AdminUsers({ userId }: AdminUsersProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  // Verify the current user's application role.
  useEffect(() => {
    let cancelled = false;

    async function checkAdminRole() {
      setCheckingAdmin(true);
      setError("");

      const { data, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (roleError) {
        console.error("Admin role check failed:", roleError.message);
        setIsAdmin(false);
        setError(
          "Could not verify your admin role. Check the user_roles table and its Row Level Security policies.",
        );
      } else {
        setIsAdmin(data?.role === "admin");

        if (data?.role !== "admin") {
          setError(
            "Admin access is not enabled for this account. Assign the admin role to your user ID in Supabase.",
          );
        }
      }

      setCheckingAdmin(false);
    }

    void checkAdminRole();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Fetch registered accounts from the protected Edge Function.
  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const { data, error: functionError } =
        await supabase.functions.invoke<AdminUsersResponse>("admin-users", {
          body: {
            page,
            perPage: PAGE_SIZE,
          },
        });

      if (functionError) {
        throw new Error(
          functionError.message ||
            "Unable to load users. Check that the admin-users function is deployed.",
        );
      }

      if (!data || !Array.isArray(data.users)) {
        throw new Error("The server returned an unexpected response.");
      }

      setUsers(data.users);
      setTotal(typeof data.total === "number" ? data.total : null);
    } catch (err) {
      console.error("Failed to load admin users:", err);

      setUsers([]);
      setTotal(null);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading users.",
      );
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page]);

useEffect(() => {
  if (!isAdmin) return;

  let cancelled = false;

  const fetchUsers = async () => {
    if (cancelled) return;
    await loadUsers();
  };

  void fetchUsers();

  return () => {
    cancelled = true;
  };
}, [isAdmin, loadUsers, refreshCount]);

  // Filter the currently loaded page by email and role.
  const filteredUsers = users.filter((user) => {
    const query = search.trim().toLowerCase();

    if (!query) return true;

    return (
      (user.email ?? "").toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query) ||
      user.id.toLowerCase().includes(query)
    );
  });

  const adminCount = users.filter((user) => user.role === "admin").length;
  const confirmedCount = users.filter(
    (user) => user.email_confirmed,
  ).length;

  function refreshUsers() {
    setRefreshCount((count) => count + 1);
  }

  function goToPreviousPage() {
    if (page > 1 && !loading) {
      setPage((current) => current - 1);
    }
  }

  function goToNextPage() {
    if (!loading && (total === null || page * PAGE_SIZE < total)) {
      setPage((current) => current + 1);
    }
  }

  if (checkingAdmin) {
    return (
      <section className="admin-panel">
        <div className="admin-status">
          <span className="admin-spinner" />
          <p>Verifying administrator access...</p>
        </div>
      </section>
    );
  }


if (!isAdmin) {
  return null;
}


  return (
    <section className="admin-panel">
      <div className="admin-heading">
        <div className="admin-heading-icon">⚡</div>

        <div className="admin-heading-text">
          <span className="admin-eyebrow">CONTROL CENTER</span>
          <h2>Administrator Console</h2>
          <p>Manage registered accounts and review account status.</p>
        </div>

        <button
          type="button"
          className="admin-refresh-button"
          onClick={refreshUsers}
          disabled={loading}
          aria-label="Refresh registered users"
        >
          <span className={loading ? "admin-refreshing" : ""}>↻</span>
          <span>Refresh</span>
        </button>
      </div>

      <div className="admin-security-note">
        <span aria-hidden="true">🛡️</span>
        <p>
          <strong>Privacy protected.</strong> This console displays account
          information only. Users' financial transactions remain private.
        </p>
      </div>

      {error && (
        <div className="admin-message admin-message-error" role="alert">
          <strong>Something needs attention</strong>
          <p>{error}</p>
          <button type="button" onClick={refreshUsers}>
            Try again
          </button>
        </div>
      )}

      <div className="admin-stats">
        <article className="admin-stat-card">
          <span className="admin-stat-icon">👥</span>
          <span className="admin-stat-label">Registered accounts</span>
          <strong className="admin-stat-value">
            {total === null ? "—" : total.toLocaleString("en-IN")}
          </strong>
          <span className="admin-stat-footnote">All account pages</span>
        </article>

        <article className="admin-stat-card">
          <span className="admin-stat-icon">✉️</span>
          <span className="admin-stat-label">Confirmed emails</span>
          <strong className="admin-stat-value">
            {confirmedCount}
            <span className="admin-stat-unit"> / {users.length}</span>
          </strong>
          <span className="admin-stat-footnote">Current page</span>
        </article>

        <article className="admin-stat-card">
          <span className="admin-stat-icon">🛡️</span>
          <span className="admin-stat-label">Admin accounts</span>
          <strong className="admin-stat-value">{adminCount}</strong>
          <span className="admin-stat-footnote">Current page</span>
        </article>

        <article className="admin-stat-card">
          <span className="admin-stat-icon">📄</span>
          <span className="admin-stat-label">Current page</span>
          <strong className="admin-stat-value">{page}</strong>
          <span className="admin-stat-footnote">
            {users.length} account{users.length === 1 ? "" : "s"} loaded
          </span>
        </article>
      </div>

      <div className="admin-table-card">
        <div className="admin-table-toolbar">
          <div>
            <h3>Registered Users</h3>
            <p>Account registration and sign-in information</p>
          </div>

          <label className="admin-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search email, role or ID..."
              aria-label="Search registered users"
            />
          </label>
        </div>

        <div className="admin-table-scroll">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>USER</th>
                <th>ROLE</th>
                <th>REGISTERED</th>
                <th>LAST SIGN-IN</th>
                <th>EMAIL STATUS</th>
              </tr>
            </thead>

            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-empty">
                    <span className="admin-spinner" />
                    <p>Loading registered users...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-empty">
                    <span className="admin-empty-icon">🔎</span>
                    <p>
                      {search
                        ? "No users match your search."
                        : "No registered users found."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="admin-avatar">
                          {getInitials(item.email)}
                        </div>

                        <div className="admin-user-info">
                          <strong>{item.email || "No email available"}</strong>
                          <span title={item.id}>
                            ID: {item.id.slice(0, 8)}…
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`admin-role-badge ${
                          item.role === "admin"
                            ? "admin-role-admin"
                            : "admin-role-user"
                        }`}
                      >
                        {item.role === "admin" ? "★ Admin" : "User"}
                      </span>
                    </td>

                    <td>
                      <span className="admin-date">
                        {formatDate(item.created_at)}
                      </span>
                    </td>

                    <td>
                      <span className="admin-date">
                        {formatDate(item.last_sign_in_at)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`admin-email-badge ${
                          item.email_confirmed
                            ? "admin-email-confirmed"
                            : "admin-email-pending"
                        }`}
                      >
                        <span className="admin-status-dot" />
                        {item.email_confirmed ? "Confirmed" : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-table-footer">
          <p>
            Showing {filteredUsers.length} of {users.length} users on page{" "}
            {page}
            {total !== null ? ` · ${total} total accounts` : ""}
          </p>

          <div className="admin-pagination">
            <button
              type="button"
              onClick={goToPreviousPage}
              disabled={page === 1 || loading}
            >
              ← Previous
            </button>

            <span>{page}</span>

            <button
              type="button"
              onClick={goToNextPage}
              disabled={
                loading ||
                users.length < PAGE_SIZE ||
                (total !== null && page * PAGE_SIZE >= total)
              }
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      <p className="admin-footer-note">
        Account information is provided by Supabase Authentication. Financial
        records are not displayed in this panel.
      </p>
    </section>
  );
}
