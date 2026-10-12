import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import AnalysisCharts from "./AnalysisCharts";
import AdminUsers from "./AdminUsers";
import "./App.css";

type Transaction = {
  id: string;
  user_id: string;
  transaction_type: "income" | "expense";
  title: string;
  category: string;
  amount: number;
  transaction_date: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
};

type Page =
  | "Dashboard"
  | "Transactions"
  | "Analytics"
  | "Reports"
  | "Settings";

type Currency = "INR" | "USD" | "EUR" | "GBP" | "AED" | "JPY";

const navigation: { name: Page; icon: string }[] = [
  { name: "Dashboard", icon: "▦" },
  { name: "Transactions", icon: "⇄" },
  { name: "Analytics", icon: "◔" },
  { name: "Reports", icon: "▤" },
  { name: "Settings", icon: "⚙" },
];

const categories = {
  income: [
    "Salary",
    "Business",
    "Freelance",
    "Investment",
    "Gift",
    "Other",
  ],
  expense: [
    "Food",
    "Transport",
    "Shopping",
    "Bills",
    "Health",
    "Education",
    "Entertainment",
    "Travel",
    "Rent",
    "Other",
  ],
};

const currencyLocales: Record<Currency, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  AED: "en-AE",
  JPY: "ja-JP",
};

const currencySymbols: Record<Currency, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
  JPY: "¥",
};

const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function money(value: number, currency: Currency) {
  return new Intl.NumberFormat(currencyLocales[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function App() {
  const [showPassword, setShowPassword] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profileName, setProfileName] = useState("");
const [profilePhone, setProfilePhone] = useState("");
const [profileBio, setProfileBio] = useState("");
const [profileCity, setProfileCity] = useState("");
const [profileCountry, setProfileCountry] = useState("India");
const [monthlyIncome, setMonthlyIncome] = useState("");
const [monthlySavingsTarget, setMonthlySavingsTarget] = useState("");
const [profileSaving, setProfileSaving] = useState(false);
const [profileMessage, setProfileMessage] = useState("");
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [page, setPage] = useState<Page>("Dashboard");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
  useState<Transaction | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const [currency, setCurrency] = useState<Currency>("INR");
  const [accent, setAccent] = useState("#c7f548");
  const [theme, setTheme] = useState<"dark" | "light">("dark");


  // ADD THE NEW STATE HERE
  const [selectedTrend, setSelectedTrend] = useState<{
    month: {
      key: string;
      label: string;
      income: number;
      expense: number;
    };
    type: "income" | "expense";
  } | null>(null);

  // Your remaining existing code continues below

  const [form, setForm] = useState({
    transaction_type: "expense" as "income" | "expense",
    title: "",
    category: "Food",
    amount: "",
    transaction_date: today(),
    payment_method: "UPI",
    notes: "",
  });

  const now = useMemo(() => new Date(), []);
  

// --------------------------------------------------
// AUTHENTICATION
// --------------------------------------------------

useEffect(() => {
  let active = true;

  const initializeAuth = async () => {
    const { data, error: authError } =
      await supabase.auth.getSession();

    if (!active) return;

    if (authError) {
      setError(authError.message);
    }

    setSession(data.session);
    setUser(data.session?.user ?? null);
    setAuthReady(true);
  };

  void initializeAuth();

  const { data: listener } =
    supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setAuthReady(true);
      }
    );

  return () => {
    active = false;
    listener.subscription.unsubscribe();
  };
}, []);



// --------------------------------------------------
// LOAD THE SIGNED-IN USER'S PROFILE
// --------------------------------------------------

useEffect(() => {
  if (!user) return;

  let cancelled = false;

  const loadProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "full_name, display_name, phone, bio, city, country, monthly_income, monthly_savings_target"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (cancelled) return;

    if (error) {
      console.error("Could not load profile:", error.message);
      return;
    }

    setProfileName(
      data?.display_name?.trim() ||
        data?.full_name?.trim() ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "Maverick"
    );

    setProfilePhone(data?.phone ?? "");
    setProfileBio(data?.bio ?? "");
    setProfileCity(data?.city ?? "");
    setProfileCountry(data?.country ?? "India");

    setMonthlyIncome(
      data?.monthly_income == null
        ? ""
        : String(data.monthly_income)
    );

    setMonthlySavingsTarget(
      data?.monthly_savings_target == null
        ? ""
        : String(data.monthly_savings_target)
    );
  };

  void loadProfile();

  return () => {
    cancelled = true;
  };
}, [
  user,
  setProfileName,
  setProfilePhone,
  setProfileBio,
  setProfileCity,
  setProfileCountry,
  setMonthlyIncome,
  setMonthlySavingsTarget,
]);
// --------------------------------------------------
// LOAD THE SIGNED-IN USER'S TRANSACTIONS
// --------------------------------------------------
const saveProfile = async (
  event: FormEvent<HTMLFormElement>
) => {
  event.preventDefault();

  if (!user) {
    setProfileMessage("Please sign in first.");
    return;
  }

  const income =
    monthlyIncome.trim() === ""
      ? null
      : Number(monthlyIncome);

  const savings =
    monthlySavingsTarget.trim() === ""
      ? null
      : Number(monthlySavingsTarget);

  if (
    (income !== null && (!Number.isFinite(income) || income < 0)) ||
    (savings !== null && (!Number.isFinite(savings) || savings < 0))
  ) {
    setProfileMessage("Enter valid non-negative amounts.");
    return;
  }

  setProfileSaving(true);
  setProfileMessage("");

  try {
    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          full_name: profileName.trim() || null,
          email: user.email ?? null,
          phone: profilePhone.trim() || null,
          bio: profileBio.trim() || null,
          city: profileCity.trim() || null,
          country: profileCountry.trim() || "India",
          monthly_income: income,
          monthly_savings_target: savings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (error) throw error;

    setProfileMessage("Profile saved successfully!");
  } catch (error) {
    console.error("Profile save failed:", error);

    setProfileMessage(
      error instanceof Error
        ? error.message
        : "Unable to save profile."
    );
  } finally {
    setProfileSaving(false);
  }
};

  const loadTransactions = useCallback(async () => {
    if (!user) {
      setTransactions([]);
      return;
    }

    const { data, error: loadError } = await supabase
      .from("transactions")
      .select(
        "id,user_id,transaction_type,title,category,amount,transaction_date,payment_method,notes,created_at"
      )
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5000);

    if (loadError) {
      setError(`Could not load transactions: ${loadError.message}`);
      return;
    }

    setTransactions((data ?? []) as Transaction[]);
  }, [user, setTransactions]);



  // --------------------------------------------------
  // REFRESH TRANSACTIONS AFTER AUTHENTICATION
  // --------------------------------------------------

  useEffect(() => {
    if (!authReady || !user) return;

    let cancelled = false;

    const fetchTransactions = async () => {
      const { data, error: loadError } = await supabase
        .from("transactions")
        .select(
          "id,user_id,transaction_type,title,category,amount,transaction_date,payment_method,notes,created_at"
        )
        .eq("user_id", user.id)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5000);

      if (cancelled) return;

      if (loadError) {
        setError(`Could not load transactions: ${loadError.message}`);
        return;
      }

      setTransactions((data ?? []) as Transaction[]);
    };

    void fetchTransactions();

    return () => {
      cancelled = true;
    };
  }, [authReady, user, setTransactions]);

  // --------------------------------------------------
  // FILTER TRANSACTIONS
  // --------------------------------------------------

  const filteredTransactions = useMemo(() => {
    const currentDate = new Date();

    const start =
      dateFilter === "month"
        ? new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            1
          )
        : dateFilter === "year"
          ? new Date(currentDate.getFullYear(), 0, 1)
          : dateFilter === "30days"
            ? new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                currentDate.getDate() - 29
              )
            : null;

    const term = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const transactionDate = new Date(
        `${transaction.transaction_date}T12:00:00`
      );

      const matchesDate = !start || transactionDate >= start;

      const matchesType =
        typeFilter === "all" ||
        transaction.transaction_type === typeFilter;

      const matchesSearch =
        !term ||
        transaction.title.toLowerCase().includes(term) ||
        transaction.category.toLowerCase().includes(term) ||
        (transaction.notes ?? "").toLowerCase().includes(term) ||
        (transaction.payment_method ?? "")
          .toLowerCase()
          .includes(term);

      return matchesDate && matchesType && matchesSearch;
    });
  }, [transactions, dateFilter, typeFilter, search]);

  // --------------------------------------------------
  // FINANCIAL TOTALS
  // --------------------------------------------------

  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter((t) => t.transaction_type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expense = filteredTransactions
      .filter((t) => t.transaction_type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [filteredTransactions]);

  const expenseCategories = useMemo(() => {
    const categoryMap = new Map<string, number>();

    filteredTransactions
      .filter((t) => t.transaction_type === "expense")
      .forEach((t) => {
        categoryMap.set(
          t.category,
          (categoryMap.get(t.category) ?? 0) + Number(t.amount)
        );
      });

    return [...categoryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [filteredTransactions]);

  // Six-month income and expense comparison.
  const monthlyTrend = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - 5 + index,
        1
      );

      return {
        key: `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`,
        label: date.toLocaleDateString("en", {
          month: "short",
        }),
        income: 0,
        expense: 0,
      };
    });

    transactions.forEach((transaction) => {
      const month = months.find(
        (item) =>
          item.key === transaction.transaction_date.slice(0, 7)
      );

      if (!month) return;

      if (transaction.transaction_type === "income") {
        month.income += Number(transaction.amount);
      } else {
        month.expense += Number(transaction.amount);
      }
    });

    return months;
  }, [transactions, now]);

  const maxTrend = Math.max(
    1,
    ...monthlyTrend.flatMap((month) => [
      month.income,
      month.expense,
    ])
  );

  // --------------------------------------------------
  // NOTIFICATIONS
  // --------------------------------------------------

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };


  // --------------------------------------------------
  // LOGIN, SIGNUP AND ACTIVITY TRACKING
  // --------------------------------------------------

  const recordUserActivity = async (
    userId: string,
    eventType: "login" | "logout"
  ): Promise<void> => {
    const { error: activityError } = await supabase
      .from("user_activity")
      .insert({
        user_id: userId,
        event_type: eventType,
      });

    if (activityError) {
      console.error(
        `Could not record ${eventType} activity:`,
        activityError.message
      );
    }
  };

  const handleAuth = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    setBusy(true);
    setError("");
    setNotice("");

    const data = new FormData(event.currentTarget);

    const fullName = String(
      data.get("fullName") ?? ""
    ).trim();

    const email = String(
      data.get("email") ?? ""
    ).trim();

    const password = String(
      data.get("password") ?? ""
    );

    const confirmPassword = String(
      data.get("confirmPassword") ?? ""
    );

    try {
      // LOGIN
      if (authMode === "login") {
        if (!email || !password) {
          setError("Please enter your email and password.");
          return;
        }

        const {
          data: loginData,
          error: loginError,
        } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginError) {
          setError(loginError.message);
          return;
        }

        if (loginData.user) {
          await recordUserActivity(
            loginData.user.id,
            "login"
          );
        }

        notify("Signed in successfully.");
        return;
      }

      // SIGNUP VALIDATION
      if (!fullName) {
        setError("Please enter your full name.");
        return;
      }

      if (!email) {
        setError("Please enter your email address.");
        return;
      }

      if (password.length < 6) {
        setError(
          "Password must contain at least 6 characters."
        );
        return;
      }

      if (password !== confirmPassword) {
        setError(
          "Passwords do not match. Please try again."
        );
        return;
      }

    // CREATE ACCOUNT
const {
  data: signupData,
  error: signupError,
} = await supabase.auth.signUp({
  email: email.trim(),
  password,
  options: {
    data: {
      full_name: fullName.trim(),
      name: fullName.trim(),
    },
  },
});

if (signupError) {
  setError(signupError.message);
  return;
}

// SAVE PROFILE DETAILS
if (signupData.user) {
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: signupData.user.id,
        full_name: fullName.trim(),
        email: email.trim(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "id",
      }
    );

  if (profileError) {
    console.error(
      "Profile save error:",
      profileError.message
    );

    setError(
      "Your account was created, but profile details could not be saved. " +
      profileError.message
    );
    return;
  }
}

      // EMAIL VERIFICATION REQUIRED
      if (!signupData.session) {
        setAuthMode("login");

        setNotice(
          "Account created successfully! Check your email and click the confirmation link. Then sign in to access your dashboard."
        );

        return;
      }

      notify("Your account has been created successfully.");
    } catch (authError) {
      console.error("Authentication error:", authError);

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  // SIGN OUT
  const signOut = async (): Promise<void> => {
    setError("");

    try {
      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        setError(userError.message);
        return;
      }

      // Attempt to record logout before ending the session.
      if (currentUser) {
        await recordUserActivity(
          currentUser.id,
          "logout"
        );
      }

      const { error: signOutError } =
        await supabase.auth.signOut();

      if (signOutError) {
        setError(signOutError.message);
        return;
      }

      setTransactions([]);
      setPage("Dashboard");
      setModalOpen(false);
      setEditingTransaction(null);

      notify("Signed out successfully.");
    } catch (signOutError) {
      console.error("Sign-out error:", signOutError);

      setError(
        "Could not sign out. Please try again."
      );
    }
  };


  // --------------------------------------------------
  // ADD TRANSACTION MODAL
  // --------------------------------------------------

  const openAddModal = (
    type: "income" | "expense" = "expense"
  ) => {
    setEditingTransaction(null);
    setError("");

    setForm({
      transaction_type: type,
      title: "",
      category: type === "income" ? "Salary" : "Food",
      amount: "",
      transaction_date: today(),
      payment_method: "UPI",
      notes: "",
    });

    setModalOpen(true);
  };
  
const openEditModal = (transaction: Transaction) => {
  setError("");
  setEditingTransaction(transaction);

  setForm({
    transaction_type: transaction.transaction_type,
    title: transaction.title,
    category: transaction.category,
    amount: String(transaction.amount),
    transaction_date: transaction.transaction_date,
    payment_method: transaction.payment_method ?? "UPI",
    notes: transaction.notes ?? "",
  });

  setModalOpen(true);
};


  // --------------------------------------------------
  // SAVE TRANSACTION
  // --------------------------------------------------

  const saveTransaction = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!user) {
      setError("Please sign in before adding a transaction.");
      return;
    }

    const title = form.title.trim();
    const amount = Number(form.amount);

    if (!title) {
      setError("Enter a transaction title.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    if (!form.transaction_date) {
      setError("Select a transaction date.");
      return;
    }

    setBusy(true);
    setError("");

    try {
    

const transactionData = {
  transaction_type: form.transaction_type,
  title,
  category: form.category,
  amount,
  transaction_date: form.transaction_date,
  payment_method: form.payment_method,
  notes: form.notes.trim() || null,
};


const { error: saveError } = editingTransaction
  ? await supabase
      .from("transactions")
      .update(transactionData)
      .eq("id", editingTransaction.id)
      .eq("user_id", user.id)
  : await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        ...transactionData,
      });

if (saveError) {
  setError(saveError.message);
  return;
}


setModalOpen(false);
setEditingTransaction(null);

      notify(
        `${
          form.transaction_type === "income"
            ? "Income"
            : "Expense"
        } added successfully.`
      );

      await loadTransactions();
    } catch {
      setError("Could not save the transaction. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // --------------------------------------------------
  // DELETE TRANSACTION
  // --------------------------------------------------

  const deleteTransaction = async (
    transaction: Transaction
  ) => {
    if (!user) return;

    const confirmed = window.confirm(
      `Delete "${transaction.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setError("");

    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transaction.id)
      .eq("user_id", user.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    notify("Transaction deleted.");
    await loadTransactions();
  };

  // --------------------------------------------------
  // EXPORT FILTERED TRANSACTIONS TO CSV
  // --------------------------------------------------

  const exportCsv = () => {
    if (filteredTransactions.length === 0) {
      notify("There are no transactions to export.");
      return;
    }

    const columns = [
      "transaction_date",
      "transaction_type",
      "title",
      "category",
      "amount",
      "payment_method",
      "notes",
    ];

    const quote = (value: unknown) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const rows = [
      columns.join(","),
      ...filteredTransactions.map((transaction) =>
        [
          transaction.transaction_date,
          transaction.transaction_type,
          transaction.title,
          transaction.category,
          transaction.amount,
          transaction.payment_method,
          transaction.notes,
        ]
          .map(quote)
          .join(",")
      ),
    ];

    const blob = new Blob(["\uFEFF" + rows.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `maverick-finance-${today()}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
    notify("CSV export downloaded.");
  };

  // --------------------------------------------------
  // AUTH LOADING SCREEN
  // --------------------------------------------------

  if (!authReady) {
    return (
     <div className="app-loading">
  <div className="loading-brand">
    <div className="loading-brand-name">
      <span className="loading-brand-highlight">The Fav' Maverick</span>
    </div>

    <div className="loading-brand-subtitle">
      FINANCE &amp; EXPENSE ANALYTICS
    </div>

    <div className="loading-line" />
    <div className="loading-status">...LOADING...</div>
  </div>
</div>
    );
  }

  // --------------------------------------------------
  // LOGIN / SIGNUP SCREEN
  // --------------------------------------------------


if (!session || !user) {
  return (
    <main
      className={`auth-screen theme-${theme}`}
      style={{ "--accent": accent } as CSSProperties}
    >
      <section className="auth-card">
        {/* Brand */}
        <div className="auth-card-brand">
          <img
            src="/logo.png"
            alt="The Fav' Maverick Finance & Expense Analytics logo"
          />

          <div>
            <strong>
              The Fav' Maverick
              <small>
                <span>FINANCE & EXPENSE ANALYTICS</span>
              </small>
            </strong>
          </div>
        </div>

        <p className="eyebrow">YOUR MONEY. YOUR CLARITY.</p>

        <h1>
          {authMode === "login"
            ? "Welcome back."
            : "Start your journey."}
        </h1>

        <p className="muted">
          Track Money. Understand Spending. Make Smarter Decisions.
        </p>

        {/* Login / Signup form */}
        <form onSubmit={handleAuth}>
          {/* Full name — signup only */}
          {authMode === "signup" && (
            <label>
              Full name
              <input
                name="fullName"
                type="text"
                placeholder="Enter your full name"
                autoComplete="name"
                maxLength={100}
                required
              />
            </label>
          )}

          {/* Email */}
          <label>
            Email address
            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          {/* Password */}
          <label className="password-field">
            Password

            <div className="password-input-wrap">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                minLength={6}
                required
                autoComplete={
                  authMode === "login"
                    ? "current-password"
                    : "new-password"
                }
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword((prev) => !prev)
                }
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
                title={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </label>

          {/* Confirm password — signup only */}
          {authMode === "signup" && (
            <label className="password-field">
              Confirm password

              <input
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                minLength={6}
                required
                autoComplete="new-password"
              />
            </label>
          )}

          {/* Error and success messages */}
          {error && (
            <p className="inline-error">{error}</p>
          )}

          {notice && (
            <p className="inline-notice">{notice}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="primary-btn full-btn"
            disabled={busy}
          >
            {busy
              ? "Please wait…"
              : authMode === "login"
                ? "Sign in →"
                : "Create account →"}
          </button>
        </form>

        {/* Switch between login and signup */}
        <p className="auth-switch">
          {authMode === "login"
            ? "New to The Fav' Maverick Finance?"
            : "Already have an account?"}

          <button
            type="button"
            onClick={() => {
              setAuthMode(
                authMode === "login" ? "signup" : "login"
              );
              setError("");
              setNotice("");
              setShowPassword(false);
            }}
          >
            {authMode === "login"
              ? " Create account"
              : " Sign in"}
          </button>
        </p>
      </section>

      <p className="auth-footer">
        PRIVATE BY DESIGN · YOUR FINANCIAL DATA
      </p>
    </main>
  );
}


  // --------------------------------------------------
  // MAIN APPLICATION
  // --------------------------------------------------

  return (
    <div
      className={`app-shell theme-${theme}`}
      style={{ "--accent": accent } as CSSProperties}
    >
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <img
            src="/logo.png"
            alt="The Fav' Maverick | Finance & Expense Analytics logo"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />

          <div>
            <strong>The Fav' Maverick</strong>
            <span> Finance & Expense Analytics</span>
          </div>
        </div>

        <div className="side-label">WORKSPACE</div>

        <nav className="side-nav">
          {navigation.map((item) => (
            <button
              key={item.name}
              className={
                page === item.name
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() => setPage(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.name}</span>
              {page === item.name && <i />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="secure-note">
            <span>●</span>
            <div>
              <b>Your space is private</b>
              <small>Your account, your data.</small>
            </div>
          </div>
  <h6>        
<div className="free-plan-notice">
<strong>Free to use</strong>
  <p>
    <h6>The Fav' Maverick Finance &amp; Expense Analytics is free to use.
    No subscription or payment is required.</h6>
  </p>
</div></h6>


          <button
            className="profile-row"
            onClick={() => setPage("Settings")}
          >
            <span className="avatar">
              {(user.email?.[0] ?? "M").toUpperCase()}
            </span>

          <span className="profile-text">
  <b>{profileName || "My account"}</b>
  <small>Personal account</small>
</span>

            <span>⚙</span>
          </button>

          <button
            className="signout-btn"
            onClick={() => void signOut()}
          >
            ↪ Sign out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">
            The Fav' Maverick | Finance & Expense Analytics
            </p>

            <h1>
              {page === "Dashboard"
                ? "Your financial overview"
                : page}
            </h1>
          </div>

          <div className="top-actions">
            <span className="date-chip">
              ◷{" "}
              {now.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>

            <button
              className="icon-btn"
              title="Print or save as PDF"
              aria-label="Print or save as PDF"
              onClick={() => window.print()}
            >
              ⤓
            </button>

            <button
              className="primary-btn"
              onClick={() => openAddModal("expense")}
            >
              ＋ Add transaction
            </button>
          </div>
        </header>

        {error && (
          <div className="alert-error" role="alert">
            <span>⚠</span>
            <span>{error}</span>
            <button
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              ×
            </button>
          </div>
        )}

        {notice && (
          <div className="toast" role="status">
            <span>✓</span>
            {notice}
          </div>
        )}

      
{/* DASHBOARD */}
{page === "Dashboard" && (
  <>
    <section className="welcome-row">
      <div className="welcome-content">
        <p className="eyebrow">
          YOUR MONEY. YOUR STRATEGY. YOUR FUTURE.
        </p>

        <h2>
          Financial <span>Command Center</span>
          <span className="welcome-spark"> ✦</span>
        </h2>

       <p className="welcome-description">
  Welcome back,{" "}
  <strong>{profileName || "Maverick"}</strong>.
  Track your cash flow, understand your spending
  patterns, and turn your financial data into smarter
  decisions.
</p>

        <div className="welcome-highlights">
          <span>✦ Income & Expense Tracking</span>
          <span>↗ Financial Insights</span>
          <span>◈ Smarter Money Management</span>
        </div>
      </div>

      {/* Keep your existing quick-action buttons here */}


              <div className="quick-actions">
                <button
                  className="income-action"
                  onClick={() => openAddModal("income")}
                >
                  ↙ Add income
                </button>

                <button
                  className="expense-action"
                  onClick={() => openAddModal("expense")}
                >
                  ↗ Add expense
                </button>
              </div>
            </section>

            <section className="metric-grid">
              <article className="metric-card balance-card">
                <div className="metric-top">
                  <span>NET BALANCE</span>
                  <span className="metric-icon">◈</span>
                </div>
                <strong>{money(totals.balance, currency)}</strong>
                <p className="metric-caption">
                  Based on selected transactions
                </p>
                <div className="metric-foot">
                  <span>↗</span> Income minus expenses
                </div>
              </article>

              <article className="metric-card">
                <div className="metric-top">
                  <span>TOTAL INCOME</span>
                  <span className="metric-icon green-icon">↙</span>
                </div>
                <strong className="green-text">
                  {money(totals.income, currency)}
                </strong>
                <p className="metric-caption">Money received</p>
                <div className="metric-foot green-text">
                  ● All income sources
                </div>
              </article>

              <article className="metric-card">
                <div className="metric-top">
                  <span>TOTAL EXPENSES</span>
                  <span className="metric-icon red-icon">↗</span>
                </div>
                <strong className="red-text">
                  {money(totals.expense, currency)}
                </strong>
                <p className="metric-caption">Money spent</p>
                <div className="metric-foot red-text">
                  ● Outgoing money
                </div>
              </article>

              <article className="metric-card">
                <div className="metric-top">
                  <span>SAVINGS RATE</span>
                  <span className="metric-icon">◉</span>
                </div>
                <strong>
                  {totals.income > 0
                    ? `${Math.round(
                        (totals.balance / totals.income) * 100
                      )}%`
                    : "—"}
                </strong>
                <p className="metric-caption">
                  Net balance ÷ income
                </p>
                <div className="metric-foot">
                  {totals.income > 0
                    ? "For selected period"
                    : "Add income to calculate"}
                </div>
              </article>
            </section>

            <section className="filter-bar">
              <div>
                <span className="filter-spark">✦</span>
                <b>Financial insights</b>
              </div>

              <div className="filter-controls">
                <label className="sr-only" htmlFor="period-filter">
                  Date period
                </label>

                <select
                  id="period-filter"
                  value={dateFilter}
                  onChange={(event) =>
                    setDateFilter(event.target.value)
                  }
                >
                  <option value="month">This month</option>
                  <option value="30days">Last 30 days</option>
                  <option value="year">This year</option>
                  <option value="all">All time</option>
                </select>

                <button className="outline-btn" onClick={exportCsv}>
                  ⇩ Export CSV
                </button>
              </div>
            </section>

         
<section className="chart-grid">
  <article className="panel trend-panel">
    <div className="panel-heading">
      <div>
        <h3>Income vs Expenses</h3>
        <p>Six-month cash flow overview</p>
      </div>

      <span className="chart-key">
        <i className="key-income" /> Income{" "}
        <i className="key-expense" /> Expenses
      </span>
    </div>

    {transactions.length === 0 ? (
      <EmptyState text="Your monthly chart will appear when you add transactions." />
    ) : (
      <>
        {/* SELECTED BAR DETAILS — ABOVE THE CHART */}
        <div className="trend-detail-panel">
          {selectedTrend ? (
            <>
              <div className="trend-detail-heading">
                <div>
                  <span className="trend-detail-eyebrow">
                    SELECTED CHART DETAIL
                  </span>
                  <h4>{selectedTrend.month.label}</h4>
                </div>

                <button
                  type="button"
                  className="trend-detail-close"
                  onClick={() => setSelectedTrend(null)}
                  aria-label="Close chart details"
                >
                  ×
                </button>
              </div>

              <div className="trend-detail-values">
                <button
                  type="button"
                  className={`trend-detail-item income-detail ${
                    selectedTrend.type === "income" ? "is-selected" : ""
                  }`}
                  onClick={() =>
                    setSelectedTrend({
                      month: selectedTrend.month,
                      type: "income",
                    })
                  }
                >
                  <span>Income</span>
                  <strong>
                    {money(selectedTrend.month.income, currency)}
                  </strong>
                </button>

                <button
                  type="button"
                  className={`trend-detail-item expense-detail ${
                    selectedTrend.type === "expense" ? "is-selected" : ""
                  }`}
                  onClick={() =>
                    setSelectedTrend({
                      month: selectedTrend.month,
                      type: "expense",
                    })
                  }
                >
                  <span>Expenses</span>
                  <strong>
                    {money(selectedTrend.month.expense, currency)}
                  </strong>
                </button>
              </div>

              <p className="trend-detail-hint">
                {selectedTrend.type === "income"
                  ? "Showing income for this month."
                  : "Showing expenses for this month."}
              </p>
            </>
          ) : (
            <div className="trend-detail-empty">
              <strong>Explore your cash flow</strong>
              <span>
                Select any income or expense bar below to view its value.
              </span>
            </div>
          )}
        </div>

        {/* CLEAN INTERACTIVE CHART */}
        <div className="trend-chart">
          {monthlyTrend.map((month) => (
            <div className="trend-column" key={month.key}>
              <div className="bar-pair">
                <button
                  type="button"
                  className="bar-wrap trend-bar-button"
                  title={`View ${month.label} income: ${money(
                    month.income,
                    currency
                  )}`}
                  aria-label={`${month.label} income: ${money(
                    month.income,
                    currency
                  )}`}
                  onClick={() =>
                    setSelectedTrend({ month, type: "income" })
                  }
                >
                  <div className="trend-bar-track">
                    <div
                      className={`trend-bar income-bar ${
                        selectedTrend?.month.key === month.key &&
                        selectedTrend?.type === "income"
                          ? "is-active"
                          : ""
                      }`}
                      style={{
                        height: `${
                          month.income > 0 && maxTrend > 0
                            ? Math.max(4, (month.income / maxTrend) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </button>

                <button
                  type="button"
                  className="bar-wrap trend-bar-button"
                  title={`View ${month.label} expenses: ${money(
                    month.expense,
                    currency
                  )}`}
                  aria-label={`${month.label} expenses: ${money(
                    month.expense,
                    currency
                  )}`}
                  onClick={() =>
                    setSelectedTrend({ month, type: "expense" })
                  }
                >
                  <div className="trend-bar-track">
                    <div
                      className={`trend-bar expense-bar ${
                        selectedTrend?.month.key === month.key &&
                        selectedTrend?.type === "expense"
                          ? "is-active"
                          : ""
                      }`}
                      style={{
                        height: `${
                          month.expense > 0 && maxTrend > 0
                            ? Math.max(4, (month.expense / maxTrend) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </button>
              </div>

              <span className="trend-month-label">{month.label}</span>
            </div>
          ))}
        </div>
      </>
    )}
  </article>

              <article className="panel category-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Spending breakdown</h3>
                    <p>Expenses by category</p>
                  </div>
                  <span className="panel-icon">◔</span>
                </div>

                {expenseCategories.length === 0 ? (
                  <EmptyState text="Your category analysis will appear here." />
                ) : (
                  <div className="category-list">
                    {expenseCategories.map(
                      ([name, amount], index) => {
                        const total = expenseCategories.reduce(
                          (sum, row) => sum + row[1],
                          0
                        );

                        const colors = [
                          "#e80707",
                          "#7ced03",
                          "#bf06b9",
                          "#9c8cff",
                          "#f7bc60",
                          "#65bfff",
                        ];

                        const percentage = total
                          ? (amount / total) * 100
                          : 0;

                        return (
                          <div
                            className="category-row"
                            key={name}
                          >
                            <div className="category-info">
                              <span
                                className="category-dot"
                                style={{
                                  background: colors[index],
                                }}
                              />
                              <b>{name}</b>
                              <span>
                                {Math.round(percentage)}%
                              </span>
                            </div>

                            <div className="category-track">
                              <div
                                style={{
                                  width: `${percentage}%`,
                                  background: colors[index],
                                }}
                              />
                            </div>

                            <div className="category-amount">
                              {money(amount, currency)}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </article>
            </section>

            <section className="panel transactions-panel">
              <div className="panel-heading">
                <div>
                  <h3>Recent transactions</h3>
                  <p>Your latest financial activity</p>
                </div>

                <button
                  className="text-btn"
                  onClick={() => setPage("Transactions")}
                >
                  View all →
                </button>
              </div>

              <TransactionTable
               rows={filteredTransactions}
                currency={currency}
                onDelete={deleteTransaction}
                onEdit={openEditModal}
              />
            </section>
          </>
        )}

        {/* TRANSACTIONS */}
        {page === "Transactions" && (
          <section className="panel full-panel">
            <div className="panel-heading">
              <div>
                <h3>All transactions</h3>
                <p>Search, filter, and export your records.</p>
              </div>

              <button
                className="primary-btn"
                onClick={() => openAddModal()}
              >
                ＋ Add new
              </button>
            </div>

            <div className="table-filters">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="⌕ Search title or category…"
                aria-label="Search transactions"
              />

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value)
                }
                aria-label="Filter by transaction type"
              >
                <option value="all">All types</option>
                <option value="income">Income</option>
                <option value="expense">Expenses</option>
              </select>

              <select
                value={dateFilter}
                onChange={(event) =>
                  setDateFilter(event.target.value)
                }
                aria-label="Filter by date"
              >
                <option value="month">This month</option>
                <option value="30days">Last 30 days</option>
                <option value="year">This year</option>
                <option value="all">All time</option>
              </select>

              <button className="outline-btn" onClick={exportCsv}>
                ⇩ CSV
              </button>
            </div>

          <TransactionTable
 rows={filteredTransactions}
  currency={currency}
  onDelete={deleteTransaction}
  onEdit={openEditModal}
/>

            <p className="table-count">
              Showing {filteredTransactions.length} transaction(s)
              {" "}· Loaded up to 5,000 most recent records.
            </p>
          </section>
        )}

        {/* ANALYTICS */}
       
    {page === "Analytics" && (
      <AnalysisCharts
    transactions={transactions}
    currency={currency}
       />
    )}


        {/* REPORTS */}
        {page === "Reports" && (
          <section className="panel full-panel">
            <div className="panel-heading">
              <div>
                <h3>Financial reports</h3>
                <p>
                  Export your personal records for further analysis.
                </p>
              </div>
            </div>

            <div className="report-grid">
              <div className="report-card">
                <span>▤</span>
                <h3>Transaction report</h3>
                <p>
                  Download your currently filtered transactions
                  as a CSV file for Excel or Power BI.
                </p>
                <button
                  className="primary-btn"
                  onClick={exportCsv}
                >
                  Download CSV ⇩
                </button>
              </div>

             
<div className="report-card">
  <span aria-hidden="true">▧</span>
  <h3>Full Current period summary</h3>
  <p>
    Export your Current period summary
  </p>
  <button
    type="button"
    className="primary-btn"
    onClick={() => window.print()}
  >
    ↓ Current period summary
  </button>
</div>

            </div>

            <div className="report-summary">
              <h3>Current period summary</h3>

              <div>
                <span>Income</span>
                <b className="green-text">
                  {money(totals.income, currency)}
                </b>
              </div>

              <div>
                <span>Expenses</span>
                <b className="red-text">
                  {money(totals.expense, currency)}
                </b>
              </div>

              <div>
                <span>Net balance</span>
                <b>{money(totals.balance, currency)}</b>
              </div>

              <div>
                <span>Transactions</span>
                <b>{filteredTransactions.length}</b>
              </div>
            </div>
          </section>
        )}

        {/* SETTINGS */}
        {page === "Settings" && (
          <section className="panel full-panel settings-panel">
            <AdminUsers userId={user.id} />

            <div className="panel-heading">
              <div>
                <h3>Personalize your workspace</h3>
                <p>Make The Fav' Maverick | Finance & Expense Analytics feel like yours.</p>
              </div>
            </div>

            <div className="settings-group">
              <div>
                <h4>💱 Display currency</h4>
                <p>
                  Choose the currency used to display your amounts.
                </p>
              </div>

              <select
                value={currency}
                onChange={(event) =>
                  setCurrency(event.target.value as Currency)
                }
              >
                <option value="INR">₹ Indian Rupee (INR)</option>
                <option value="USD">$ US Dollar (USD)</option>
                <option value="EUR">€ Euro (EUR)</option>
                <option value="GBP">£ British Pound (GBP)</option>
                <option value="AED">د.إ UAE Dirham (AED)</option>
                <option value="JPY">¥ Japanese Yen (JPY)</option>
              </select>
            </div>

            <div className="settings-group">
              <div>
                <h4>🎨 Appearance</h4>
                <p>Switch between dark and light mode.</p>
              </div>

              <select
                value={theme}
                onChange={(event) =>
                  setTheme(
                    event.target.value as "dark" | "light"
                  )
                }
              >
                <option value="dark">Dark luxury</option>
                <option value="light">Light clean</option>
              </select>
            </div>

            <div className="settings-group">
              <div>
                <h4>✨ Accent color</h4>
                <p>Change the dashboard highlight color.</p>
              </div>

              <div className="swatches">
                {[
                  ["Neon lime", "#c7f548"],
                  ["Electric blue", "#61a8ff"],
                  ["Violet", "#a78bfa"],
                  ["Coral", "#ff8a72"],
                ].map(([name, value]) => (
                  <button
                    key={value}
                    type="button"
                    title={name}
                    aria-label={name}
                    className={
                      accent === value
                        ? "swatch selected"
                        : "swatch"
                    }
                    style={{ background: value }}
                    onClick={() => setAccent(value)}
                  />
                ))}
              </div>
            </div>

            <div className="settings-group">
              <div>
                <h4>📁 Data export</h4>
                <p>
                  Download records matching your current filters.
                </p>
              </div>

              <button
                className="outline-btn"
                onClick={exportCsv}
              >
                Export CSV ⇩
              </button>
            </div>
            
            <div className="settings-group">
              <div>
                <h4>🔐 Account</h4>
                <p>{user.email}</p>
              </div>

              <button
                className="outline-btn"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </div>

            <p className="settings-note">
              Currency and appearance settings currently reset
              when the app session is refreshed. Currency changes
              the display format only; it does not convert stored
              transaction amounts.
            </p>
          </section>
        )}

        <footer className="app-footer">
          <span>© {now.getFullYear()} The Fav' Maverick | Finance & Expense Analytics</span>
          <span>MADE FOR BETTER MONEY DECISIONS ✦</span>
        </footer>
      </main>

      {/* MOBILE NAVIGATION */}
      <nav className="mobile-nav">
        {navigation.map((item) => (
          <button
            key={item.name}
            className={
              page === item.name ? "mobile-nav-active" : ""
            }
            onClick={() => setPage(item.name)}
          >
            <span>{item.icon}</span>
            <small>{item.name}</small>
          </button>
        ))}
      </nav>

      {/* ADD TRANSACTION MODAL */}
      {modalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setModalOpen(false);
              setError("");
            }
          }}
        >
          <section
            className="transaction-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-modal-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">MONEY MOVEMENT</p>
              <h2 id="transaction-modal-title">
  {editingTransaction ? "Edit transaction" : "Add transaction"}
</h2>
                <p className="muted">
                  Record a new income or expense.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                disabled={busy}
                onClick={() => {
                  setModalOpen(false);
                  setError("");
                }}
              >
                ×
              </button>
            </div>

            <div className="type-switch">
              <button
                type="button"
                className={
                  form.transaction_type === "income"
                    ? "type-income selected"
                    : "type-income"
                }
                onClick={() => {
                  setError("");
                  setForm((previous) => ({
                    ...previous,
                    transaction_type: "income",
                    category: "Salary",
                  }));
                }}
              >
                ↙ Income
              </button>

              <button
                type="button"
                className={
                  form.transaction_type === "expense"
                    ? "type-expense selected"
                    : "type-expense"
                }
                onClick={() => {
                  setError("");
                  setForm((previous) => ({
                    ...previous,
                    transaction_type: "expense",
                    category: "Food",
                  }));
                }}
              >
                ↗ Expense
              </button>
            </div>

            <form onSubmit={saveTransaction}>
              <label>
                Transaction title
                <input
                  autoFocus
                  value={form.title}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      title: event.target.value,
                    })
                  }
                  placeholder={
                    form.transaction_type === "income"
                      ? "e.g. Monthly salary"
                      : "e.g. Grocery shopping"
                  }
                  required
                  maxLength={100}
                />
              </label>
              <form onSubmit={saveProfile} className="settings-section">
  <h2>Personal Profile</h2>
  <p>Manage your personal and financial profile information.</p>

  <label>Full name</label>
  <input
    value={profileName}
    onChange={(e) => setProfileName(e.target.value)}
    placeholder="Enter your full name"
  />

  <label>Phone</label>
  <input
    value={profilePhone}
    onChange={(e) => setProfilePhone(e.target.value)}
    placeholder="Enter your phone number"
  />

  <label>Bio</label>
  <textarea
    value={profileBio}
    onChange={(e) => setProfileBio(e.target.value)}
    placeholder="Tell us about yourself"
  />

  <label>City</label>
  <input
    value={profileCity}
    onChange={(e) => setProfileCity(e.target.value)}
    placeholder="Enter your city"
  />

  <label>Country</label>
  <input
    value={profileCountry}
    onChange={(e) => setProfileCountry(e.target.value)}
    placeholder="Enter your country"
  />

  <label>Monthly income (₹)</label>
  <input
    type="number"
    min="0"
    step="0.01"
    value={monthlyIncome}
    onChange={(e) => setMonthlyIncome(e.target.value)}
    placeholder="0.00"
  />

  <label>Monthly savings target (₹)</label>
  <input
    type="number"
    min="0"
    step="0.01"
    value={monthlySavingsTarget}
    onChange={(e) => setMonthlySavingsTarget(e.target.value)}
    placeholder="0.00"
  />

  <button type="submit" disabled={profileSaving}>
    {profileSaving ? "Saving..." : "Save Profile"}
  </button>

  {profileMessage && <p role="status">{profileMessage}</p>}
</form>

              <div className="form-two">
                <label>
                  Amount ({currencySymbols[currency]})
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        amount: event.target.value,
                      })
                    }
                    placeholder="0.00"
                    required
                  />
                </label>

                <label>
                  Category
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        category: event.target.value,
                      })
                    }
                  >
                    {categories[form.transaction_type].map(
                      (category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>

              <div className="form-two">
               
<label>
  Date
  <input
    type="date"
    value={form.transaction_date}
    onChange={(event) =>
      setForm((previous) => ({
        ...previous,
        transaction_date: event.target.value,
      }))
    }
    required
  />
</label>


                <label>
                  Payment method
                  <select
                    value={form.payment_method}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        payment_method: event.target.value,
                      })
                    }
                  >
                    {[
                      "UPI",
                      "Cash",
                      "Debit Card",
                      "Credit Card",
                      "Bank Transfer",
                      "Other",
                    ].map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Notes (optional)
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      notes: event.target.value,
                    })
                  }
                  placeholder="Add a short note…"
                  maxLength={500}
                />
              </label>

              {error && (
                <p className="inline-error">{error}</p>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="outline-btn"
                  disabled={busy}
                  onClick={() => {
                    setModalOpen(false);
                    setError("");
                  }}
                >
                  Cancel
                </button>

                <button
  type="submit"
  className="primary-btn"
  disabled={busy}
>
  {busy
    ? "Saving…"
    : editingTransaction
      ? "Save changes ✓"
      : "Save transaction ✓"}
</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------
// EMPTY STATE
// --------------------------------------------------

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <span>◌</span>
      <p>{text}</p>
    </div>
  );
}

// --------------------------------------------------
// TRANSACTION TABLE
// --------------------------------------------------

function TransactionTable({
  rows,
  currency,
  onDelete,
  onEdit,
}: {
  rows: Transaction[];
  currency: Currency;
  onDelete: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        text="No transactions found. Add your first income or expense to get started."
      />
    );
  }

  return (
    <div className="table-scroll">
      <table className="transaction-table">
        <thead>
          <tr>
            <th>TRANSACTION</th>
            <th>CATEGORY</th>
            <th>DATE</th>
            <th>METHOD</th>
            <th>AMOUNT</th>
            <th className="no-print">ACTION</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((transaction) => (
            <tr key={transaction.id}>
              <td>
                <div className="transaction-title">
                  <span
                    className={
                      transaction.transaction_type === "income"
                        ? "transaction-icon income-bg"
                        : "transaction-icon expense-bg"
                    }
                  >
                    {transaction.transaction_type === "income"
                      ? "↙"
                      : "↗"}
                  </span>

                  <div>
                    <b>{transaction.title}</b>
                    <small>
                      {transaction.notes ||
                        (transaction.transaction_type === "income"
                          ? "Income received"
                          : "Expense recorded")}
                    </small>
                  </div>
                </div>
              </td>

              <td>
                <span className="category-pill">
                  {transaction.category}
                </span>
              </td>

              <td>{transaction.transaction_date}</td>
              <td>{transaction.payment_method || "—"}</td>

              <td
                className={
                  transaction.transaction_type === "income"
                    ? "green-text amount-cell"
                    : "red-text amount-cell"
                }
              >
                {transaction.transaction_type === "income"
                  ? "+"
                  : "−"}
                {money(Number(transaction.amount), currency)}
              </td>

              <td className="no-print">
                
<button
  type="button"
  className="edit-btn"
  title="Edit transaction"
  aria-label={`Edit ${transaction.title}`}
  onClick={() => onEdit(transaction)}
>
  ✎
</button>

               <button
  type="button"
  className="delete-btn"
  title="Delete transaction"
  aria-label={`Delete ${transaction.title}`}
  onClick={() => onDelete(transaction)}
>
  🗑
</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
