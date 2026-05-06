import { useEffect, useState } from 'react'
import MonthlyTrendLineChart from './MonthlyTrendLineChart'
import styles from './Pages.module.css'

const initExpenses = [
  {
    id: 1,
    isoDate: '2026-04-20',
    month: 'April 2026',
    date: '20 Apr',
    category: 'Court',
    desc: 'Kompleks Sukan',
    amount: 20,
    color: 'blue',
  },
  {
    id: 2,
    isoDate: '2026-04-18',
    month: 'April 2026',
    date: '18 Apr',
    category: 'Equipment',
    desc: 'Yonex AS-30 shuttlecocks',
    amount: 45,
    color: 'green',
  },
  {
    id: 3,
    isoDate: '2026-04-15',
    month: 'April 2026',
    date: '15 Apr',
    category: 'Court',
    desc: 'Dewan Sukan USM',
    amount: 20,
    color: 'blue',
  },
  {
    id: 4,
    isoDate: '2026-04-12',
    month: 'April 2026',
    date: '12 Apr',
    category: 'Stringing',
    desc: 'BG80 Power 26 lbs',
    amount: 35,
    color: 'purple',
  },
  {
    id: 5,
    isoDate: '2026-04-10',
    month: 'April 2026',
    date: '10 Apr',
    category: 'Transport',
    desc: 'Grab to tournament',
    amount: 18,
    color: 'amber',
  },
  {
    id: 6,
    isoDate: '2026-04-08',
    month: 'April 2026',
    date: '8 Apr',
    category: 'Court',
    desc: 'Penang BC court',
    amount: 20,
    color: 'blue',
  },
  {
    id: 7,
    isoDate: '2026-04-03',
    month: 'April 2026',
    date: '3 Apr',
    category: 'Transport',
    desc: 'Grab to training',
    amount: 7,
    color: 'amber',
  },
]

const categoryInfo = {
  Court: { label: 'Court rental', badge: 'blue', color: '#1A5FFF' },
  Equipment: { label: 'Equipment', badge: 'green', color: '#00C48C' },
  Stringing: { label: 'Stringing', badge: 'purple', color: '#7C3AED' },
  Transport: { label: 'Transport', badge: 'amber', color: '#F59E0B' },
  Other: { label: 'Other', badge: 'gray', color: '#8892A4' },
}

const MONTH_NAMES_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
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

function formatRM(v) {
  return `RM ${Number(v).toFixed(2)}`
}

function formatRMNoDecimal(v) {
  return `RM ${Math.round(Number(v))}`
}

function getTodayISO() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
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
  const monthIdx = MONTH_NAMES_LONG.indexOf(monthName)
  const year = Number(yearText)

  return { monthIdx, year }
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

          <button className={styles.modalClose} onClick={onClose}>
            ✕
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
          }}
        >
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

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
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
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className={styles.btnOutline} onClick={onClose}>
              Cancel
            </button>

            <button className={styles.btnPrimary} onClick={onSave}>
              Save
            </button>
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
}) {
  return (
    <div
      className={styles.modalOverlay}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modal} style={{ maxWidth: 420 }}>
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>Set Monthly Budget</div>

          <button className={styles.modalClose} onClick={onClose}>
            ✕
          </button>
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
          <span className={styles.statVal}>{budgetUsedPercent}%</span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 18,
          }}
        >
          <button className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>

          <button className={styles.btnPrimary} onClick={onClose}>
            Save Budget
          </button>
        </div>
      </div>
    </div>
  )
}

function RuleSuggestionsCard({ suggestions }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Rule-based Suggestions</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {suggestions.map((s, i) => (
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
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color:
                  s.type === 'danger'
                    ? '#EF4444'
                    : s.type === 'warning'
                    ? '#F59E0B'
                    : s.type === 'success'
                    ? '#00C48C'
                    : C.text,
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
        ))}
      </div>
    </div>
  )
}

export default function Expenses() {
  const [expenses, setExpenses] = useState(initExpenses)
  const [nextExpenseId, setNextExpenseId] = useState(8)
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey)

  const [showAddExpense, setShowAddExpense] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [expenseForm, setExpenseForm] = useState(createEmptyExpenseForm)

  const [monthlyBudget, setMonthlyBudget] = useState(() => {
    const saved = localStorage.getItem('monthlyBudget')
    return saved ? Number(saved) : 200
  })

  const [showBudgetModal, setShowBudgetModal] = useState(false)

  useEffect(() => {
    localStorage.setItem('monthlyBudget', monthlyBudget)
  }, [monthlyBudget])

  const handleExpenseChange = (key, value) => {
    setExpenseForm(f => ({
      ...f,
      [key]: value,
    }))
  }

  const availableMonths = sortMonths(
    Array.from(
      new Set([
        ...baseMonthOptions,
        ...expenses.map(e => e.month),
        selectedMonth,
      ])
    )
  )

  const filteredExpenses = expenses
    .filter(e => e.month === selectedMonth)
    .sort((a, b) => b.isoDate.localeCompare(a.isoDate))

  const selectedMonthTotal = filteredExpenses.reduce(
    (s, e) => s + Number(e.amount),
    0
  )

  const monthly = availableMonths.map(month => ({
    month,
    amt: expenses
      .filter(e => e.month === month)
      .reduce((s, e) => s + Number(e.amount), 0),
    current: month === selectedMonth,
  }))

  const selectedMonthIndex = availableMonths.indexOf(selectedMonth)

  const previousMonthName =
    selectedMonthIndex > 0 ? availableMonths[selectedMonthIndex - 1] : null

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
    monthlyBudget > 0
      ? Math.round((selectedMonthTotal / monthlyBudget) * 100)
      : 0

  const remainingBudget = monthlyBudget - selectedMonthTotal

  let budgetStatus = 'Safe'

  if (budgetUsedPercent >= 100) {
    budgetStatus = 'Exceeded'
  } else if (budgetUsedPercent >= 80) {
    budgetStatus = 'Near Limit'
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
        pct:
          selectedMonthTotal > 0
            ? Math.round((val / selectedMonthTotal) * 100)
            : 0,
        color: categoryInfo[category].color,
      }
    })
    .filter(e => e.val > 0)

  const highestCategory =
    byCategory.length > 0
      ? byCategory.reduce((max, e) => (e.val > max.val ? e : max), byCategory[0])
      : null

  const budgetAlertMessage = (() => {
    if (selectedMonthTotal <= 0) {
      return `No expenses recorded for ${selectedMonth}. Add expenses to monitor budget usage.`
    }

    if (budgetStatus === 'Exceeded') {
      return `You have spent ${formatRM(
        selectedMonthTotal
      )}, which is over your monthly budget of ${formatRM(monthlyBudget)}.`
    }

    if (budgetStatus === 'Near Limit') {
      return `You have used ${budgetUsedPercent}% of your monthly budget. Remaining budget is ${formatRM(
        remainingBudget
      )}.`
    }

    return `You are within budget. Remaining budget for ${selectedMonth} is ${formatRM(
      remainingBudget
    )}.`
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
  } else if (selectedMonthTotal > 0) {
    ruleSuggestions.push({
      type: 'success',
      title: 'Spending under control',
      text: 'Your current spending is still within the monthly budget. Continue monitoring expenses regularly.',
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
      text: `This month’s spending is higher than your average monthly spending this year of ${formatRM(
        avgMonth
      )}.`,
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

  const buildExpenseFromForm = id => {
    const amount = Number(expenseForm.amount)
    const { dateStr, monthKey } = isoToDisplay(expenseForm.date)
    const cat = categoryInfo[expenseForm.category] || categoryInfo.Other

    return {
      id,
      isoDate: expenseForm.date,
      month: monthKey,
      date: dateStr,
      category: expenseForm.category,
      desc: expenseForm.desc.trim() || 'No description',
      amount,
      color: cat.badge,
    }
  }

  const validateExpense = () => {
    const amount = Number(expenseForm.amount)

    if (
      !expenseForm.date ||
      !expenseForm.amount ||
      Number.isNaN(amount) ||
      amount <= 0
    ) {
      alert('Please enter a valid date and amount.')
      return false
    }

    return true
  }

  const handleAddExpense = () => {
    if (!validateExpense()) return

    const newExpense = buildExpenseFromForm(nextExpenseId)

    setExpenses(prev => [newExpense, ...prev])
    setNextExpenseId(n => n + 1)
    setSelectedMonth(newExpense.month)
    closeExpenseModal()
  }

  const handleSaveEditExpense = () => {
    if (!validateExpense()) return

    const updatedExpense = buildExpenseFromForm(editingExpense.id)

    setExpenses(prev =>
      prev.map(expense =>
        expense.id === editingExpense.id ? updatedExpense : expense
      )
    )

    setSelectedMonth(updatedExpense.month)
    closeExpenseModal()
  }

  const handleDeleteExpense = () => {
    setExpenses(prev =>
      prev.filter(expense => expense.id !== editingExpense.id)
    )

    closeExpenseModal()
  }

  const pencilIcon = (
    <svg
      width="13"
      height="13"
      viewBox="0 0 14 14"
      fill="none"
      style={{ color: C.muted, flexShrink: 0 }}
    >
      <path
        d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  return (
    <div>
      <div className={styles.pageHead}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div className={styles.pageTitle}>Expense Tracker</div>
            <div className={styles.pageSub}>
              Record and monitor all badminton-related spending
            </div>
          </div>

          <button className={styles.btnPrimary} onClick={openAddExpense}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1v12M1 7h12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Add Expense
          </button>
        </div>
      </div>

      <div className={styles.g4} style={{ marginBottom: 16 }}>
        <div className={styles.metricHighlight}>
          <div
            className={styles.metricIcon}
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect
                x="2"
                y="4"
                width="14"
                height="10"
                rx="2"
                stroke="white"
                strokeWidth="1.5"
              />
              <path d="M2 8h14" stroke="white" strokeWidth="1.5" />
            </svg>
          </div>

          <div className={styles.metricVal} style={{ color: '#fff' }}>
            {formatRMNoDecimal(selectedMonthTotal)}
          </div>

          <div
            className={styles.metricLbl}
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            {selectedMonth}
          </div>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: '#E8EFFE' }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              style={{ color: '#1A5FFF' }}
            >
              <rect
                x="3"
                y="3"
                width="12"
                height="12"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M6 7h6M6 10h4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className={styles.metricVal} style={{ color: '#1A5FFF' }}>
            {formatRMNoDecimal(monthlyBudget)}
          </div>

          <div className={styles.metricLbl}>Monthly budget</div>

          <button
            className={styles.btnOutline}
            style={{
              marginTop: 10,
              fontSize: 11,
              padding: '6px 10px',
              borderRadius: 8,
            }}
            onClick={() => setShowBudgetModal(true)}
          >
            Set Budget
          </button>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: '#FEF3C7' }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              style={{ color: '#F59E0B' }}
            >
              <polyline
                points="2,14 6,8 9,10 12,5 16,7"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className={styles.metricVal} style={{ color: '#F59E0B' }}>
            {formatRMNoDecimal(thisYearTotal)}
          </div>

          <div className={styles.metricLbl}>This year</div>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: '#E0FAF3' }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              style={{ color: '#00C48C' }}
            >
              <path
                d="M3 10L7 14L15 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className={styles.metricVal} style={{ color: '#00C48C' }}>
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
              <div
                style={{
                  textAlign: 'center',
                  color: C.muted,
                  padding: 20,
                  fontSize: 13,
                }}
              >
                No category breakdown for this month.
              </div>
            ) : (
              byCategory.map((e, i) => (
                <div key={i} className={styles.expBarRow}>
                  <div className={styles.expBarLbl}>{e.label}</div>

                  <div className={styles.expBarTrack}>
                    <div
                      className={styles.expBarFill}
                      style={{
                        width: `${e.pct}%`,
                        background: e.color,
                      }}
                    />
                  </div>

                  <div className={styles.expBarVal}>{formatRM(e.val)}</div>
                </div>
              ))
            )}
          </div>

          <div className={styles.card}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
                gap: 12,
              }}
            >
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
              <div
                style={{
                  textAlign: 'center',
                  color: C.muted,
                  padding: 20,
                  fontSize: 13,
                }}
              >
                No expenses recorded for this month.
              </div>
            ) : (
              filteredExpenses.map(expense => (
                <div
                  key={expense.id}
                  className={styles.listRow}
                  onClick={() => openEditExpense(expense)}
                  style={{
                    cursor: 'pointer',
                    borderRadius: 8,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = C.soft
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.muted,
                    }}
                  >
                    {expense.date}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 3,
                      }}
                    >
                      <span className={getCategoryBadgeClass(expense.color)}>
                        {expense.category}
                      </span>

                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: C.text,
                        }}
                      >
                        {expense.desc}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: C.text,
                      }}
                    >
                      {formatRM(expense.amount)}
                    </span>

                    {pencilIcon}
                  </div>
                </div>
              ))
            )}

            <div
              style={{
                borderTop: `2px solid ${C.line}`,
                marginTop: 12,
                paddingTop: 12,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: C.muted,
                  fontWeight: 600,
                }}
              >
                Total
              </span>

              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: C.text,
                }}
              >
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
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: C.soft,
                  borderRadius: 10,
                  fontSize: 12,
                  color: C.muted,
                  fontWeight: 600,
                }}
              >
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
                  : '1.5px solid #00C48C',
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
                    : '#00C48C',
              }}
            >
              Budget Alert
            </div>

            <div
              style={{
                fontSize: 13,
                color: C.text,
                lineHeight: 1.6,
                fontWeight: 600,
              }}
            >
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
                        : '#00C48C',
                  }}
                >
                  {budgetUsedPercent}%
                </span>
              </div>

              <div className={styles.statRow}>
                <span className={styles.statLabel}>Remaining</span>

                <span
                  className={styles.statVal}
                  style={{
                    color: remainingBudget < 0 ? '#EF4444' : '#00C48C',
                  }}
                >
                  {formatRM(remainingBudget)}
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
                        : styles.badgeGreen
                    }
                  >
                    {budgetStatus}
                  </span>
                </span>
              </div>
            </div>

            {highestCategory && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: C.muted,
                  fontWeight: 600,
                }}
              >
                Highest category: {highestCategory.label} —{' '}
                {formatRM(highestCategory.val)} ({highestCategory.pct}%)
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
        />
      )}
    </div>
  )
}