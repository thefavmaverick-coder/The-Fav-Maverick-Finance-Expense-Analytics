
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import "./BudgetGoals.css";

type Budget = {
  id: string;
  category: string;
  limit_amount: number;
  month_start: string;
};

type Goal = {
  id: string;
  title: string;
  target_amount: number;
  saved_amount: number;
  target_date: string | null;
};

type Props = {
  userId: string;
};

const categories = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Health",
  "Education",
  "Entertainment",
  "Other",
];

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

export default function BudgetGoals({ userId }: Props) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [spent, setSpent] = useState<Record<string, number>>({});
  const [category, setCategory] = useState("Food");
  const [limit, setLimit] = useState("");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("0");
  const [targetDate, setTargetDate] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setMessage("");

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-01`;

    const nextMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1
    );
    const nextMonthStart = `${nextMonth.getFullYear()}-${String(
      nextMonth.getMonth() + 1
    ).padStart(2, "0")}-01`;

    const [budgetResult, goalResult, transactionResult] =
      await Promise.all([
        supabase
          .from("budgets")
          .select("id, category, limit_amount, month_start")
          .eq("user_id", userId)
          .eq("month_start", monthStart),

        supabase
          .from("savings_goals")
          .select("id, title, target_amount, saved_amount, target_date")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),

        supabase
          .from("transactions")
          .select("category, amount")
          .eq("user_id", userId)
          .eq("transaction_type", "expense")
          .gte("transaction_date", monthStart)
          .lt("transaction_date", nextMonthStart),
      ]);

    if (budgetResult.error || goalResult.error || transactionResult.error) {
      setMessage(
        budgetResult.error?.message ||
          goalResult.error?.message ||
          transactionResult.error?.message ||
          "Unable to load data."
      );
    } else {
      setBudgets((budgetResult.data || []) as Budget[]);
      setGoals((goalResult.data || []) as Goal[]);

      const totals: Record<string, number> = {};
      (transactionResult.data || []).forEach((row) => {
        totals[row.category] =
          (totals[row.category] || 0) + Number(row.amount || 0);
      });
      setSpent(totals);
    }

    setLoading(false);
  };

useEffect(() => {
  let cancelled = false;

  const fetchData = async () => {
    setLoading(true);
    setMessage("");

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-01`;

    const nextMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1
    );
    const nextMonthStart = `${nextMonth.getFullYear()}-${String(
      nextMonth.getMonth() + 1
    ).padStart(2, "0")}-01`;

    const [budgetResult, goalResult, transactionResult] =
      await Promise.all([
        supabase
          .from("budgets")
          .select("id, category, limit_amount, month_start")
          .eq("user_id", userId)
          .eq("month_start", monthStart),

        supabase
          .from("savings_goals")
          .select("id, title, target_amount, saved_amount, target_date")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),

        supabase
          .from("transactions")
          .select("category, amount")
          .eq("user_id", userId)
          .eq("transaction_type", "expense")
          .gte("transaction_date", monthStart)
          .lt("transaction_date", nextMonthStart),
      ]);

    if (cancelled) return;

    if (budgetResult.error || goalResult.error || transactionResult.error) {
      setMessage(
        budgetResult.error?.message ||
          goalResult.error?.message ||
          transactionResult.error?.message ||
          "Unable to load data."
      );
    } else {
      setBudgets((budgetResult.data || []) as Budget[]);
      setGoals((goalResult.data || []) as Goal[]);

      const totals: Record<string, number> = {};

      (transactionResult.data || []).forEach((row) => {
        totals[row.category] =
          (totals[row.category] || 0) + Number(row.amount || 0);
      });

      setSpent(totals);
    }

    setLoading(false);
  };

  void fetchData();

  return () => {
    cancelled = true;
  };
}, [userId]);
  const addBudget = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(limit);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Enter a budget amount greater than zero.");
      return;
    }

    setSaving(true);
    setMessage("");

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-01`;

    const { error } = await supabase.from("budgets").upsert(
      {
        user_id: userId,
        category,
        limit_amount: amount,
        month_start: monthStart,
      },
      { onConflict: "user_id,month_start,category" }
    );

    if (error) {
      setMessage(error.message);
    } else {
      setLimit("");
      setMessage("Budget saved successfully.");
      await loadData();
    }

    setSaving(false);
  };

  const addGoal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetAmount = Number(target);
    const savedAmount = Number(saved);

    if (
      !title.trim() ||
      !Number.isFinite(targetAmount) ||
      targetAmount <= 0 ||
      !Number.isFinite(savedAmount) ||
      savedAmount < 0 ||
      savedAmount > targetAmount
    ) {
      setMessage("Check the goal title and amounts. Saved amount cannot exceed the target.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("savings_goals").insert({
      user_id: userId,
      title: title.trim(),
      target_amount: targetAmount,
      saved_amount: savedAmount,
      target_date: targetDate || null,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setTitle("");
      setTarget("");
      setSaved("0");
      setTargetDate("");
      setMessage("Savings goal created.");
      await loadData();
    }

    setSaving(false);
  };

  const updateSaved = async (goal: Goal) => {
    const value = window.prompt(
      `Enter updated savings for "${goal.title}"`,
      String(goal.saved_amount)
    );

    if (value === null) return;

    const amount = Number(value);
    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > Number(goal.target_amount)
    ) {
      setMessage("Enter an amount between zero and the goal target.");
      return;
    }

    const { error } = await supabase
      .from("savings_goals")
      .update({ saved_amount: amount })
      .eq("id", goal.id)
      .eq("user_id", userId);

    if (error) setMessage(error.message);
    else {
      setMessage("Savings progress updated.");
      await loadData();
    }
  };

  return (
    <section className="bg-section">
      <div className="bg-heading">
        <div>
          <span className="bg-eyebrow">PERSONAL FINANCE</span>
          <h2>Budgets & Savings Goals</h2>
          <p>Control monthly spending and track your financial goals.</p>
        </div>
        <button className="bg-refresh" onClick={() => void loadData()}>
          ↻ Refresh
        </button>
      </div>

      {message && <p className="bg-message" role="status">{message}</p>}

      <div className="bg-grid">
        <form className="bg-card" onSubmit={addBudget}>
          <h3>＋ Monthly budget</h3>
          <label>
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Budget limit (₹)
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              placeholder="e.g. 5000"
            />
          </label>
          <button className="bg-primary" disabled={saving}>
            {saving ? "Saving…" : "Save monthly budget"}
          </button>
        </form>

        <form className="bg-card" onSubmit={addGoal}>
          <h3>✦ Create savings goal</h3>
          <label>
            Goal name
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. New laptop"
            />
          </label>
          <div className="bg-form-row">
            <label>
              Target (₹)
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              />
            </label>
            <label>
              Already saved (₹)
              <input
                type="number"
                min="0"
                step="0.01"
                value={saved}
                onChange={(event) => setSaved(event.target.value)}
              />
            </label>
          </div>
          <label>
            Target date (optional)
            <input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          </label>
          <button className="bg-primary" disabled={saving}>
            {saving ? "Saving…" : "Create savings goal"}
          </button>
        </form>
      </div>

      <div className="bg-card bg-results">
        <h3>Monthly budget overview</h3>
        {loading ? <p>Loading your finance data…</p> : budgets.length === 0 ? (
          <p>No budgets yet. Create your first monthly budget above.</p>
        ) : (
          budgets.map((budget) => {
            const spentAmount = spent[budget.category] || 0;
            const limitAmount = Number(budget.limit_amount);
            const percent = limitAmount > 0
              ? Math.min((spentAmount / limitAmount) * 100, 100)
              : 0;
            const exceeded = spentAmount > limitAmount;

            return (
              <div className="bg-progress-item" key={budget.id}>
                <div className="bg-progress-label">
                  <strong>{budget.category}</strong>
                  <span className={exceeded ? "bg-red" : ""}>
                    {money(spentAmount)} / {money(limitAmount)}
                  </span>
                </div>
                <div className="bg-track">
                  <div
                    className={`bg-fill ${exceeded ? "bg-fill-red" : ""}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <small>{exceeded ? "Over budget" : `${Math.round(percent)}% used`}</small>
              </div>
            );
          })
        )}
      </div>

      <div className="bg-card bg-results">
        <h3>My savings goals</h3>
        {!loading && goals.length === 0 ? (
          <p>No savings goals yet. Create one above to get started.</p>
        ) : (
          goals.map((goal) => {
            const targetAmount = Number(goal.target_amount);
            const savedAmount = Number(goal.saved_amount);
            const percent = targetAmount > 0
              ? Math.min((savedAmount / targetAmount) * 100, 100)
              : 0;

            return (
              <div className="bg-goal" key={goal.id}>
                <div className="bg-progress-label">
                  <strong>{goal.title}</strong>
                  <span>{money(savedAmount)} / {money(targetAmount)}</span>
                </div>
                <div className="bg-track">
                  <div
                    className="bg-fill bg-fill-green"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="bg-goal-footer">
                  <small>{Math.round(percent)}% saved{goal.target_date ? ` · Target ${goal.target_date}` : ""}</small>
                  <button type="button" className="bg-refresh" onClick={() => void updateSaved(goal)}>
                    Update savings
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
