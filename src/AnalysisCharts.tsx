
import { useMemo, useState, useRef } from "react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LabelList,
} from "recharts";

import {
  TrendingUp,
  ChartPie,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  RotateCcw,
  PiggyBank,
  Target,
  AlertTriangle,
  BadgeCheck,
} from "lucide-react";

import "./AnalysisCharts.css";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Download } from "lucide-react";

type Transaction = {
  id: string;
  transaction_type: string;
  title: string;
  category: string;
  amount: number | string;
  transaction_date: string;
};

type Props = {
  transactions: Transaction[];
  currency?: string;
};

type Period = "all" | "3" | "6" | "12" | "year";

const INCOME_COLOR = "#45D6A5";
const EXPENSE_COLOR = "#FF4057";
const LIME_COLOR = "#B7FF3C";
const LABEL_COLOR = "#F5F7FA";

const COLORS = [
  "#b7ff3c",
  "#45d6a5",
  "#65a8ff",
  "#ff9f43",
  "#c084fc",
  "#fb7185",
  "#facc15",
  "#22d3ee",
];

const isIncome = (type: string) =>
  type?.toLowerCase() === "income";

const getDate = (dateString: string): Date | null => {
  if (!dateString) return null;

  const parts = dateString.split("-").map(Number);

  if (
    parts.length !== 3 ||
    !parts.every(Number.isFinite) ||
    parts[0] < 1000 ||
    parts[1] < 1 ||
    parts[1] > 12 ||
    parts[2] < 1 ||
    parts[2] > 31
  ) {
    return null;
  }

  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  if (
    date.getFullYear() !== parts[0] ||
    date.getMonth() !== parts[1] - 1 ||
    date.getDate() !== parts[2]
  ) {
    return null;
  }

  return date;
};

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const money = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-IN")}`;
  }
};

const shortMoney = (value: number) => {
  const absolute = Math.abs(value);

  if (absolute >= 10000000) {
    return `${(value / 10000000).toFixed(1)}Cr`;
  }

  if (absolute >= 100000) {
    return `${(value / 100000).toFixed(1)}L`;
  }

  if (absolute >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  return String(Math.round(value));
};

export default function AnalysisCharts({
  transactions,
  currency = "INR",
}: Props) {
  const [period, setPeriod] = useState<Period>("all");

  const reportRef = useRef<HTMLElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Keep the rest of your existing code below.

  // Validate transaction dates and amounts.
  const validTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const date = getDate(transaction.transaction_date);
      const amount = Number(transaction.amount);

      return (
        date !== null &&
        Number.isFinite(amount) &&
        amount >= 0
      );
    });
  }, [transactions]);

  // Filter transactions according to the selected period.
  const filtered = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (period === "year") {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear() + 1, 0, 1);
    } else if (period !== "all") {
      startDate = new Date(
        now.getFullYear(),
        now.getMonth() - (Number(period) - 1),
        1
      );
      startDate.setHours(0, 0, 0, 0);
    }

    return validTransactions.filter((transaction) => {
      const date = getDate(transaction.transaction_date);

      if (!date) return false;
      if (startDate && date < startDate) return false;
      if (endDate && date >= endDate) return false;

      return true;
    });
  }, [validTransactions, period]);

  // Calculate total income and expenses.
  const totals = useMemo(() => {
    return filtered.reduce(
      (result, transaction) => {
        const amount = Number(transaction.amount) || 0;

        if (isIncome(transaction.transaction_type)) {
          result.income += amount;
        } else {
          result.expenses += amount;
        }

        return result;
      },
      { income: 0, expenses: 0 }
    );
  }, [filtered]);

  const netBalance = totals.income - totals.expenses;

  const savingsRate =
    totals.income > 0
      ? (netBalance / totals.income) * 100
      : null;

  const expenseShare =
    totals.income > 0
      ? (totals.expenses / totals.income) * 100
      : null;

  // Expenses are red; remaining positive balance is green.
  const incomeUsed =
    totals.income > 0
      ? Math.min((totals.expenses / totals.income) * 100, 100)
      : 0;

  // Group expenses by category.
  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};

    filtered
      .filter(
        (transaction) =>
          !isIncome(transaction.transaction_type)
      )
      .forEach((transaction) => {
        const category =
          transaction.category?.trim() || "Uncategorized";

        categories[category] =
          (categories[category] || 0) +
          (Number(transaction.amount) || 0);
      });

    const totalCategoryExpenses = Object.values(categories).reduce(
      (sum, amount) => sum + amount,
      0
    );

    return Object.entries(categories)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage:
          totalCategoryExpenses > 0
            ? (amount / totalCategoryExpenses) * 100
            : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filtered]);

  const topCategory = categoryData[0];

  // Build monthly income and expense chart data.
  const monthlyData = useMemo(() => {
    const dates = filtered
      .map((transaction) =>
        getDate(transaction.transaction_date)
      )
      .filter((date): date is Date => date !== null);

    const now = new Date();

    let firstMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    let lastMonth = new Date(firstMonth);

    if (dates.length > 0) {
      const earliest = dates.reduce(
        (min, date) => (date < min ? date : min),
        dates[0]
      );

      const latest = dates.reduce(
        (max, date) => (date > max ? date : max),
        dates[0]
      );

      firstMonth = new Date(
        earliest.getFullYear(),
        earliest.getMonth(),
        1
      );

      if (latest > lastMonth) {
        lastMonth = new Date(
          latest.getFullYear(),
          latest.getMonth(),
          1
        );
      }
    }

    // Limit the trend chart to 120 months.
    const earliestAllowed = new Date(
      lastMonth.getFullYear(),
      lastMonth.getMonth() - 119,
      1
    );

    if (firstMonth < earliestAllowed) {
      firstMonth = earliestAllowed;
    }

    const months: Record<
      string,
      { month: string; income: number; expenses: number }
    > = {};

    for (
      let date = new Date(firstMonth);
      date <= lastMonth;
      date = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        1
      )
    ) {
      const key = getMonthKey(date);

      months[key] = {
        month: date.toLocaleDateString("en-IN", {
          month: "short",
          year: "2-digit",
        }),
        income: 0,
        expenses: 0,
      };
    }

    filtered.forEach((transaction) => {
      const date = getDate(transaction.transaction_date);
      if (!date) return;

      const key = getMonthKey(date);
      if (!months[key]) return;

      const amount = Number(transaction.amount) || 0;

      if (isIncome(transaction.transaction_type)) {
        months[key].income += amount;
      } else {
        months[key].expenses += amount;
      }
    });

    return Object.values(months);
  }, [filtered]);

  const chartTooltipStyle = {
    backgroundColor: "#171b23",
    border: "1px solid #3b414d",
    borderRadius: "12px",
    color: "#ffffff",
    padding: "10px 12px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  };

  const periodLabel: Record<Period, string> = {
    all: "All recorded transactions",
    "3": "Last 3 months",
    "6": "Last 6 months",
    "12": "Last 12 months",
    year: "Current calendar year",
  };

  const savingsDescription =
    savingsRate === null
      ? "Record income to calculate your savings rate."
      : savingsRate < 0
        ? "Your recorded expenses are higher than your income."
        : savingsRate === 0
          ? "Your recorded income and expenses are equal."
          : "This is the share of recorded income remaining after expenses.";

          
const downloadPDF = async () => {
  const element = reportRef.current;

  if (!element || isExporting) return;

  setIsExporting(true);

  try {
    // Wait for charts and fonts to finish rendering.
    await document.fonts.ready;

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#080b10",
      logging: false,
      windowWidth: Math.max(
        document.documentElement.clientWidth,
        element.scrollWidth
      ),
      onclone: (clonedDocument) => {
        const clonedElement =
          clonedDocument.querySelector(".analysis-workspace");

        if (clonedElement instanceof HTMLElement) {
          clonedElement.style.width = "1100px";
          clonedElement.style.maxWidth = "none";
          clonedElement.style.height = "auto";
          clonedElement.style.overflow = "visible";
        }

        clonedDocument
          .querySelectorAll("[data-pdf-ignore]")
          .forEach((node) => node.remove());
      },
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    // Convert each PDF page's printable height into canvas pixels.
    const pagePixelHeight = Math.floor(
      (usableHeight * canvas.width) / usableWidth
    );

    let sourceY = 0;
    let pageNumber = 0;

    while (sourceY < canvas.height) {
      const sliceHeight = Math.min(
        pagePixelHeight,
        canvas.height - sourceY
      );

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;

      const context = pageCanvas.getContext("2d");

      if (!context) {
        throw new Error("Could not prepare the PDF page.");
      }

      context.fillStyle = "#080b10";
      context.fillRect(0, 0, pageCanvas.width, sliceHeight);

      context.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight
      );

      if (pageNumber > 0) {
        pdf.addPage();
      }

      const imageData = pageCanvas.toDataURL("image/jpeg", 0.95);

      const renderedHeight =
        (sliceHeight * usableWidth) / canvas.width;

      pdf.addImage(
        imageData,
        "JPEG",
        margin,
        margin,
        usableWidth,
        renderedHeight,
        undefined,
        "FAST"
      );

      sourceY += sliceHeight;
      pageNumber += 1;
    }

    const date = new Date().toISOString().slice(0, 10);

    pdf.save(`Fav-Maverick-Financial-Analysis-${date}.pdf`);
  } catch (error) {
    console.error("PDF export failed:", error);
    window.alert(
      "Unable to create the PDF. Please try again or check the browser console."
    );
  } finally {
    setIsExporting(false);
  }
};

  return (
  <section className="analysis-workspace" ref={reportRef}>
  
      {/* HEADER AND PERIOD FILTER */}
      <header className="analysis-heading">
        <div className="analysis-heading-copy">
          <span className="analysis-eyebrow">
            FINANCIAL INTELLIGENCE
          </span>

          <h2>Financial Analysis</h2>

          <p>
            Explore your spending habits, category percentages,
            savings rate, and monthly cash flow.
          </p>
        </div>

        <div className="analysis-heading-actions">
          <label className="period-picker">
            <span>
              <CalendarDays size={15} />
              Analysis period
            </span>

            <select
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value as Period)
              }
            >
              <option value="all">All Time</option>
              <option value="3">Last 3 months</option>
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
              <option value="year">This Year</option>
            </select>
          </label>

          <button
            type="button"
            className="analysis-download-button"
            onClick={downloadPDF}
            disabled={isExporting}
            data-pdf-ignore
          >
            <Download size={16} />
            {isExporting
              ? "Preparing PDF..."
              : "Download PDF"}
          </button>
        </div>
      </header>


      <div className="analysis-period-note">
        <span className="analysis-period-indicator" />
        <span>{periodLabel[period]}</span>
        <span className="analysis-period-divider">•</span>
        <span>
          {filtered.length.toLocaleString("en-IN")} transactions
        </span>

        <button
          type="button"
          className="analysis-reset-button"
          onClick={() => setPeriod("all")}
          title="Show all recorded transactions"
        >
          <RotateCcw size={14} />
          All Time
        </button>
      </div>

      {/* SUMMARY METRICS */}
      <div className="analysis-metrics">
        <article className="analysis-metric income-metric">
          <div className="analysis-metric-icon">
            <TrendingUp size={21} />
          </div>
          <span>Total income</span>
          <strong>{money(totals.income, currency)}</strong>
          <small>
            <ArrowUpRight size={14} />
            Income received
          </small>
        </article>

        <article className="analysis-metric expense-metric">
          <div className="analysis-metric-icon">
            <Wallet size={21} />
          </div>
          <span>Total expenses</span>
          <strong>{money(totals.expenses, currency)}</strong>
          <small>
            <ArrowDownRight size={14} />
            Money spent
          </small>
        </article>

        <article className="analysis-metric savings-metric">
          <div className="analysis-metric-icon">
            <PiggyBank size={21} />
          </div>
          <span>Remaining balance</span>
          <strong
            style={{
              color:
                netBalance < 0
                  ? EXPENSE_COLOR
                  : LIME_COLOR,
            }}
          >
            {money(netBalance, currency)}
          </strong>
          <small>Income minus expenses</small>
        </article>

        <article className="analysis-metric savings-rate-metric">
          <div className="analysis-metric-icon">
            <Target size={21} />
          </div>
          <span>Savings rate</span>
          <strong
            style={{
              color:
                savingsRate !== null && savingsRate < 0
                  ? EXPENSE_COLOR
                  : LIME_COLOR,
            }}
          >
            {savingsRate === null
              ? "N/A"
              : `${savingsRate.toFixed(1)}%`}
          </strong>
          <small>Remaining balance ÷ income</small>
        </article>
      </div>

      {/* INCOME, EXPENSE AND REMAINING PERCENTAGES */}
      <div className="analysis-panel analysis-cashflow-panel">
        <div className="analysis-panel-heading">
          <div>
            <h3>Where your income goes</h3>
            <p>
              See how much of your recorded income is spent and
              how much remains.
            </p>
          </div>
        </div>

        <div className="analysis-cashflow-content">
          <div className="analysis-cashflow-stat">
            <span className="analysis-cashflow-dot income-dot" />
            <span>Income</span>
            <strong style={{ color: INCOME_COLOR }}>
              {money(totals.income, currency)}
            </strong>
            <small>100% of recorded income</small>
          </div>

          <div className="analysis-cashflow-stat">
            <span className="analysis-cashflow-dot expense-dot" />
            <span>Expenses</span>
            <strong style={{ color: EXPENSE_COLOR }}>
              {money(totals.expenses, currency)}
            </strong>
            <small>
              {expenseShare === null
                ? "Income not recorded"
                : `${expenseShare.toFixed(1)}% of income`}
            </small>
          </div>

          <div className="analysis-cashflow-stat">
            <span className="analysis-cashflow-dot savings-dot" />
            <span>Remaining</span>
            <strong
              style={{
                color:
                  netBalance < 0
                    ? EXPENSE_COLOR
                    : LIME_COLOR,
              }}
            >
              {money(netBalance, currency)}
            </strong>
            <small>
              {savingsRate === null
                ? "Income not recorded"
                : `${savingsRate.toFixed(1)}% of income`}
            </small>
          </div>
        </div>

        <div
          className="analysis-income-track"
          role="img"
          aria-label="Percentage of income used for expenses"
        >
          <div
            className="analysis-income-used"
            style={{
              width: `${incomeUsed}%`,
              background: EXPENSE_COLOR,
            }}
          />
        </div>

        <div className="analysis-income-track-labels">
          <span style={{ color: EXPENSE_COLOR }}>
            Expenses:{" "}
            {expenseShare === null
              ? "N/A"
              : `${expenseShare.toFixed(1)}%`}
          </span>
          <span
            style={{
              color:
                savingsRate !== null && savingsRate < 0
                  ? EXPENSE_COLOR
                  : LIME_COLOR,
            }}
          >
            Remaining:{" "}
            {savingsRate === null
              ? "N/A"
              : `${savingsRate.toFixed(1)}%`}
          </span>
        </div>

        {expenseShare !== null && expenseShare > 100 && (
          <p className="analysis-warning">
            <AlertTriangle size={16} />
            Your recorded expenses exceed your income. Review your
            spending categories.
          </p>
        )}

        {expenseShare !== null &&
          expenseShare <= 100 &&
          savingsRate !== null &&
          savingsRate > 0 && (
            <p className="analysis-positive">
              <BadgeCheck size={16} />
              Your recorded income is higher than your expenses
              for this selected period.
            </p>
          )}

        <p className="analysis-explanation">
          {savingsDescription}
        </p>
      </div>

      {/* MONTHLY INCOME VS EXPENSES */}
      <div className="analysis-chart-grid">
        <article className="analysis-panel analysis-trend-panel">
          <div className="analysis-panel-heading">
            <div>
              <h3>Income vs. expenses</h3>
              <p>
              <center>**Monthly Cash Flow Comparison**</center>
Compare your monthly income and expenses. Hover over any data point to view the exact amount.
              </p>
            </div>
          </div>

          <div className="analysis-chart">
            {filtered.length > 0 &&
            monthlyData.some(
              (item) => item.income > 0 || item.expenses > 0
            ) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={monthlyData}
                 margin={{
  top: 35,
  right:25,
  left:15,
  bottom:25,
}}
                >
                  <CartesianGrid
                    stroke="#303846"
                    strokeDasharray="4 4"
                    vertical={false}
                  />
<XAxis
  dataKey="month"
  stroke="#c4ccd8"
  tick={{ fill: "#e0e4eb", fontSize: 11 }}
  tickLine={false}
  axisLine={{ stroke: "#454d5b" }}
  interval="preserveStartEnd"
  minTickGap={25}
  tickMargin={14}
  padding={{ left: 12, right: 12 }}
  height={48}
/>

          <YAxis
  stroke="#c4ccd8"
  tick={{ fill: "#e0e4eb", fontSize: 11 }}
  tickLine={false}
  axisLine={false}
  width={68}
  tickMargin={10}
  tickFormatter={(value) => shortMoney(Number(value))}
/>

                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelStyle={{
                      color: "#ffffff",
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                    itemStyle={{ fontWeight: 600 }}
                    formatter={(value, name) => [
                      money(Number(value), currency),
                      name,
                    ]}
                  />

                  <Legend
                    wrapperStyle={{
                      color: "#f5f7fa",
                      fontSize: 12,
                      paddingTop: 8,
                    }}
                  />

                  {/* Income line: green */}
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke={INCOME_COLOR}
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: INCOME_COLOR,
                      stroke: "#101510",
                      strokeWidth: 1,
                    }}
                    activeDot={{
                      r: 6,
                      fill: INCOME_COLOR,
                      stroke: "#ffffff",
                      strokeWidth: 2,
                    }}
                    connectNulls
                  >
               
                  </Line>

                  {/* Expenses line: red */}
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses"
                    stroke={EXPENSE_COLOR}
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: EXPENSE_COLOR,
                      stroke: "#961818",
                      strokeWidth: 1,
                    }}
                    activeDot={{
                      r: 6,
                      fill: EXPENSE_COLOR,
                      stroke: "#ffffff",
                      strokeWidth: 2,
                    }}
                    connectNulls
                  >
                 
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="analysis-empty">
                <TrendingUp size={30} />
                <strong>No financial trends yet</strong>
                <span>
                  Add transactions or choose another period.
                </span>
              </div>
            )}
          </div>
        </article>

        {/* CATEGORY PIE CHART */}
        <article className="analysis-panel">
          <div className="analysis-panel-heading">
            <div>
              <h3>Expense percentage breakdown</h3>
              <p>Each category's share of total expenses</p>
            </div>
          </div>

          <div className="analysis-chart">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius="52%"
                    outerRadius="78%"
                    paddingAngle={3}
                    stroke="none"
                  >
                    {categoryData.map((item, index) => (
                      <Cell
                        key={item.name}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>

                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelStyle={{ color: "#ffffff" }}
                    formatter={(value, _name, item) => [
                      `${money(Number(value), currency)} (${
                        Number(
                          item.payload?.percentage || 0
                        ).toFixed(1)
                      }%)`,
                      "Expenses",
                    ]}
                  />

                  <Legend
                    wrapperStyle={{
                      color: "#f5f7fa",
                      fontSize: 11,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="analysis-empty">
                <ChartPie size={30} />
                <strong>No expense categories yet</strong>
                <span>
                  Add expenses with category names to see your
                  percentage breakdown.
                </span>
              </div>
            )}
          </div>
        </article>
      </div>

      {/* CATEGORY RANKINGS AND PERCENTAGES */}
      <article className="analysis-panel analysis-category-panel">
        <div className="analysis-panel-heading">
          <div>
            <span className="analysis-eyebrow">
              SPENDING DISTRIBUTION
            </span>
            <h3>Which categories cost you the most?</h3>
            <p>
              Ranked from highest to lowest spending, with each
              category's percentage of all recorded expenses.
            </p>
          </div>
        </div>

        {categoryData.length > 0 ? (
          <div className="analysis-category-list">
            {categoryData.map((item, index) => (
              <div
                className="analysis-category-row"
                key={item.name}
              >
                <div className="analysis-category-rank">
                  {String(index + 1).padStart(2, "0")}
                </div>

                <div className="analysis-category-details">
                  <div className="analysis-category-title">
                    <span
                      className="analysis-category-color"
                      style={{
                        background: COLORS[index % COLORS.length],
                      }}
                    />
                    <strong>{item.name}</strong>
                    <span className="analysis-category-percent">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>

                  <div className="analysis-category-track">
                    <div
                      className="analysis-category-fill"
                      style={{
                        width: `${item.percentage}%`,
                        background: COLORS[index % COLORS.length],
                      }}
                    />
                  </div>
                </div>

                <strong className="analysis-category-amount">
                  {money(item.amount, currency)}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="analysis-empty">
            <Wallet size={30} />
            <strong>No spending to rank yet</strong>
            <span>
              Your category rankings will appear when expenses
              are recorded.
            </span>
          </div>
        )}
      </article>

      {/* CATEGORY BAR CHART WITH VALUE LABELS */}
      <article className="analysis-panel analysis-category-panel">
        <div className="analysis-panel-heading">
          <div>
            <h3>Spending comparison</h3>
            <p>
              Compare expenses across categories. Amounts are
              displayed at the end of each bar.
            </p>
          </div>
        </div>

        <div className="analysis-chart analysis-bar-chart">
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryData.slice(0, 8)}
                layout="vertical"
                margin={{
                  top: 12,
                  right: 76,
                  left: 12,
                  bottom: 12,
                }}
              >
                <CartesianGrid
                  stroke="#303846"
                  strokeDasharray="4 4"
                  horizontal={false}
                />

                <XAxis
                  type="number"
                  stroke="#c4ccd8"
                  tick={{ fill: "#c4ccd8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#454d5b" }}
                  tickFormatter={(value) =>
                    shortMoney(Number(value))
                  }
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#e1e5ec"
                  width={100}
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fill: "#e1e5ec",
                    fontSize: 11,
                  }}
                />

                <Tooltip
                  contentStyle={chartTooltipStyle}
                  labelStyle={{
                    color: "#ffffff",
                    fontWeight: 700,
                  }}
                  formatter={(value, _name, item) => [
                    `${money(Number(value), currency)} (${
                      Number(
                        item.payload?.percentage || 0
                      ).toFixed(1)
                    }%)`,
                    "Expenses",
                  ]}
                />

                <Bar
                  dataKey="amount"
                  name="Expenses"
                  fill={EXPENSE_COLOR}
                  radius={[0, 6, 6, 0]}
                  maxBarSize={26}
                  minPointSize={2}
                >
                  <LabelList
                    dataKey="amount"
                    position="right"
                    formatter={(value) =>
                      money(Number(value), currency)
                    }
                    fill={LABEL_COLOR}
                    fontSize={11}
                    fontWeight={700}
                    offset={8}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="analysis-empty">
              <ChartPie size={30} />
              <strong>No category comparisons</strong>
              <span>Add expenses to compare category totals.</span>
            </div>
          )}
        </div>
      </article>

      {/* AUTOMATIC SPENDING INSIGHTS */}
      <article className="analysis-panel analysis-insights-panel">
        <div className="analysis-panel-heading">
          <div>
            <span className="analysis-eyebrow">
              YOUR MONEY REPORT
            </span>
            <h3>Spending insights</h3>
            <p>Key observations from the selected period</p>
          </div>
        </div>

        <div className="analysis-insights-grid">
          <div className="analysis-insight-card">
            <div className="analysis-insight-icon">
              <Wallet size={20} />
            </div>
            <span>Highest spending category</span>

            {topCategory ? (
              <>
                <strong>{topCategory.name}</strong>
                <b>{money(topCategory.amount, currency)}</b>
                <small>
                  {topCategory.percentage.toFixed(1)}% of all expenses
                </small>
              </>
            ) : (
              <small>No expenses recorded in this period.</small>
            )}
          </div>

          <div className="analysis-insight-card">
            <div className="analysis-insight-icon">
              <PiggyBank size={20} />
            </div>
            <span>Remaining from income</span>
            <strong
              className={
                netBalance >= 0
                  ? "analysis-good-value"
                  : "analysis-bad-value"
              }
              style={{
                color:
                  netBalance < 0
                    ? EXPENSE_COLOR
                    : INCOME_COLOR,
              }}
            >
              {money(netBalance, currency)}
            </strong>
            <small>
              {netBalance >= 0
                ? "Income exceeds or equals expenses."
                : "Expenses exceed recorded income."}
            </small>
          </div>

          <div className="analysis-insight-card">
            <div className="analysis-insight-icon">
              <Target size={20} />
            </div>
            <span>Income spent</span>
            <strong
              style={{
                color:
                  expenseShare !== null && expenseShare > 100
                    ? EXPENSE_COLOR
                    : LABEL_COLOR,
              }}
            >
              {expenseShare === null
                ? "N/A"
                : `${expenseShare.toFixed(1)}%`}
            </strong>
            <small>
              {expenseShare === null
                ? "Record income to calculate this percentage."
                : expenseShare > 100
                  ? "Spending is higher than recorded income."
                  : "Share of recorded income used for expenses."}
            </small>
          </div>
        </div>
      </article>

      <footer className="analysis-footer">
        <span>
          Analysis uses the transactions available in your finance tracker.
        </span>
        <span>
          {validTransactions.length.toLocaleString("en-IN")} valid
          dated records available
        </span>
      </footer>
    </section>
  );
}
