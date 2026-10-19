import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AccountDeletionApprovalModal({ userId }) {
  const [approvedRequest, setApprovedRequest] = useState(null)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const requestSerial = useRef(0)

  const refreshApproval = useCallback(async () => {
    if (!userId) {
      setApprovedRequest(null)
      return
    }

    const serial = ++requestSerial.current
    setChecking(true)
    try {
      const { data, error } = await supabase
        .from('account_deletion_requests')
        .select('id, status, user_confirmed_at, scheduled_delete_at')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .is('user_confirmed_at', null)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      if (serial === requestSerial.current) {
        setApprovedRequest(data || null)
        setErrorMessage('')
      }
    } catch (error) {
      console.error('Account deletion approval check failed:', error)
      // Keep an already-open prompt in place when a refresh fails.
    } finally {
      if (serial === requestSerial.current) setChecking(false)
    }
  }, [userId])

  useEffect(() => {
    requestSerial.current += 1
    setApprovedRequest(null)
    setErrorMessage('')
    if (!userId) return undefined

    refreshApproval()

    const channel = supabase
      .channel(`layout-deletion-approval-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'account_deletion_requests',
          filter: `user_id=eq.${userId}`,
        },
        () => { refreshApproval() }
      )
      .subscribe()

    // Recheck after missed Realtime events, such as when a browser sleeps.
    const checkOnReturn = () => {
      if (document.visibilityState === 'visible') refreshApproval()
    }
    const checkOnFocus = () => refreshApproval()
    document.addEventListener('visibilitychange', checkOnReturn)
    window.addEventListener('focus', checkOnFocus)

    return () => {
      requestSerial.current += 1
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', checkOnReturn)
      window.removeEventListener('focus', checkOnFocus)
    }
  }, [userId, refreshApproval])

  const decide = async (keepAccount) => {
    if (!approvedRequest?.id || busy || checking) return
    setBusy(true)
    setErrorMessage('')
    try {
      const rpcName = keepAccount
        ? 'cancel_account_deletion'
        : 'confirm_account_deletion'
      const { error } = await supabase.rpc(rpcName, {
        p_request_id: approvedRequest.id,
      })
      if (error) throw error

      // Close immediately on success. The database remains the source of truth.
      setApprovedRequest(null)
      if (!keepAccount) {
        window.alert(
          'Deletion confirmed. Your account is scheduled for permanent deletion 24 hours from now.'
        )
      } else {
        window.alert('Account deletion cancelled. Your account remains active.')
      }
      await refreshApproval()
    } catch (error) {
      console.error('Account deletion decision failed:', error)
      setErrorMessage(error?.message || 'Unable to process your decision. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!userId || !approvedRequest) return null

  const buttonStyle = {
    padding: '11px 15px',
    borderRadius: 9,
    border: '1px solid #CBD5E1',
    fontSize: 14,
    fontWeight: 700,
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.65 : 1,
  }

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        background: 'rgba(15, 23, 42, 0.65)',
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="deletion-approval-heading"
        aria-describedby="deletion-approval-description"
        style={{
          width: '100%',
          maxWidth: 500,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
          background: 'var(--card, #FFFFFF)',
          color: 'var(--text, #172033)',
          border: '1px solid var(--line, #DDE3EF)',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 20px 70px rgba(0,0,0,0.25)',
        }}
      >
        <h2 id="deletion-approval-heading" style={{ fontSize: 20, margin: '0 0 12px' }}>
          Account Deletion Approved
        </h2>
        <p id="deletion-approval-description" style={{ lineHeight: 1.6 }}>
          Your account deletion request has been approved. Please confirm whether
          you still want to permanently delete your account.
        </p>
        <div style={{
          marginTop: 12, padding: '11px 13px', borderRadius: 10,
          background: '#FFFBEB', border: '1px solid #FDE68A',
          color: '#92400E', fontSize: 13, lineHeight: 1.6,
        }}>
          If you confirm, your account will be scheduled for permanent deletion
          24 hours later. If you choose to keep your account, your deletion
          request will be cancelled.
        </div>
        {errorMessage && (
          <p role="alert" style={{ color: '#DC2626', lineHeight: 1.5 }}>
            {errorMessage}
          </p>
        )}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 9,
          flexWrap: 'wrap', marginTop: 20,
        }}>
          <button
            type="button"
            disabled={busy || checking}
            onClick={() => decide(true)}
            style={{ ...buttonStyle, background: 'var(--card, #FFFFFF)', color: 'var(--text, #172033)' }}
          >
            No, Keep My Account
          </button>
          <button
            type="button"
            disabled={busy || checking}
            onClick={() => decide(false)}
            style={{ ...buttonStyle, borderColor: '#E11D48', background: '#E11D48', color: '#FFFFFF' }}
          >
            {busy ? 'Processing...' : 'Yes, Confirm Deletion'}
          </button>
        </div>
      </div>
    </div>
  )
}