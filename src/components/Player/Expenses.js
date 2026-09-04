import { useCallback, useEffect, useState } from 'react'
import NotificationBell from '../Notifications/NotificationBell'
import { supabase } from '../../lib/supabase'
import MonthlyTrendLineChart from '../Layout/MonthlyTrendLineChart'
import styles from '../Layout/Pages.module.css'
import Loader from '../Loader/Loader'
import useLoadingDelay from '../Loader/LoadingDelay'

const categoryInfo = {
  Court: { label: 'Court rental', badge: 'blue', color: '#1A5FFF' },
  Equipment: { label: 'Equipment', badge: 'green', color: '#00C48C' },
  Stringing: { label: 'Stringing', badge: 'purple', color: '#7C3AED' },
  Transport: { label: 'Transport', badge: 'amber', color: '#F59E0B' },
  Other: { label: 'Other', badge: 'gray', color: '#8892A4' },
}

const MONTH_NAMES_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const today = new Date()
const currentYear = today.getFullYear()
const currentMonthIndex = today.getMonth()
const currentMonthKey = `${MONTH_NAMES_LONG[currentMonthIndex]} ${currentYear}`

const baseMonthOptions = Array.from(
  { length: currentMonthIndex + 1 },
  (_, i) => `${MONTH_NAMES_LONG[i]} ${currentYear}`
)

const C = {
  text: 'var(--text, #0D1B3E)',
  muted: 'var(--text-muted, #8892A4)',
  card: 'var(--card, #FFFFFF)',
  soft: 'var(--soft, #EEF1F8)',
  line: 'var(--line, #EEF1F8)',
}

function ExpenseIcon({ type, color = 'currentColor', size = 18 }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
  }

  if (type === 'bell') {
    return (
      <svg {...props}>
        <path
          d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 21h4"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'wallet') {
    return (
      <svg {...props}>
        <rect
          x="3"
          y="6"
          width="18"
          height="13"
          rx="3"
          stroke={color}
          strokeWidth="1.8"
        />
        <path
          d="M3 10h18"
          stroke={color}
          strokeWidth="1.8"
        />
        <path
          d="M16 13h3"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'budget') {
    return (
      <svg {...props}>
        <rect
          x="4"
          y="3"
          width="16"
          height="18"
          rx="3"
          stroke={color}
          strokeWidth="1.8"
        />
        <path
          d="M8 8h8M8 12h8M8 16h5"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'trend') {
    return (
      <svg {...props}>
        <path
          d="M4 17l5-5 4 4 7-8"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 8h5v5"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (type === 'average') {
    return (
      <svg {...props}>
        <circle
          cx="12"
          cy="12"
          r="8"
          stroke={color}
          strokeWidth="1.8"
        />
        <path
          d="m8.5 12 2.3 2.3L15.8 9"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (type === 'warning') {
    return (
      <svg {...props}>
        <path
          d="M10.3 4.9 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.9a2 2 0 0 0-3.4 0Z"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M12 9v4M12 17h.01"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'check') {
    return (
      <svg {...props}>
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke={color}
          strokeWidth="1.8"
        />
        <path
          d="m8 12.5 2.5 2.5L16 9.5"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (type === 'info') {
    return (
      <svg {...props}>
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke={color}
          strokeWidth="1.8"
        />
        <path
          d="M12 11v5M12 8h.01"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return null
}

function getSuggestionMeta(type) {
  if (type === 'danger') {
    return {
      icon: 'warning',
      background: '#FEE2E2',
      color: '#EF4444',
    }
  }

  if (type === 'warning') {
    return {
      icon: 'warning',
      background: '#FEF3C7',
      color: '#F59E0B',
    }
  }

  if (type === 'success') {
    return {
      icon: 'check',
      background: '#DDF8EF',
      color: '#00C48C',
    }
  }

  return {
    icon: 'info',
    background: '#E8EFFE',
    color: '#1A5FFF',
  }
}


function formatRM(v) {
  return `RM ${Number(v || 0).toFixed(2)}`
}

function formatRMNoDecimal(v) {
  return `RM ${Math.round(Number(v || 0))}`
}

function getTodayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

function createEmptyExpenseForm() {
  return {
    date: getTodayISO(),
    category: 'Court',
    desc: '',
    amount: '',
  }
}

function parseMonth(monthStr) {
  const [monthName, yearText] = monthStr.split(' ')
  return {
    monthIdx: MONTH_NAMES_LONG.indexOf(monthName),
    year: Number(yearText),
  }
}

function sortMonths(months) {
  return [...months].sort((a, b) => {
    const ma = parseMonth(a)
    const mb = parseMonth(b)
    if (ma.year !== mb.year) return ma.year - mb.year
    return ma.monthIdx - mb.monthIdx
  })
}

function isoToDisplay(iso) {
  if (!iso) return { dateStr: '', monthKey: '' }

  const [year, month, day] = iso.split('-').map(Number)
  const monthIdx = month - 1

  return {
    dateStr: `${day} ${MONTH_NAMES_SHORT[monthIdx]}`,
    monthKey: `${MONTH_NAMES_LONG[monthIdx]} ${year}`,
  }
}

function getCategoryBadgeClass(color) {
  if (color === 'blue') return styles.badgeBlue
  if (color === 'green') return styles.badgeGreen
  if (color === 'purple') return styles.badgePurple
  if (color === 'amber') return styles.badgeAmber
  return styles.badgeGray
}

function ExpenseModal({ title, form, onChange, onSave, onClose, onDelete }) {
  return (
    <div
      className={styles.modalOverlay}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modal} style={{ maxWidth: 480 }}>
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>{title}</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Date</label>
            <input
              className={styles.formInput}
              type="date"
              value={form.date}
              onChange={e => onChange('date', e.target.value)}
            />
          </div>

          <div className={styles.formRow}>
            <label className={styles.formLabel}>Category</label>
            <select
              className={styles.formSelect}
              value={form.category}
              onChange={e => onChange('category', e.target.value)}
            >
              <option>Court</option>
              <option>Equipment</option>
              <option>Stringing</option>
              <option>Transport</option>
              <option>Other</option>
            </select>
          </div>
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Description optional</label>
          <input
            className={styles.formInput}
            placeholder="e.g. Kompleks Sukan court"
            value={form.desc}
            onChange={e => onChange('desc', e.target.value)}
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Amount RM</label>
          <input
            className={styles.formInput}
            type="number"
            placeholder="e.g. 20"
            value={form.amount}
            onChange={e => onChange('amount', e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {onDelete ? (
            <button
              onClick={onDelete}
              style={{
                padding: '9px 16px',
                borderRadius: 10,
                border: '1.5px solid #FCA5A5',
                background: '#FEF2F2',
                color: '#EF4444',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          ) : <div />}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className={styles.btnOutline} onClick={onClose}>Cancel</button>
            <button className={styles.btnPrimary} onClick={onSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function BudgetModal({
  monthlyBudget,
  setMonthlyBudget,
  selectedMonthTotal,
  budgetUsedPercent,
  onClose,
  onSave,
}) {
  return (
    <div
      className={styles.modalOverlay}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modal} style={{ maxWidth: 420 }}>
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>Set Monthly Budget</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Monthly badminton budget</label>
          <input
            className={styles.formInput}
            type="number"
            value={monthlyBudget}
            onChange={e => setMonthlyBudget(Number(e.target.value))}
            placeholder="Example: 200"
          />
        </div>

        <div className={styles.statRow}>
          <span className={styles.statLabel}>Current spending</span>
          <span className={styles.statVal}>{formatRM(selectedMonthTotal)}</span>
        </div>

        <div className={styles.statRow}>
          <span className={styles.statLabel}>Budget used</span>
          <span className={styles.statVal}>
            {Number.isFinite(budgetUsedPercent) ? `${budgetUsedPercent}%` : '—'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button className={styles.btnOutline} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={onSave}>Save Budget</button>
        </div>
      </div>
    </div>
  )
}

function RuleSuggestionsCard({ suggestions }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Suggestions</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {suggestions.map((s, i) => {
          const meta = getSuggestionMeta(s.type)

          return (
            <div
              key={i}
              style={{
                padding: 12,
                borderRadius: 10,
                background:
                  s.type === 'danger'
                    ? 'rgba(239, 68, 68, 0.12)'
                    : s.type === 'warning'
                    ? 'rgba(245, 158, 11, 0.14)'
                    : s.type === 'success'
                    ? 'rgba(0, 196, 140, 0.12)'
                    : C.soft,
                border:
                  s.type === 'danger'
                    ? '1px solid #EF4444'
                    : s.type === 'warning'
                    ? '1px solid #F59E0B'
                    : s.type === 'success'
                    ? '1px solid #00C48C'
                    : `1px solid ${C.line}`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                minHeight: 62,
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: meta.background,
                  color: meta.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ExpenseIcon
                  type={meta.icon}
                  color={meta.color}
                  size={15}
                />
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: meta.color,
                    marginBottom: 4,
                  }}
                >
                  {s.title}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: C.text,
                    lineHeight: 1.5,
                    fontWeight: 500,
                  }}
                >
                  {s.text}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey)
  const [loading, setLoading] = useState(true)
  const showLoader = useLoadingDelay(loading, 350)

  const [showAddExpense, setShowAddExpense] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [expenseForm, setExpenseForm] = useState(createEmptyExpenseForm)

  const [monthlyBudget, setMonthlyBudget] = useState(0)
  const [hasMonthlyBudget, setHasMonthlyBudget] = useState(false)
  const [showBudgetModal, setShowBudgetModal] = useState(false)

  // Expense-page notification bell.
  // These notifications are calculated from the selected month's budget,
  // so this page only shows expense-related alerts.
  const [readExpenseNotificationKeys, setReadExpenseNotificationKeys] = useState([])
  const [clearedExpenseNotificationKeys, setClearedExpenseNotificationKeys] = useState([])

  const fetchExpenses = useCallback(async () => {
    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user

    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    if (error) {
      console.log(error)
      setLoading(false)
      return
    }

    const formatted = (data || []).map(item => {
      const { dateStr, monthKey } = isoToDisplay(item.date)
      const cat = categoryInfo[item.category] || categoryInfo.Other

      return {
        id: item.id,
        isoDate: item.date,
        month: monthKey,
        date: dateStr,
        category: item.category,
        desc: item.description || 'No description',
        amount: Number(item.amount),
        color: cat.badge,
      }
    })

    setExpenses(formatted)
    setLoading(false)
  }, [])

  const fetchBudget = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user

    if (!user) {
      setMonthlyBudget(0)
      setHasMonthlyBudget(false)
      return
    }

    const { data, error } = await supabase
      .from('expense_budgets')
      .select('budget')
      .eq('user_id', user.id)
      .eq('month', selectedMonth)
      .maybeSingle()

    if (error) {
      console.log(error)
      return
    }

    const budgetExists =
      data?.budget !== undefined &&
      data?.budget !== null &&
      Number(data.budget) > 0

    setHasMonthlyBudget(budgetExists)
    setMonthlyBudget(budgetExists ? Number(data.budget) : 0)
  }, [selectedMonth])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  useEffect(() => {
    fetchBudget()
  }, [fetchBudget])

  const saveBudget = async () => {
    const nextBudget = Number(monthlyBudget)

    if (!Number.isFinite(nextBudget) || nextBudget <= 0) {
      alert('Please enter a monthly budget greater than RM 0.')
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return

    const { error } = await supabase.from('expense_budgets').upsert(
      {
        user_id: user.id,
        month: selectedMonth,
        budget: nextBudget,
      },
      {
        onConflict: 'user_id,month',
      }
    )

    if (error) {
      console.log(error)
      alert('Failed to save budget.')
      return
    }

    setHasMonthlyBudget(true)
    setMonthlyBudget(nextBudget)
    setShowBudgetModal(false)
  }

  const handleExpenseChange = (key, value) => {
    setExpenseForm(f => ({ ...f, [key]: value }))
  }

  const availableMonths = sortMonths(
    Array.from(new Set([...baseMonthOptions, ...expenses.map(e => e.month), selectedMonth]))
  )

  const filteredExpenses = expenses
    .filter(e => e.month === selectedMonth)
    .sort((a, b) => b.isoDate.localeCompare(a.isoDate))

  const selectedMonthTotal = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0)

  const monthly = availableMonths.map(month => ({
    month,
    amt: expenses.filter(e => e.month === month).reduce((s, e) => s + Number(e.amount), 0),
    current: month === selectedMonth,
  }))

  const selectedMonthIndex = availableMonths.indexOf(selectedMonth)
  const previousMonthName = selectedMonthIndex > 0 ? availableMonths[selectedMonthIndex - 1] : null

  const previousMonthTotal = previousMonthName
    ? monthly.find(m => m.month === previousMonthName)?.amt || 0
    : 0

  const savedAmount = previousMonthTotal - selectedMonthTotal

  const savedPercent =
    previousMonthTotal > 0
      ? Math.abs((savedAmount / previousMonthTotal) * 100).toFixed(1)
      : 0

  const thisYearTotal = monthly
    .filter(m => {
      const parsed = parseMonth(m.month)
      return parsed.year === currentYear && parsed.monthIdx <= currentMonthIndex
    })
    .reduce((s, m) => s + m.amt, 0)

  const monthsPassed = currentMonthIndex + 1
  const avgMonth = monthsPassed > 0 ? thisYearTotal / monthsPassed : 0

  const budgetUsedPercent =
    hasMonthlyBudget && monthlyBudget > 0
      ? Math.round((selectedMonthTotal / monthlyBudget) * 100)
      : null

  const remainingBudget =
    hasMonthlyBudget ? monthlyBudget - selectedMonthTotal : null

  let budgetStatus = 'Not Set'
  if (hasMonthlyBudget && budgetUsedPercent >= 100) budgetStatus = 'Exceeded'
  else if (hasMonthlyBudget && budgetUsedPercent >= 80) budgetStatus = 'Near Limit'
  else if (hasMonthlyBudget) budgetStatus = 'Safe'

  const expenseNotifications = []

  if (hasMonthlyBudget && budgetStatus === 'Exceeded') {
    expenseNotifications.push({
      key: `budget-exceeded-${selectedMonth}`,
      title: 'Monthly budget exceeded',
      message: `You have spent ${formatRM(selectedMonthTotal)}, which is ${formatRM(
        Math.abs(remainingBudget)
      )} over your ${formatRM(monthlyBudget)} budget for ${selectedMonth}.`,
      type: 'danger',
    })
  } else if (hasMonthlyBudget && budgetStatus === 'Near Limit') {
    expenseNotifications.push({
      key: `budget-near-limit-${selectedMonth}`,
      title: 'Monthly budget almost reached',
      message: `You have used ${budgetUsedPercent}% of your budget for ${selectedMonth}. Only ${formatRM(
        Math.max(remainingBudget, 0)
      )} remains.`,
      type: 'warning',
    })
  }

  const visibleExpenseNotifications = expenseNotifications
    .filter(
      notification =>
        !clearedExpenseNotificationKeys.includes(notification.key)
    )
    .map(notification => ({
      ...notification,
      id: notification.key,
      created_at: new Date().toISOString(),
      is_read: readExpenseNotificationKeys.includes(
        notification.key
      ),
      action_url: '/expenses',
    }))

  const markAllExpenseNotificationsRead = () => {
    setReadExpenseNotificationKeys(previous =>
      Array.from(
        new Set([
          ...previous,
          ...visibleExpenseNotifications.map(
            notification => notification.key
          ),
        ])
      )
    )
  }

  const clearExpenseNotifications = id => {
    const keys = id
      ? [id]
      : visibleExpenseNotifications.map(
          notification => notification.key
        )

    setClearedExpenseNotificationKeys(previous =>
      Array.from(new Set([...previous, ...keys]))
    )
  }

  const openExpenseNotification = notification => {
    setReadExpenseNotificationKeys(previous =>
      previous.includes(notification.key)
        ? previous
        : [...previous, notification.key]
    )
  }

  const byCategory = Object.keys(categoryInfo)
    .map(category => {
      const val = filteredExpenses
        .filter(e => e.category === category)
        .reduce((s, e) => s + Number(e.amount), 0)

      return {
        category,
        label: categoryInfo[category].label,
        val,
        pct: selectedMonthTotal > 0 ? Math.round((val / selectedMonthTotal) * 100) : 0,
        color: categoryInfo[category].color,
      }
    })
    .filter(e => e.val > 0)

  const highestCategory =
    byCategory.length > 0
      ? byCategory.reduce((max, e) => (e.val > max.val ? e : max), byCategory[0])
      : null

  const budgetAlertMessage = (() => {
    if (!hasMonthlyBudget) {
      return `No monthly budget has been set for ${selectedMonth}. Set a budget to receive expense notifications.`
    }

    if (selectedMonthTotal <= 0) {
      return `No expenses recorded for ${selectedMonth}. Add expenses to monitor budget usage.`
    }

    if (budgetStatus === 'Exceeded') {
      return `You have spent ${formatRM(selectedMonthTotal)}, which is over your monthly budget of ${formatRM(monthlyBudget)}.`
    }

    if (budgetStatus === 'Near Limit') {
      return `You have used ${budgetUsedPercent}% of your monthly budget. Remaining budget is ${formatRM(remainingBudget)}.`
    }

    return `You are within budget. Remaining budget for ${selectedMonth} is ${formatRM(remainingBudget)}.`
  })()

  const ruleSuggestions = []

  if (selectedMonthTotal <= 0) {
    ruleSuggestions.push({
      type: 'info',
      title: 'Start recording expenses',
      text: `No expenses are recorded for ${selectedMonth}. Add expenses to generate spending suggestions.`,
    })
  }

  if (budgetStatus === 'Exceeded') {
    ruleSuggestions.push({
      type: 'danger',
      title: 'Budget exceeded',
      text: 'Your spending has exceeded the monthly budget. Try to reduce non-essential badminton expenses for the rest of the month.',
    })
  } else if (budgetStatus === 'Near Limit') {
    ruleSuggestions.push({
      type: 'warning',
      title: 'Budget near limit',
      text: 'Your spending is close to the monthly budget limit. Review upcoming court, transport, or equipment costs.',
    })
  } else if (hasMonthlyBudget && selectedMonthTotal > 0) {
    ruleSuggestions.push({
      type: 'success',
      title: 'Spending under control',
      text: 'Your current spending is still within the monthly budget. Continue monitoring expenses regularly.',
    })
  } else if (!hasMonthlyBudget && selectedMonthTotal > 0) {
    ruleSuggestions.push({
      type: 'info',
      title: 'Set a monthly budget',
      text: `You have recorded ${formatRM(selectedMonthTotal)} in spending for ${selectedMonth}. Set a budget to track how much remains.`,
    })
  }

  if (highestCategory && highestCategory.pct >= 35) {
    ruleSuggestions.push({
      type: 'warning',
      title: `${highestCategory.label} is the highest cost`,
      text: `${highestCategory.label} takes up ${highestCategory.pct}% of this month’s spending. Review this category if you want to reduce cost.`,
    })
  }

  if (avgMonth > 0 && selectedMonthTotal > avgMonth) {
    ruleSuggestions.push({
      type: 'warning',
      title: 'Above average monthly spending',
      text: `This month’s spending is higher than your average monthly spending this year of ${formatRM(avgMonth)}.`,
    })
  }

  if (byCategory.length >= 3) {
    ruleSuggestions.push({
      type: 'info',
      title: 'Multiple spending categories',
      text: 'Your expenses are spread across several categories. Check which category affects your budget the most.',
    })
  }

  const openAddExpense = () => {
    setExpenseForm(createEmptyExpenseForm())
    setShowAddExpense(true)
  }

  const openEditExpense = expense => {
    setEditingExpense(expense)
    setExpenseForm({
      date: expense.isoDate,
      category: expense.category,
      desc: expense.desc === 'No description' ? '' : expense.desc,
      amount: String(expense.amount),
    })
  }

  const closeExpenseModal = () => {
    setShowAddExpense(false)
    setEditingExpense(null)
    setExpenseForm(createEmptyExpenseForm())
  }

  const validateExpense = () => {
    const amount = Number(expenseForm.amount)

    if (!expenseForm.date || !expenseForm.amount || Number.isNaN(amount) || amount <= 0) {
      alert('Please enter a valid date and amount.')
      return false
    }

    return true
  }

  const handleAddExpense = async () => {
    if (!validateExpense()) return

    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user

    if (!user) {
      alert('Please login first.')
      return
    }

    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      date: expenseForm.date,
      category: expenseForm.category,
      description: expenseForm.desc.trim() || null,
      amount: Number(expenseForm.amount),
    })

    if (error) {
      console.log(error)
      alert('Failed to add expense.')
      return
    }

    const { monthKey } = isoToDisplay(expenseForm.date)
    setSelectedMonth(monthKey)

    await fetchExpenses()
    closeExpenseModal()
  }

  const handleSaveEditExpense = async () => {
    if (!validateExpense()) return

    const { error } = await supabase
      .from('expenses')
      .update({
        date: expenseForm.date,
        category: expenseForm.category,
        description: expenseForm.desc.trim() || null,
        amount: Number(expenseForm.amount),
      })
      .eq('id', editingExpense.id)

    if (error) {
      console.log(error)
      alert('Failed to update expense.')
      return
    }

    const { monthKey } = isoToDisplay(expenseForm.date)
    setSelectedMonth(monthKey)

    await fetchExpenses()
    closeExpenseModal()
  }

  const handleDeleteExpense = async () => {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', editingExpense.id)

    if (error) {
      console.log(error)
      alert('Failed to delete expense.')
      return
    }

    await fetchExpenses()
    closeExpenseModal()
  }

  const pencilIcon = (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: C.muted, flexShrink: 0 }}>
      <path
        d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  if (loading && !showLoader) {
    return null
  }

  if (showLoader) {
    return (
      <div className={styles.card}>
        <Loader text="Loading expenses..." />
      </div>
    )
  }

  return (
    <div className={styles.playerReadablePage}>
      <div className={styles.pageHead}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className={styles.pageTitle}>Expense Tracker</div>
            <div className={styles.pageSub}>Record and monitor all badminton-related spending</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className={styles.btnPrimary}
              onClick={openAddExpense}
              style={{ minHeight: 38, padding: '0 14px', borderRadius: 9 }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Add Expense
            </button>
            <NotificationBell
              supabase={supabase}
              title="Expense notifications"
              localOnly
              localItems={visibleExpenseNotifications}
              onLocalMarkAllRead={markAllExpenseNotificationsRead}
              onLocalClear={clearExpenseNotifications}
              onLocalItemClick={openExpenseNotification}
            />

          </div>
        </div>
      </div>

      <div className={styles.g4} style={{ marginBottom: 16 }}>
        <div className={styles.metricHighlight}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#FEF3C7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
              flexShrink: 0,
            }}
          >
            <ExpenseIcon type="wallet" color="#F59E0B" size={18} />
          </div>

          <div
            className={styles.metricVal}
            style={{
              color: '#FFFFFF',
              WebkitTextFillColor: '#FFFFFF',
            }}
          >
            {formatRMNoDecimal(selectedMonthTotal)}
          </div>

          <div className={styles.metricLbl} style={{ color: 'rgba(255,255,255,0.6)' }}>
            {selectedMonth}
          </div>
        </div>

        <div className={styles.metric}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#E8EFFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
              flexShrink: 0,
            }}
          >
            <ExpenseIcon type="budget" color="#1A5FFF" size={18} />
          </div>

          <div
            className={styles.metricVal}
            style={{
              color: '#1A5FFF',
              WebkitTextFillColor: '#1A5FFF',
            }}
          >
            {hasMonthlyBudget
              ? formatRMNoDecimal(monthlyBudget)
              : 'Not set'}
          </div>

          <div className={styles.metricLbl}>Monthly budget</div>

          <button
            className={styles.btnOutline}
            style={{ marginTop: 10, fontSize: 11, padding: '6px 10px', borderRadius: 8 }}
            onClick={() => setShowBudgetModal(true)}
          >
            {hasMonthlyBudget ? 'Edit Budget' : 'Set Budget'}
          </button>
        </div>

        <div className={styles.metric}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#FEF3C7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
              flexShrink: 0,
            }}
          >
            <ExpenseIcon type="trend" color="#F59E0B" size={18} />
          </div>

          <div
            className={styles.metricVal}
            style={{
              color: '#F59E0B',
              WebkitTextFillColor: '#F59E0B',
            }}
          >
            {formatRMNoDecimal(thisYearTotal)}
          </div>

          <div className={styles.metricLbl}>This year</div>
        </div>

        <div className={styles.metric}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#DDF8EF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
              flexShrink: 0,
            }}
          >
            <ExpenseIcon type="average" color="#00C48C" size={18} />
          </div>

          <div
            className={styles.metricVal}
            style={{
              color: '#00C48C',
              WebkitTextFillColor: '#00C48C',
            }}
          >
            {formatRMNoDecimal(avgMonth)}
          </div>

          <div className={styles.metricLbl}>Avg / month this year</div>
        </div>
      </div>

      <div className={styles.g2}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>By category — {selectedMonth}</div>

            {byCategory.length === 0 ? (
              <div style={{ textAlign: 'center', color: C.muted, padding: 20, fontSize: 13 }}>
                No category breakdown for this month.
              </div>
            ) : (
              byCategory.map((e, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '110px minmax(0, 1fr) 92px',
                    gap: 12,
                    alignItems: 'center',
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: C.muted,
                    }}
                  >
                    {e.label}
                  </div>

                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background:
                        'color-mix(in srgb, var(--line, #EEF1F8) 88%, var(--card, #FFFFFF))',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${e.pct}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: `linear-gradient(
                          90deg,
                          color-mix(in srgb, ${e.color} 38%, var(--card, #FFFFFF)) 0%,
                          color-mix(in srgb, ${e.color} 68%, var(--card, #FFFFFF)) 55%,
                          ${e.color} 100%
                        )`,
                      }}
                    />
                  </div>

                  <div
                    style={{
                      width: 92,
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: 800,
                      color: e.color,
                      WebkitTextFillColor: e.color,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatRM(e.val)}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
              <div>
                <div className={styles.cardTitle} style={{ marginBottom: 0 }}>
                  Expense log — {selectedMonth}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                  Click any expense to edit
                </div>
              </div>

              <select
                className={styles.formSelect}
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                style={{ width: 170 }}
              >
                {availableMonths.map(month => (
                  <option key={month}>{month}</option>
                ))}
              </select>
            </div>

            {filteredExpenses.length === 0 ? (
              <div style={{ textAlign: 'center', color: C.muted, padding: 20, fontSize: 13 }}>
                No expenses recorded for this month.
              </div>
            ) : (
              filteredExpenses.map(expense => (
                <div
                  key={expense.id}
                  className={styles.listRow}
                  onClick={() => openEditExpense(expense)}
                  style={{ cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.soft }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ width: 56, fontSize: 11, fontWeight: 700, color: C.muted }}>
                    {expense.date}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span className={getCategoryBadgeClass(expense.color)}>
                        {expense.category}
                      </span>

                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                        {expense.desc}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      {formatRM(expense.amount)}
                    </span>
                    {pencilIcon}
                  </div>
                </div>
              ))
            )}

            <div style={{ borderTop: `2px solid ${C.line}`, marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Total</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: C.text }}>
                {formatRM(selectedMonthTotal)}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Monthly trend</div>
            <MonthlyTrendLineChart monthly={monthly} />

            {previousMonthName && previousMonthTotal > 0 ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: savedAmount >= 0 ? '#E0FAF3' : '#FEF3C7',
                  borderRadius: 10,
                  fontSize: 12,
                  color: savedAmount >= 0 ? '#00976C' : '#92400E',
                  fontWeight: 600,
                }}
              >
                {savedAmount >= 0
                  ? `↓ ${savedPercent}% less than previous month — good job!`
                  : `↑ ${savedPercent}% more than previous month — review spending.`}
              </div>
            ) : (
              <div style={{ marginTop: 12, padding: 10, background: C.soft, borderRadius: 10, fontSize: 12, color: C.muted, fontWeight: 600 }}>
                No previous month data available for comparison.
              </div>
            )}
          </div>

          <div
            className={styles.card}
            style={{
              background: C.card,
              border:
                budgetStatus === 'Exceeded'
                  ? '1.5px solid #EF4444'
                  : budgetStatus === 'Near Limit'
                  ? '1.5px solid #F59E0B'
                  : budgetStatus === 'Safe'
                  ? '1.5px solid #00C48C'
                  : `1.5px solid ${C.line}`,
            }}
          >
            <div
              className={styles.cardTitle}
              style={{
                color:
                  budgetStatus === 'Exceeded'
                    ? '#EF4444'
                    : budgetStatus === 'Near Limit'
                    ? '#F59E0B'
                    : budgetStatus === 'Safe'
                    ? '#00C48C'
                    : C.muted,
              }}
            >
              Budget Alert
            </div>

            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, fontWeight: 600 }}>
              {budgetAlertMessage}
            </div>

            <div style={{ marginTop: 12 }}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Budget used</span>
                <span
                  className={styles.statVal}
                  style={{
                    color:
                      budgetStatus === 'Exceeded'
                        ? '#EF4444'
                        : budgetStatus === 'Near Limit'
                        ? '#F59E0B'
                        : budgetStatus === 'Safe'
                        ? '#00C48C'
                        : C.muted,
                  }}
                >
                  {hasMonthlyBudget ? `${budgetUsedPercent}%` : '—'}
                </span>
              </div>

              <div className={styles.statRow}>
                <span className={styles.statLabel}>Remaining</span>
                <span
                  className={styles.statVal}
                  style={{
                    color:
                      !hasMonthlyBudget
                        ? C.muted
                        : remainingBudget < 0
                        ? '#EF4444'
                        : '#00C48C',
                  }}
                >
                  {hasMonthlyBudget ? formatRM(remainingBudget) : '—'}
                </span>
              </div>

              <div className={styles.statRow}>
                <span className={styles.statLabel}>Status</span>
                <span className={styles.statVal}>
                  <span
                    className={
                      budgetStatus === 'Exceeded'
                        ? styles.badgeRed
                        : budgetStatus === 'Near Limit'
                        ? styles.badgeAmber
                        : budgetStatus === 'Safe'
                        ? styles.badgeGreen
                        : styles.badgeGray
                    }
                  >
                    {budgetStatus}
                  </span>
                </span>
              </div>
            </div>

            {highestCategory && (
              <div style={{ marginTop: 10, fontSize: 12, color: C.muted, fontWeight: 600 }}>
                Highest category: {highestCategory.label} — {formatRM(highestCategory.val)} ({highestCategory.pct}%)
              </div>
            )}
          </div>

          <RuleSuggestionsCard suggestions={ruleSuggestions} />
        </div>
      </div>

      {showAddExpense && (
        <ExpenseModal
          title="Add Expense"
          form={expenseForm}
          onChange={handleExpenseChange}
          onSave={handleAddExpense}
          onClose={closeExpenseModal}
        />
      )}

      {editingExpense && (
        <ExpenseModal
          title="Edit Expense"
          form={expenseForm}
          onChange={handleExpenseChange}
          onSave={handleSaveEditExpense}
          onClose={closeExpenseModal}
          onDelete={handleDeleteExpense}
        />
      )}

      {showBudgetModal && (
        <BudgetModal
          monthlyBudget={monthlyBudget}
          setMonthlyBudget={setMonthlyBudget}
          selectedMonthTotal={selectedMonthTotal}
          budgetUsedPercent={budgetUsedPercent}
          onClose={() => setShowBudgetModal(false)}
          onSave={saveBudget}
        />
      )}
    </div>
  )
}
