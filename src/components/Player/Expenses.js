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
  Shuttlecocks: { label: 'Shuttlecocks', badge: 'green', color: '#00C48C' },
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


// Quick calculator for badminton expenses. Calculations stay local and are not saved.
function ExpenseCalculator({ onClose }) {
  const [display, setDisplay] = useState('0')
  const [storedValue, setStoredValue] = useState(null)
  const [operator, setOperator] = useState(null)
  const [startNewNumber, setStartNewNumber] = useState(false)
  const [error, setError] = useState('')

  const calculate = (left, right, operation) => {
    if (operation === '+') return left + right
    if (operation === '−') return left - right
    if (operation === '×') return left * right
    if (operation === '÷') return right === 0 ? null : left / right
    return right
  }

  const formatResult = value => {
    if (value === null || !Number.isFinite(value)) return null
    return String(Number(value.toPrecision(12)))
  }

  const pressKey = key => {
    if (key === 'C') {
      setDisplay('0')
      setStoredValue(null)
      setOperator(null)
      setStartNewNumber(false)
      setError('')
      return
    }
    if (error) return

    if (key === '⌫') {
      if (startNewNumber) return
      setDisplay(previous => previous.length <= 1 || (previous.length === 2 && previous.startsWith('-')) ? '0' : previous.slice(0, -1))
      return
    }
    if (/^[0-9]$/.test(key) || key === '.' || key === '00') {
      if (startNewNumber) {
        setDisplay(key === '.' ? '0.' : key)
        setStartNewNumber(false)
      } else if (key === '.') {
        if (!display.includes('.')) setDisplay(previous => `${previous}.`)
      } else {
        setDisplay(previous => previous === '0' ? (key === '00' ? '0' : key) : previous.length + key.length > 16 ? previous : `${previous}${key}`)
      }
      return
    }
    if (key === '%') {
      const result = formatResult(Number(display) / 100)
      if (result !== null) setDisplay(result)
      return
    }
    if (['+', '−', '×', '÷'].includes(key)) {
      const currentValue = Number(display)
      if (operator && storedValue !== null && !startNewNumber) {
        const result = formatResult(calculate(storedValue, currentValue, operator))
        if (result === null) {
          setError('Cannot divide by zero')
          return
        }
        setDisplay(result)
        setStoredValue(Number(result))
      } else {
        setStoredValue(currentValue)
      }
      setOperator(key)
      setStartNewNumber(true)
      return
    }
    if (key === '=' && operator && storedValue !== null) {
      const result = formatResult(calculate(storedValue, Number(display), operator))
      if (result === null) {
        setError('Cannot divide by zero')
        return
      }
      setDisplay(result)
      setStoredValue(null)
      setOperator(null)
      setStartNewNumber(true)
    }
  }

  const keys = [
    'C', '⌫', '%', '÷',
    '7', '8', '9', '×',
    '4', '5', '6', '−',
    '1', '2', '3', '+',
    '0', '00', '.', '=',
  ]

  return (
    <div className={styles.modalOverlay} onClick={event => event.target === event.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Expense calculator"
        style={{ width: 'min(360px, 92vw)', maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>Calculator</div>
          <button type="button" className={styles.modalClose} aria-label="Close calculator" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '14px 12px', borderRadius: 12, background: C.soft, textAlign: 'right', marginBottom: 12, minHeight: 77 }}>
          <div style={{ fontSize: 12, color: C.muted, minHeight: 18 }}>
            {storedValue !== null && operator ? `${storedValue} ${operator}` : 'Calculator · RM'}
          </div>
          <div aria-live="polite" style={{ fontSize: 29, fontWeight: 700, color: error ? '#DC2626' : C.text, overflowWrap: 'anywhere' }}>
            {error || display}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          {keys.map(key => (
            <button key={key} type="button" onClick={() => pressKey(key)}
              style={{ height: 48, borderRadius: 10, border: `1px solid ${C.line}`,
                background: key === '=' ? '#16A34A' : ['+', '−', '×', '÷'].includes(key) ? '#E8EFFE' : C.card,
                color: key === '=' ? '#FFFFFF' : C.text, fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>
              {key}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: C.muted, textAlign: 'center' }}>
          For quick calculations only. Results are not added to expenses.
        </div>
      </div>
    </div>
  )
}

const groupPanelCss = {
  label: { fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 5, display: 'block' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  small: { fontSize: 12, color: C.muted },
  chip: { padding: '4px 9px', borderRadius: 20, background: C.soft, fontSize: 11, fontWeight: 700 },
}

function GroupExpenseManager({ currentUserId, onGroupChanged }) {
  const [items, setItems] = useState([])
  const [savedGroups, setSavedGroups] = useState([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [section, setSection] = useState('active')
  const [creating, setCreating] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [groupModal, setGroupModal] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Court')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(getTodayISO())
  const [notes, setNotes] = useState('')
  const [players, setPlayers] = useState([])
  const [manualName, setManualName] = useState('')
  const [playerQuery, setPlayerQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [playerSearchError, setPlayerSearchError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    if (!currentUserId) return
    setLoadingGroups(true)
    const [expenseRes, savedRes] = await Promise.all([
      supabase.from('group_expenses')
        .select('*,group_expense_participants(*)')
        .order('expense_date', { ascending: false }),
      supabase.from('expense_saved_groups')
        .select('*,expense_saved_group_members(*)')
        .order('group_name', { ascending: true }),
    ])
    if (expenseRes.error) console.error('Group expense load:', expenseRes.error)
    if (savedRes.error) console.error('Saved group load:', savedRes.error)
    setItems(expenseRes.data || [])
    setSavedGroups(savedRes.data || [])
    setLoadingGroups(false)
  }, [currentUserId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!playerQuery.trim() || playerQuery.trim().length < 2) {
      setSearchResults([])
      setSearching(false)
      setPlayerSearchError('')
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setSearching(true)
      const { data, error } = await supabase.rpc('search_group_expense_players', { p_query: playerQuery.trim() })
      if (!cancelled) {
        setSearchResults(error ? [] : (data || []))
        setSearching(false)
        setPlayerSearchError(error ? 'Unable to search players. Run Group_Expense_Search_All_Players.sql in Supabase.' : '')
        if (error) console.error('Player search:', error)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [playerQuery])

  const addPlayer = player => {
    const id = player.user_id || null
    const name = String(player.player_name || '').trim()
    if (!name) return
    if (id && players.some(p => p.user_id === id)) return
    if (!id && players.some(p => !p.user_id && p.player_name.toLowerCase() === name.toLowerCase())) return
    setPlayers(prev => [...prev, { user_id: id, player_name: name }])
    setManualName('')
    setPlayerQuery('')
    setSearchResults([])
  }
  const applySavedGroup = id => {
    const group = savedGroups.find(s => s.id === id)
    if (group) setPlayers((group.expense_saved_group_members || []).map(p => ({
      user_id: p.user_id || null, player_name: p.player_name,
    })))
  }
  const resetForm = () => {
    setEditingExpenseId(null)
    setCreating(false); setTitle(''); setAmount(''); setCategory('Court')
    setDate(getTodayISO()); setNotes(''); setPlayers([])
    setManualName(''); setPlayerQuery('')
  }
  const canEditExpense = item => (
    item.created_by === currentUserId &&
    item.status === 'active' &&
    (item.group_expense_participants || []).length > 0 &&
    (item.group_expense_participants || []).every(p =>
      p.request_status === 'pending' && p.payment_status === 'unpaid'
    )
  )
  const beginEditExpense = item => {
    if (!canEditExpense(item)) return
    setGroupModal(false)
    setEditingExpenseId(item.id)
    setTitle(item.title || '')
    setCategory(item.category || 'Court')
    setAmount(String(item.total_amount ?? ''))
    setDate(item.expense_date || getTodayISO())
    setNotes(item.notes || '')
    setPlayers((item.group_expense_participants || []).map(p => ({
      user_id: p.user_id || null,
      player_name: p.player_name,
    })))
    setManualName('')
    setPlayerQuery('')
    setSearchResults([])
    setCreating(true)
  }
  const createExpense = async () => {
    const parsed = Number(amount)
    if (!title.trim() || !Number.isFinite(parsed) || parsed <= 0 || Math.abs(Math.round(parsed * 100) - parsed * 100) > 0.000001) {
      alert('Enter a title and a valid amount with at most 2 decimal places.'); return
    }
    if (!players.length) { alert('Add at least one other player.'); return }
    setSaving(true)
    const { error } = await supabase.rpc('create_group_expense', {
      p_title: title.trim(), p_category: category, p_total_amount: parsed,
      p_players: players, p_expense_date: date, p_notes: notes.trim() || null,
    })
    setSaving(false)
    if (error) { alert(error.message || 'Unable to create group expense.'); return }
    resetForm()
    await load()
    await onGroupChanged()
  }
  const updateExpense = async () => {
    if (!editingExpenseId) return
    const parsed = Number(amount)
    if (!title.trim() || !Number.isFinite(parsed) || parsed <= 0 ||
        Math.abs(Math.round(parsed * 100) - parsed * 100) > 0.000001) {
      alert('Enter a title and a valid amount with at most 2 decimal places.')
      return
    }
    if (!players.length) { alert('Add at least one other player.'); return }
    if (parsed * 100 < players.length + 1) {
      alert('Total is too small to give every player a share.'); return
    }
    setSaving(true)
    const { error } = await supabase.rpc('edit_group_expense', {
      p_expense_id: editingExpenseId,
      p_title: title.trim(),
      p_category: category,
      p_total_amount: parsed,
      p_players: players,
      p_expense_date: date,
      p_notes: notes.trim() || null,
    })
    setSaving(false)
    if (error) { alert(error.message || 'Unable to update group expense.'); return }
    resetForm()
    await load()
    await onGroupChanged()
  }
  const saveGroup = async () => {
    if (!groupName.trim() || !players.length) { alert('Enter a group name and add at least one other player.'); return }
    setSaving(true)
    const { error } = await supabase.rpc('save_expense_group', {
      p_group_name: groupName.trim(), p_players: players, p_group_id: editingGroupId,
    })
    setSaving(false)
    if (error) { alert(error.message || 'Unable to save the group.'); return }
    setGroupModal(false); setEditingGroupId(null); setGroupName(''); setPlayers([])
    await load()
  }
  const deleteSavedGroup = async group => {
    if (!window.confirm(`Delete saved group "${group.group_name}"? Previous expenses will stay in History.`)) return
    const { error } = await supabase.rpc('delete_expense_saved_group', { p_group_id: group.id })
    if (error) { alert(error.message); return }
    await load()
  }
  const handlePayment = async (participant, action) => {
    setBusyId(participant.id)
    const { error } = await supabase.rpc('update_group_expense_payment', {
      p_participant_id: participant.id, p_action: action,
    })
    setBusyId(null)
    if (error) { alert(error.message || 'Unable to update payment.'); return }
    await load()
    await onGroupChanged()
  }
  // Player-only personal view: archive an unpaid request or restore it to Active.
  // Paid requests move to History automatically and cannot be restored.
  const changeMyExpenseHistory = async (participant, shouldArchive) => {
    if (!participant || busyId) return
    setBusyId(participant.id)
    const { error } = await supabase.rpc('set_group_expense_archived', {
      p_participant_id: participant.id,
      p_archived: shouldArchive,
    })
    setBusyId(null)
    if (error) {
      alert(error.message || 'Could not update your expense history.')
      return
    }
    await load()
  }

  const cancelExpense = async item => {
    if (!window.confirm(`Cancel "${item.title}"? This will remove its personal spending shares.`)) return
    setBusyId(item.id)
    const { error } = await supabase.rpc('cancel_group_expense', { p_expense_id: item.id })
    setBusyId(null)
    if (error) { alert(error.message || 'Unable to cancel expense.'); return }
    await load()
    await onGroupChanged()
  }
  const buttons = (participant, owned, active) => {
    // The creator sees one compact tick per participant. Only eligible
    // payments can be confirmed, and a confirmed tick is read-only.
    if (owned && participant.payment_status === 'paid') {
      return <span role="img" aria-label={`${participant.player_name}: payment received`}
        title="Payment received"
        style={{ width: 25, height: 25, display: 'inline-grid', placeItems: 'center',
          border: '1.5px solid #16A34A', borderRadius: 7, background: '#DCFCE7',
          color: '#15803D', fontSize: 16, fontWeight: 700 }}>✓</span>
    }
    if (!active || participant.payment_status === 'paid') return null
    if (owned) {
      if (!participant.user_id || (participant.request_status === 'accepted' && participant.payment_status === 'awaiting_confirmation')) {
        return <button type="button" disabled={busyId === participant.id}
          aria-label={`Confirm payment received from ${participant.player_name}`}
          title="Tick to confirm payment received"
          onClick={() => handlePayment(participant, 'confirm_received')}
          style={{ width: 25, height: 25, display: 'inline-grid', placeItems: 'center',
            border: `1.5px solid ${C.muted}`, borderRadius: 7, background: C.card,
            color: C.text, fontSize: 16, fontWeight: 700, cursor: 'pointer',
            opacity: busyId === participant.id ? 0.55 : 1 }}>
          ✓
        </button>
      }
      return null
    }
    if (participant.user_id !== currentUserId) return null
    if (participant.request_status === 'pending') return <span style={{ display: 'flex', gap: 6 }}>
      <button type="button" className={styles.btnPrimary} disabled={busyId === participant.id}
        style={{ fontSize: 11, padding: '5px 9px' }} onClick={() => handlePayment(participant, 'accept')}>Accept</button>
      <button type="button" className={styles.btnOutline} disabled={busyId === participant.id}
        style={{ fontSize: 11, padding: '5px 9px' }} onClick={() => handlePayment(participant, 'decline')}>Decline</button>
    </span>
    if (participant.request_status === 'accepted' && participant.payment_status === 'unpaid') {
      return <button type="button" className={styles.btnPrimary} disabled={busyId === participant.id}
        onClick={() => handlePayment(participant, 'mark_sent')} style={{ fontSize: 11, padding: '5px 9px' }}>I've Paid</button>
    }
    return null
  }
  const displayStatus = participant => {
    if (participant.payment_status === 'paid') return 'Paid'
    if (participant.request_status === 'declined') return 'Declined'
    if (participant.payment_status === 'awaiting_confirmation') return 'Awaiting confirmation'
    if (participant.request_status === 'pending' && participant.user_id) return 'Awaiting acceptance'
    return 'Pending'
  }
  const modal = (heading, onSave, onClose) => <div className={styles.modalOverlay}
    onClick={e => e.target === e.currentTarget && onClose()}>
    <div className={styles.modal} style={{ width: 'min(95vw, 560px)', maxHeight: '88vh', overflowY: 'auto' }}>
      <div className={styles.modalHead}><div className={styles.modalTitle}>{heading}</div>
        <button type="button" className={styles.modalClose} onClick={onClose}>✕</button></div>
      {!groupModal && <>
        <div className={styles.formRow}><label className={styles.formLabel}>Expense title</label>
          <input className={styles.formInput} value={title} maxLength={120} onChange={e => setTitle(e.target.value)} placeholder="e.g. Friday badminton court" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <div className={styles.formRow}><label className={styles.formLabel}>Category</label>
            <select className={styles.formSelect} value={category} onChange={e => setCategory(e.target.value)}>
              <option value="Court">Court rental</option><option value="Shuttlecocks">Shuttlecocks</option><option value="Other">Other</option>
            </select></div>
          <div className={styles.formRow}><label className={styles.formLabel}>Date</label>
            <input className={styles.formInput} type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        <div className={styles.formRow}><label className={styles.formLabel}>Total paid by you (RM)</label>
          <input className={styles.formInput} type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="60.00" /></div>
        <div className={styles.formRow}><label className={styles.formLabel}>Notes (optional)</label>
          <input className={styles.formInput} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Court or session details" /></div>
      </>}
      {groupModal && <div className={styles.formRow}><label className={styles.formLabel}>Saved group name</label>
        <input className={styles.formInput} value={groupName} maxLength={80} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Friday Badminton" /></div>}
      {!groupModal && savedGroups.length > 0 && <div className={styles.formRow}>
        <label className={styles.formLabel}>Use saved players (optional)</label>
        <select className={styles.formSelect} defaultValue="" onChange={e => { if (e.target.value) applySavedGroup(e.target.value) }}>
          <option value="">Select a saved group...</option>
          {savedGroups.map(group => <option key={group.id} value={group.id}>{group.group_name}</option>)}
        </select></div>}
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Search players (registered or public)</label>
        <input className={styles.formInput} value={playerQuery} onChange={e => setPlayerQuery(e.target.value)} spellCheck={false} autoCorrect="off" autoCapitalize="off" placeholder="Search player name (at least 2 letters)" />
        {searching && <div style={groupPanelCss.small}>Searching...</div>}
        {playerSearchError && <div style={{ ...groupPanelCss.small, color: '#DC2626' }}>{playerSearchError}</div>}
        {!searching && !playerSearchError && playerQuery.trim().length >= 2 && searchResults.length === 0 && <div style={groupPanelCss.small}>No matching players found. You can enter a name manually below.</div>}
        {searchResults.filter(result => !players.some(p => result.user_id ? p.user_id === result.user_id : (!p.user_id && p.player_name.toLowerCase() === result.player_name.toLowerCase()))).map(result =>
          <button type="button" key={`${result.player_type}-${result.user_id || result.player_name}`} onClick={() => addPlayer(result)}
            style={{ display: 'block', width: '100%', padding: 9, textAlign: 'left', border: `1px solid ${C.line}`, background: C.card, color: C.text, cursor: 'pointer' }}>
            + {result.player_name} <span style={{ color: C.muted, fontSize: 11 }}>· {result.player_type === 'registered' ? 'Registered · payment request' : 'Public directory · manual payment tracking'}</span>
          </button>)}
      </div>
      <div className={styles.formRow}><label className={styles.formLabel}>Or add player without an account</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className={styles.formInput} value={manualName} maxLength={120}
            onChange={e => setManualName(e.target.value)} placeholder="Player name" />
          <button type="button" className={styles.btnOutline} onClick={() => addPlayer({ player_name: manualName })}>Add</button>
        </div></div>
      <div style={{ padding: 12, background: C.soft, borderRadius: 10, marginBottom: 14 }}>
        <div style={groupPanelCss.row}><strong style={{ fontSize: 12 }}>Players (you + {players.length})</strong>
          {!groupModal && Number(amount) > 0 && <strong style={{ fontSize: 12 }}>Approx. {formatRM(Number(amount) / (players.length + 1))} each</strong>}</div>
        {players.length === 0 && <p style={groupPanelCss.small}>No other players added yet.</p>}
        {players.map((player, i) => <div key={`${player.user_id || player.player_name}-${i}`} style={{ ...groupPanelCss.row, marginTop: 8, fontSize: 12 }}>
          <span>{player.player_name}</span>
          <button type="button" onClick={() => setPlayers(prev => prev.filter((_, j) => j !== i))}
            style={{ border: 'none', background: 'transparent', color: '#DC2626', cursor: 'pointer' }}>Remove</button>
        </div>)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className={styles.btnOutline} onClick={onClose}>Cancel</button>
        <button type="button" className={styles.btnPrimary} disabled={saving} onClick={onSave}>
          {saving ? 'Saving...' : groupModal ? 'Save Group' : editingExpenseId ? 'Save Changes' : 'Create Expense'}
        </button>
      </div>
    </div>
  </div>

  // Creator: History only when the entire group is completed/cancelled.
  // Tagged player: History as soon as THEIR payment is confirmed, or when
  // they close their own card; other participants' statuses do not matter.
  const isInHistory = item => {
    if (item.created_by === currentUserId) return item.status !== 'active'
    const mine = (item.group_expense_participants || []).find(p => p.user_id === currentUserId)
    return item.status !== 'active' || mine?.payment_status === 'paid' || Boolean(mine?.archived_by_player_at)
  }
  const active = items.filter(item => !isInHistory(item))
  const history = items.filter(isInHistory)
  const listed = section === 'active' ? active : history

  const paymentStatusStyle = status => {
    if (status === 'Paid') return { color: '#15803D', background: '#DCFCE7' }
    if (status === 'Declined') return { color: '#B91C1C', background: '#FEE2E2' }
    if (status === 'Awaiting confirmation') return { color: '#B45309', background: '#FEF3C7' }
    if (status === 'Awaiting acceptance') return { color: '#475569', background: '#F1F5F9' }
    return { color: '#64748B', background: '#F1F5F9' }
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div className={styles.card} style={{ padding: '17px 20px' }}>
      <div style={groupPanelCss.row}>
        <div>
          <div className={styles.cardTitle} style={{ marginBottom: 4 }}>Group Expenses</div>
          <div style={groupPanelCss.small}>Share costs, reuse players and track reimbursements.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className={styles.btnOutline}
            onClick={() => { setPlayers([]); setEditingGroupId(null); setGroupName(''); setGroupModal(true) }}>
            Manage Saved Groups
          </button>
          <button type="button" className={styles.btnPrimary}
            onClick={() => { resetForm(); setCreating(true) }}>+ Create Group Expense</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        {['active', 'history'].map(value => <button key={value} type="button"
          className={section === value ? styles.btnPrimary : styles.btnOutline}
          onClick={() => setSection(value)}
          style={{ padding: '7px 14px', borderRadius: 9, fontSize: 12 }}>
          {value === 'active' ? `Active (${active.length})` : `History (${history.length})`}
        </button>)}
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 14, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
    {loadingGroups ? <div className={styles.card}>Loading group expenses...</div> : listed.length === 0 ?
      <div className={styles.card} style={{ textAlign: 'center', padding: 28, color: C.muted }}>
        {section === 'active'
          ? 'No active group expenses. Create one to start tracking shared costs.'
          : 'No completed or cancelled group expenses yet.'}
      </div> : listed.map(item => {
        const owned = item.created_by === currentUserId
        const participants = item.group_expense_participants || []
        const paidParticipants = participants.filter(p => p.payment_status === 'paid')
        const received = paidParticipants.reduce((sum, p) => sum + Number(p.amount_owed), 0)
        const due = owned ? Number(item.total_amount) - Number(item.creator_share) :
          participants.reduce((sum, p) => sum + Number(p.amount_owed), 0)
        const myPayment = participants.find(p => p.user_id === currentUserId)
        // The creator sees every participant. For invited users, RLS may expose
        // only their own row, so infer the equal-split count from the creator's
        // share rather than incorrectly showing '2 players'.
        const totalAmount = Number(item.total_amount)
        const creatorShare = Number(item.creator_share)
        const playerCount = owned
          ? participants.length + 1
          : creatorShare > 0
            ? Math.max(2, Math.round(totalAmount / creatorShare))
            : 0
        const outstanding = Math.max(0, due - received)
        const progress = due > 0 ? Math.min(100, Math.max(0, (received / due) * 100)) : 100
        const expanded = expandedId === item.id
        const statusText = item.status === 'cancelled' ? 'Cancelled'
          : item.status === 'completed' || (!owned && myPayment?.payment_status === 'paid') ? 'Completed'
          : !owned && myPayment?.archived_by_player_at ? 'Closed' : 'Active'
        const statusColor = statusText === 'Completed' || statusText === 'Closed'
          ? { background: '#DCFCE7', color: '#15803D' }
          : item.status === 'cancelled'
            ? { background: '#FEE2E2', color: '#B91C1C' }
            : { background: '#EEF2FF', color: '#1D4ED8' }

        return <div key={item.id} className={styles.card} style={{ padding: '16px 20px' }}>
          <button type="button" aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} payment tracking for ${item.title}`}
            onClick={() => setExpandedId(expanded ? null : item.id)}
            style={{ width: '100%', border: 0, background: 'transparent', padding: 0,
              textAlign: 'left', color: C.text, cursor: 'pointer' }}>
            <div style={groupPanelCss.row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{item.title}</div>
                <div style={{ ...groupPanelCss.small, lineHeight: 1.4 }}>
                  {item.expense_date} · {item.category} · {owned ? 'You paid upfront' : 'Someone else paid'}
                </div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                <span style={{ ...statusColor, padding: '5px 11px', borderRadius: 20,
                  fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                  {statusText}
                </span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  aria-hidden="true"
                  style={{ color: C.muted, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease', flexShrink: 0 }}>
                  <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: owned ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
              gap: 12, marginTop: 14 }}>
              <div>
                <div style={{ ...groupPanelCss.small, fontSize: 10, fontWeight: 700, letterSpacing: '.04em' }}>TOTAL</div>
                <strong style={{ fontSize: 16, fontWeight: 700 }}>{formatRM(item.total_amount)}</strong>
              </div>
              <div>
                <div style={{ ...groupPanelCss.small, fontSize: 10, fontWeight: 700, letterSpacing: '.04em' }}>
                  {owned ? 'YOUR SHARE' : 'YOU OWE'}
                </div>
                <strong style={{ fontSize: 16, fontWeight: 700, color: '#1A5FFF' }}>
                  {formatRM(owned ? item.creator_share : myPayment?.amount_owed || 0)}
                </strong>
                {playerCount > 0 && (
                  <div style={{ marginTop: 4, fontSize: 11, fontWeight: 400, color: C.muted, lineHeight: 1.45 }}>
                    {formatRM(totalAmount)} ÷ {playerCount} players
                  </div>
                )}
              </div>
              {owned && <div style={{ textAlign: 'right' }}>
                <div style={{ ...groupPanelCss.small, fontSize: 10, fontWeight: 700, letterSpacing: '.04em' }}>STILL OWED</div>
                <strong style={{ fontSize: 16, fontWeight: 700, color: outstanding === 0 ? '#15803D' : C.text }}>
                  {formatRM(outstanding)}
                </strong>
              </div>}
            </div>
          </button>

          {owned && expanded && canEditExpense(item) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className={styles.btnOutline}
                style={{ fontSize: 11, padding: '6px 12px', borderRadius: 8 }}
                onClick={() => beginEditExpense(item)}>
                Edit Expense
              </button>
            </div>
          )}
          {owned && <div style={{ marginTop: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8,
              fontSize: 11, color: C.muted, marginBottom: 6 }}>
              <span>{paidParticipants.length} of {participants.length} payments received</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div role="progressbar" aria-label="Reimbursement progress" aria-valuemin={0}
              aria-valuemax={100} aria-valuenow={Math.round(progress)}
              style={{ height: 5, borderRadius: 999, overflow: 'hidden', background: '#E8EDF5' }}>
              <div style={{ height: '100%', width: `${progress}%`, borderRadius: 999,
                background: '#16A34A', transition: 'width 180ms ease' }} />
            </div>
          </div>}

          {expanded && <div style={{ marginTop: 14, paddingTop: 13, borderTop: `1px solid ${C.line}` }}>
            {item.notes?.trim() && (
              <div style={{ padding: '12px 14px', marginBottom: 14, background: C.soft,
                borderRadius: 10, border: `1px solid ${C.line}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 5 }}>
                  Notes
                </div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {item.notes}
                </div>
              </div>
            )}
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 7 }}>Payment Tracking</div>
            {participants.map(p => {
              const status = displayStatus(p)
              const statusStyle = paymentStatusStyle(status)
              return <div key={p.id} style={{ display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
                padding: '10px 0', borderBottom: `1px solid ${C.line}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>{p.player_name}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ ...statusStyle, fontSize: 10, padding: '3px 8px',
                      borderRadius: 20, fontWeight: 700 }}>{status}</span>
                    {p.payment_confirmed_at && <span style={{ fontSize: 10, color: C.muted }}>
                      {new Date(p.payment_confirmed_at).toLocaleDateString()}
                    </span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatRM(p.amount_owed)}</strong>
                  {buttons(p, owned, item.status === 'active')}
                </div>
              </div>
            })}
            {owned && <div style={{ ...groupPanelCss.row, marginTop: 13, fontSize: 12 }}>
              <span>Received: <strong style={{ color: '#15803D' }}>{formatRM(received)}</strong>
                <span style={{ color: C.muted }}> · Outstanding: {formatRM(outstanding)}</span>
              </span>
              {item.status === 'active' && received === 0 && <button type="button"
                className={styles.btnOutline} disabled={busyId === item.id}
                onClick={() => cancelExpense(item)}
                style={{ fontSize: 11, color: '#DC2626' }}>Cancel Expense</button>}
            </div>}
            {!owned && <div style={{ ...groupPanelCss.row, marginTop: 12 }}>
              <span style={groupPanelCss.small}>
                {myPayment?.payment_status === 'paid'
                  ? 'Payment confirmed. This record is saved in your History.'
                  : 'Only your payment request is visible to you. The payer confirms receipt.'}
              </span>
              {myPayment && item.status === 'active' && myPayment.payment_status !== 'paid' && (
                <button type="button" className={styles.btnOutline}
                  disabled={busyId === myPayment.id}
                  onClick={() => changeMyExpenseHistory(myPayment, !myPayment.archived_by_player_at)}
                  style={{ fontSize: 11, borderRadius: 8, padding: '7px 12px' }}>
                  {myPayment.archived_by_player_at ? 'Move to Active' : 'Close for Me'}
                </button>
              )}
            </div>}
            {item.status === 'completed' && <p style={{ ...groupPanelCss.small, marginTop: 10 }}>
              Completed expenses are saved in History and cannot be edited.
            </p>}
          </div>}
        </div>
      })}

      </div>
      <div style={{ minWidth: 0 }}>
    <div className={styles.card} style={{ padding: '16px 20px' }}>
      <div className={styles.cardTitle} style={{ marginBottom: 10 }}>Saved Player Groups</div>
      {savedGroups.length === 0 && <div style={{ ...groupPanelCss.small, padding: '10px 0' }}>No saved groups yet. Create one to reuse players for future expenses.</div>}
      {savedGroups.map(group => <div key={group.id}
        style={{ ...groupPanelCss.row, padding: '10px 0', borderBottom: `1px solid ${C.line}` }}>
        <div>
          <strong style={{ fontSize: 13 }}>{group.group_name}</strong>
          <div style={groupPanelCss.small}>
            {(group.expense_saved_group_members || []).length + 1} players including you
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className={styles.btnOutline} style={{ fontSize: 11 }} onClick={() => {
            setGroupName(group.group_name); setEditingGroupId(group.id)
            setPlayers((group.expense_saved_group_members || []).map(p => ({ user_id: p.user_id, player_name: p.player_name })))
            setGroupModal(true)
          }}>Edit</button>
          <button type="button" className={styles.btnOutline} style={{ fontSize: 11 }}
            onClick={() => deleteSavedGroup(group)}>Delete</button>
        </div>
      </div>)}
    </div>
      </div>
    </div>
    {creating && modal(editingExpenseId ? 'Edit Group Expense' : 'Create Group Expense', editingExpenseId ? updateExpense : createExpense, resetForm)}
    {groupModal && modal(editingGroupId ? 'Edit Saved Group' : 'Create Saved Group', saveGroup,
      () => { setGroupModal(false); setEditingGroupId(null); setGroupName(''); setPlayers([]) })}
  </div>
}

// Only group-expense events are shown alongside local budget alerts on the Expenses page.
// Stable reference prevents notification subscriptions from repeatedly reloading.
const GROUP_EXPENSE_NOTIFICATION_TYPES = [
  'group_expense_request',
  'group_expense_accepted',
  'group_expense_declined',
  'group_expense_sent',
  'group_expense_confirmed',
]

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [expenseTab, setExpenseTab] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('tab') === 'group' ? 'group' : 'personal'
  })
  const [currentUserId, setCurrentUserId] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey)
  const [loading, setLoading] = useState(true)
  const showLoader = useLoadingDelay(loading, 350)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [expenseForm, setExpenseForm] = useState(createEmptyExpenseForm)
  const [monthlyBudget, setMonthlyBudget] = useState(0)
  const [hasMonthlyBudget, setHasMonthlyBudget] = useState(false)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [showBudgetAlert, setShowBudgetAlert] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
  const [showAllExpenses, setShowAllExpenses] = useState(false)
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
    setCurrentUserId(user.id)
    // Personal spending includes each accepted group share ONCE. Group shares
    // are read-only projections; they are NOT inserted into public.expenses.
    const [normalResult, groupResult] = await Promise.all([
      supabase.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('group_expenses').select('id,created_by,expense_date,category,title,creator_share,status,group_expense_participants(id,user_id,amount_owed,request_status)')
    ])
    if (normalResult.error) console.error('Personal expense fetch:', normalResult.error)
    if (groupResult.error) console.error('Group share fetch:', groupResult.error)
    const formatted = (normalResult.data || []).map(item => {
      const { dateStr, monthKey } = isoToDisplay(item.date)
      const cat = categoryInfo[item.category] || categoryInfo.Other
      return {
        id: item.id, isoDate: item.date, month: monthKey, date: dateStr,
        category: item.category, desc: item.description || 'No description',
        amount: Number(item.amount), color: cat.badge, source: 'personal',
      }
    })
    for (const group of (groupResult.data || [])) {
      if (group.status === 'cancelled') continue
      const own = group.created_by === user.id
      const share = own ? Number(group.creator_share) :
        (group.group_expense_participants || [])
          .filter(p => p.user_id === user.id && p.request_status === 'accepted')
          .reduce((sum, p) => sum + Number(p.amount_owed), 0)
      if (share <= 0) continue
      const { dateStr, monthKey } = isoToDisplay(group.expense_date)
      const cat = categoryInfo[group.category] || categoryInfo.Other
      formatted.push({
        id: `group-${group.id}`, isoDate: group.expense_date,
        month: monthKey, date: dateStr, category: group.category,
        desc: `${group.title} · Group share`, amount: share,
        color: cat.badge, source: 'group',
      })
    }
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

  const selectedMonthParts = parseMonth(selectedMonth)

  const selectedMonthName = MONTH_NAMES_LONG[selectedMonthParts.monthIdx]

  const selectedYear = selectedMonthParts.year

  const availableYears = Array.from(
    new Set([
      currentYear,
      ...expenses.map(expense => parseMonth(expense.month).year),
      selectedYear,
    ])
  ).sort((a, b) => b - a)

  const handleMonthSelect = monthName => {
    setSelectedMonth(`${monthName} ${selectedYear}`)
  }

  const handleYearSelect = year => {
    setSelectedMonth(`${selectedMonthName} ${Number(year)}`)
  }

  const filteredExpenses = expenses
    .filter(e => e.month === selectedMonth)
    .sort((a, b) => b.isoDate.localeCompare(a.isoDate))
  const dashboardExpenses = filteredExpenses.slice(0, 5)

  const selectedMonthTotal = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const monthly = availableMonths.map(month => ({
    month,
    amt: expenses.filter(e => e.month === month).reduce((s, e) => s + Number(e.amount), 0),
    current: month === selectedMonth,
  }))

  // Compare against the immediately preceding calendar month, including across years.
  // Months without records must not be treated as proof that spending improved.
  const previousMonthDate = new Date(selectedYear, selectedMonthParts.monthIdx - 1, 1)
  const previousMonthName = `${MONTH_NAMES_LONG[previousMonthDate.getMonth()]} ${previousMonthDate.getFullYear()}`
  const previousMonthExpenses = expenses.filter(expense => expense.month === previousMonthName)
  const previousMonthTotal = previousMonthExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  const hasPreviousMonthData = previousMonthExpenses.length > 0
  const hasSelectedMonthData = filteredExpenses.length > 0
  const savedAmount = previousMonthTotal - selectedMonthTotal
  const savedPercent = previousMonthTotal > 0
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
  if (hasMonthlyBudget && selectedMonthTotal > monthlyBudget) budgetStatus = 'Exceeded'
  else if (hasMonthlyBudget && selectedMonthTotal >= monthlyBudget) budgetStatus = 'Reached'
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
  } else if (hasMonthlyBudget && ['Near Limit', 'Reached'].includes(budgetStatus)) {
    expenseNotifications.push({
      key: `budget-near-limit-${selectedMonth}`,
      title: budgetStatus === 'Reached' ? 'Monthly budget reached' : 'Monthly budget almost reached',
      message: `You have used ${budgetUsedPercent}% of your budget for ${selectedMonth}. ${formatRM(
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

  // Transparent, rule-based insights calculated entirely from saved player expenses.
  // No Gemini requests, new tables, or additional personal-data sharing are required.
  const previousCategoryTotals = Object.fromEntries(
    Object.keys(categoryInfo).map(category => [
      category,
      previousMonthExpenses
        .filter(expense => expense.category === category)
        .reduce((sum, expense) => sum + Number(expense.amount), 0),
    ])
  )
  const categoryIncrease = hasPreviousMonthData && hasSelectedMonthData
    ? byCategory
      .map(item => ({ ...item, increase: item.val - (previousCategoryTotals[item.category] || 0) }))
      .filter(item => item.increase > 0)
      .sort((a, b) => b.increase - a.increase)[0] || null
    : null
  const categoryAdvice = {
    Court: 'Consider sharing court rental costs with training partners when practical.',
    Equipment: 'Review whether new equipment is necessary before your next purchase.',
    Shuttlecocks: 'Consider sharing shuttlecock costs with your regular badminton group.',
    Stringing: 'Check your restringing schedule and avoid replacing strings earlier than needed.',
    Transport: 'Consider combining trips or sharing transport when convenient.',
    Other: 'Review the descriptions in this category to identify optional expenses.',
  }
  // Only actionable, non-duplicated recommendations belong here.
  // Trends stay in Monthly Trend; amounts and thresholds stay in Budget Alert.
  const smartInsights = []
  if (!hasSelectedMonthData) {
    smartInsights.push({
      type: 'info',
      title: 'Start tracking your spending',
      text: 'Add an expense to see personalized ways to manage badminton costs.',
    })
  } else {
    if (highestCategory) {
      const adviceTitles = {
        Court: 'Consider sharing court costs',
        Equipment: 'Plan equipment purchases',
        Shuttlecocks: 'Share shuttlecock costs',
        Stringing: 'Review your stringing schedule',
        Transport: 'Reduce transport costs',
        Other: 'Review miscellaneous spending',
      }
      smartInsights.push({
        type: 'info',
        title: adviceTitles[highestCategory.category],
        text: categoryAdvice[highestCategory.category],
      })
    }

    if (categoryIncrease && categoryIncrease.category !== highestCategory?.category) {
      smartInsights.push({
        type: 'warning',
        title: `Review ${categoryIncrease.label.toLowerCase()} expenses`,
        text: `Check whether recent ${categoryIncrease.label.toLowerCase()} costs were necessary before making similar purchases.`,
      })
    } else if (hasMonthlyBudget) {
      smartInsights.push({
        type: budgetStatus === 'Exceeded' || budgetStatus === 'Reached' ? 'warning' : 'info',
        title: budgetStatus === 'Exceeded' || budgetStatus === 'Reached'
          ? 'Prioritize essential training costs'
          : 'Plan upcoming badminton sessions',
        text: budgetStatus === 'Exceeded' || budgetStatus === 'Reached'
          ? 'Review optional purchases and upcoming bookings before adding more expenses.'
          : 'Consider planned sessions and equipment needs before committing to more expenses this month.',
      })
    } else if (!highestCategory || highestCategory.category !== 'Other') {
      smartInsights.push({
        type: 'info',
        title: 'Plan future badminton costs',
        text: 'Estimate upcoming court, transport, and equipment costs before scheduling activities.',
      })
    }
  }
  const visibleSmartInsights = smartInsights.slice(0, 2)

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
    if (budgetStatus === 'Near Limit' || budgetStatus === 'Reached') {
      return `You have used ${budgetUsedPercent}% of your monthly budget. Remaining budget is ${formatRM(remainingBudget)}.`
    }
    return `You are within budget. Remaining budget for ${selectedMonth} is ${formatRM(remainingBudget)}.`
  })()
  const openAddExpense = () => {
    setExpenseForm(createEmptyExpenseForm())
    setShowAddExpense(true)
  }

  const openEditExpense = expense => {
    if (expense.source === 'group') {
      setExpenseTab('group')
      return
    }
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
            <button type="button" className={styles.btnOutline}
              onClick={() => setShowCalculator(true)} title="Open calculator" aria-label="Open expense calculator"
              style={{ minHeight: 38, padding: '0 12px', borderRadius: 9, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="5" y="2" width="14" height="20" rx="3" stroke="currentColor" strokeWidth="1.8" />
                <rect x="8" y="5" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 13h1M14 13h1M9 17h1M14 17h1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
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
              sourceTypes={GROUP_EXPENSE_NOTIFICATION_TYPES}
              includeLocalItems
              localItems={visibleExpenseNotifications}
              onLocalMarkAllRead={markAllExpenseNotificationsRead}
              onLocalClear={clearExpenseNotifications}
              onLocalItemClick={openExpenseNotification}
            />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button type="button" className={expenseTab === 'personal' ? styles.btnPrimary : styles.btnOutline}
          onClick={() => setExpenseTab('personal')} style={{ borderRadius: 9 }}>Personal Expenses</button>
        <button type="button" className={expenseTab === 'group' ? styles.btnPrimary : styles.btnOutline}
          onClick={() => setExpenseTab('group')} style={{ borderRadius: 9 }}>Group Expenses</button>
      </div>
      {expenseTab === 'group' && <GroupExpenseManager currentUserId={currentUserId} onGroupChanged={fetchExpenses} />}
      {expenseTab === 'personal' && <>
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
        <div className={styles.metric}
          role="button"
          tabIndex={0}
          aria-label="Open monthly budget alert"
          onClick={() => setShowBudgetAlert(true)}
          onKeyDown={event => {
            if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault()
              setShowBudgetAlert(true)
            }
          }}
          style={{ cursor: 'pointer' }}>
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
              color: !hasMonthlyBudget ? '#1A5FFF' : budgetStatus === 'Exceeded' ? '#DC2626' : ['Near Limit', 'Reached'].includes(budgetStatus) ? '#D97706' : '#059669',
              WebkitTextFillColor: !hasMonthlyBudget ? '#1A5FFF' : budgetStatus === 'Exceeded' ? '#DC2626' : ['Near Limit', 'Reached'].includes(budgetStatus) ? '#D97706' : '#059669',
            }}
          >
            {hasMonthlyBudget
              ? formatRMNoDecimal(Math.abs(remainingBudget))
              : 'Not set'}
          </div>
          <div className={styles.metricLbl}>
            {hasMonthlyBudget && remainingBudget < 0 ? 'Over budget' : 'Remaining budget'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: 10 }}>
            <button
              type="button"
              className={styles.btnOutline}
              style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8, color: '#1A5FFF', borderColor: '#B9CAFD', fontWeight: 700 }}
              onClick={event => { event.stopPropagation(); setShowBudgetAlert(true) }}
            >
              View Budget
            </button>
            <button
              type="button"
              className={styles.btnOutline}
              style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8, color: '#1A5FFF', borderColor: '#B9CAFD', fontWeight: 700 }}
              onClick={event => { event.stopPropagation(); setShowBudgetModal(true) }}
            >
              {hasMonthlyBudget ? 'Edit Budget' : 'Set Budget'}
            </button>
          </div>
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
      <div
        className={styles.g2}
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          minWidth: 0,
          width: '100%',
        }}
      >
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
                      fontWeight: 700,
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
                <button
                  type="button"
                  onClick={() => {
                    if (filteredExpenses.length > 0) {
                      setShowAllExpenses(true)
                    }
                  }}
                  disabled={filteredExpenses.length === 0}
                  style={{
                    margin: 0,
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: filteredExpenses.length > 0 ? 'pointer' : 'default',
                  }}
                  title={
                    filteredExpenses.length > 0
                      ? `View all expenses for ${selectedMonth}`
                      : 'No expenses to view'
                  }
                >
                  <div
                    className={styles.cardTitle}
                    style={{
                      marginBottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                    }}
                  >
                    Expense log — {selectedMonth}
                  </div>
                </button>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                }}
              >
                <select
                  className={styles.formSelect}
                  value={selectedMonthName}
                  onChange={e => handleMonthSelect(e.target.value)}
                  aria-label="Select expense month"
                  style={{ width: 128 }}
                >
                  {MONTH_NAMES_LONG.map(month => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
                <select
                  className={styles.formSelect}
                  value={selectedYear}
                  onChange={e => handleYearSelect(e.target.value)}
                  aria-label="Select expense year"
                  style={{ width: 96 }}
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {filteredExpenses.length === 0 ? (
              <div style={{ textAlign: 'center', color: C.muted, padding: 20, fontSize: 13 }}>
                No expenses recorded for this month.
              </div>
            ) : (
              dashboardExpenses.map(expense => (
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
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span className={getCategoryBadgeClass(expense.color)}>
                        {expense.category}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                        {expense.desc}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      {formatRM(expense.amount)}
                    </span>
                    {expense.source !== 'group' && pencilIcon}
                  </div>
                </div>
              ))
            )}
            <div style={{ borderTop: `2px solid ${C.line}`, marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Total</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>
                {formatRM(selectedMonthTotal)}
              </span>
            </div>
          </div>
        </div>
        <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          minWidth: 0,
          width: '100%',
        }}
      >
          <div className={styles.card}>
            <div className={styles.cardTitle}>Monthly trend</div>
            <div
              style={{
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <MonthlyTrendLineChart monthly={monthly} />
            </div>
            <div
              style={{
                marginTop: 12,
                padding: 10,
                background: hasSelectedMonthData && hasPreviousMonthData
                  ? savedAmount > 0 ? '#E0FAF3' : savedAmount < 0 ? '#FEF3C7' : C.soft
                  : C.soft,
                borderRadius: 10,
                fontSize: 12,
                color: hasSelectedMonthData && hasPreviousMonthData
                  ? savedAmount > 0 ? '#00976C' : savedAmount < 0 ? '#92400E' : C.muted
                  : C.muted,
                fontWeight: 600,
              }}
            >
              {!hasSelectedMonthData
                ? `No expenses recorded for ${selectedMonth}. A spending reduction cannot be confirmed.`
                : !hasPreviousMonthData
                  ? `No recorded expenses for ${previousMonthName} to compare against.`
                  : savedAmount > 0
                    ? `↓ ${savedPercent}% lower recorded spending than ${previousMonthName} (${formatRM(savedAmount)} less).`
                    : savedAmount < 0
                      ? `↑ ${savedPercent}% higher recorded spending than ${previousMonthName} (${formatRM(Math.abs(savedAmount))} more).`
                      : `Recorded spending is unchanged from ${previousMonthName}.`}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden="true" style={{ color: '#1A5FFF' }}>✦</span>
              Smart Spending Insights
            </div>
            <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
              Practical tips based on your recorded expenses
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {visibleSmartInsights.map((insight, index) => {
                const meta = getSuggestionMeta(insight.type)
                return (
                  <div key={`${insight.title}-${index}`} style={{ display: 'flex', gap: 10, padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 10, background: C.card }}>
                    <span style={{ width: 26, height: 26, borderRadius: 8, background: meta.background, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                      <ExpenseIcon type={meta.icon} color={meta.color} size={15} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: C.text, fontSize: 13, marginBottom: 4 }}>{insight.title}</div>
                      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55 }}>{insight.text}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
      </>}
      {showAllExpenses && (
        <div
          className={styles.modalOverlay}
          onClick={event =>
            event.target === event.currentTarget &&
            setShowAllExpenses(false)
          }
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 720,
              width: 'min(92vw, 720px)',
              maxHeight: '84vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div className={styles.modalHead}>
              <div>
                <div className={styles.modalTitle}>
                  All Expenses — {selectedMonth}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: C.muted,
                  }}
                >
                  {filteredExpenses.length} expense
                  {filteredExpenses.length === 1 ? '' : 's'} ·{' '}
                  {formatRM(selectedMonthTotal)}
                </div>
              </div>
              <button
                className={styles.modalClose}
                onClick={() => setShowAllExpenses(false)}
              >
                ✕
              </button>
            </div>
            <div style={{ overflowY: 'auto', paddingRight: 2 }}>
              {filteredExpenses.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    textAlign: 'center',
                    color: C.muted,
                    fontSize: 13,
                  }}
                >
                  No expenses recorded for this month.
                </div>
              ) : (
                filteredExpenses.map(expense => (
                  <button
                    key={expense.id}
                    type="button"
                    onClick={() => {
                      setShowAllExpenses(false)
                      openEditExpense(expense)
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 4px',
                      border: 'none',
                      borderBottom: `1px solid ${C.line}`,
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        flexShrink: 0,
                        fontSize: 11,
                        fontWeight: 700,
                        color: C.muted,
                      }}
                    >
                      {expense.date}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
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
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {expense.desc}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        flexShrink: 0,
                        fontSize: 13,
                        fontWeight: 700,
                        color: C.text,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatRM(expense.amount)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {showBudgetAlert && (
        <div className={styles.modalOverlay}
          onClick={event => event.target === event.currentTarget && setShowBudgetAlert(false)}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Budget Alert for ${selectedMonth}`}
            style={{ width: 'min(94vw, 780px)', maxWidth: 780, maxHeight: '86vh', overflowY: 'auto' }}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Monthly Budget — {selectedMonth}</div>
              <button type="button" className={styles.modalClose} aria-label="Close budget alert"
                onClick={() => setShowBudgetAlert(false)}>✕</button>
            </div>
          <div
            className={styles.card}
            style={{
              background: C.card,
              border:
                budgetStatus === 'Exceeded'
                  ? '1.5px solid #EF4444'
                  : (budgetStatus === 'Near Limit' || budgetStatus === 'Reached')
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
                    : (budgetStatus === 'Near Limit' || budgetStatus === 'Reached')
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
            {hasMonthlyBudget && (
              <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 11, background: 'color-mix(in srgb, #E8EEF8 70%, var(--card, #FFFFFF))', border: `1px solid ${C.line}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Monthly budget progress</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: budgetStatus === 'Exceeded' ? '#EF4444' : (budgetStatus === 'Near Limit' || budgetStatus === 'Reached') ? '#D97706' : '#059669' }}>
                    {budgetUsedPercent}% used
                  </span>
                </div>
                <div role="progressbar" aria-label="Monthly budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, budgetUsedPercent)} style={{ height: 9, background: '#DDE5F2', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, budgetUsedPercent))}%`, height: '100%', borderRadius: 999, background: budgetStatus === 'Exceeded' ? '#EF4444' : (budgetStatus === 'Near Limit' || budgetStatus === 'Reached') ? '#F59E0B' : '#10B981', transition: 'width 0.2s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 8, color: C.muted, fontSize: 12 }}>
                  <span>{formatRM(selectedMonthTotal)} spent</span>
                  <span>{remainingBudget >= 0 ? `${formatRM(remainingBudget)} remaining` : `${formatRM(Math.abs(remainingBudget))} over budget`}</span>
                </div>
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Status</span>
                <span className={styles.statVal}>
                  <span
                    className={
                      budgetStatus === 'Exceeded'
                        ? styles.badgeRed
                        : (budgetStatus === 'Near Limit' || budgetStatus === 'Reached')
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
          </div>
          </div>
        </div>
      )}
      {showCalculator && <ExpenseCalculator onClose={() => setShowCalculator(false)} />}
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