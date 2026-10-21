import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const isValidToken = value => /^[0-9a-f]{64}$/i.test(value || '')

const scopeLabel = scope => {
  if (scope === 'player') return 'Player role only'
  if (scope === 'coach') return 'Coach role only'
  if (scope === 'both' || scope === null) return 'Entire ShuttleTracker account'
  return 'Account deletion request'
}

const pageStyle = {
  minHeight: '100vh',
  padding: '44px 16px',
  boxSizing: 'border-box',
  background: '#F3F6FB',
  fontFamily: 'DM Sans, Arial, sans-serif',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

export default function ConfirmDeletion() {
  const location = useLocation()
  const tokenRef = useRef(null)
  if (tokenRef.current === null) {
    tokenRef.current = new URLSearchParams(location.search).get('token') || ''
  }
  const token = tokenRef.current
  const [status, setStatus] = useState(isValidToken(token) ? 'loading' : 'invalid')
  const [scope, setScope] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    // Do not keep the sensitive email token in the address bar or history.
    if (location.search && window.history.replaceState) {
      window.history.replaceState(window.history.state, '', location.pathname)
    }
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!isValidToken(token)) return undefined
    let active = true
    const preview = async () => {
      try {
        // Requires the confirm-deletion-email Edge Function to support preview.
        const { data, error: fnError } = await supabase.functions.invoke(
          'confirm-deletion-email',
          { body: { action: 'preview', token } }
        )
        if (!active) return
        if (fnError) throw fnError
        if (!data?.valid) {
          setStatus('invalid')
          return
        }
        setScope(data.deletion_scope ?? 'both')
        setStatus('ready')
      } catch (err) {
        if (!active) return
        console.error('Deletion link preview failed:', err)
        setError('Unable to verify this link right now. Please try again later.')
        setStatus('error')
      }
    }
    preview()
    return () => { active = false }
  }, [token])

  const confirm = async () => {
    if (status !== 'ready') return
    setError('')
    setStatus('submitting')
    try {
      // Only the server-side Edge Function can call the privileged confirmation RPC.
      const { data, error: fnError } = await supabase.functions.invoke(
        'confirm-deletion-email',
        { body: { action: 'confirm', token } }
      )
      if (fnError) throw fnError
      if (data?.success !== true) {
        setStatus('invalid')
        return
      }
      setStatus('success')
      tokenRef.current = ''
    } catch (err) {
      console.error('Deletion confirmation failed:', err)
      setError('Unable to confirm deletion. Please try again later.')
      setStatus('ready')
    }
  }

  const button = {
    display: 'inline-block', border: 0, borderRadius: 9,
    padding: '13px 20px', fontSize: 14, fontWeight: 700,
    fontFamily: 'inherit', textDecoration: 'none', cursor: 'pointer',
  }

  return (
    <main style={pageStyle}>
      <div style={{ width: '100%', maxWidth: 540, borderRadius: 17, overflow: 'hidden', background: '#FFFFFF', boxShadow: '0 12px 45px rgba(13,27,62,.10)' }}>
        <header style={{ background: '#0D1B3E', padding: '29px 30px', textAlign: 'center' }}>
          <div style={{ color: '#FFFFFF', fontSize: 27, fontWeight: 800 }}>ShuttleTracker</div>
          <div style={{ color: '#B9C9ED', fontSize: 12, marginTop: 8 }}>
            Badminton Management &amp; Performance Monitoring
          </div>
        </header>
        <section style={{ padding: '32px 30px 36px', color: '#0D1B3E' }}>
          <h1 style={{ fontSize: 24, lineHeight: 1.3, margin: '0 0 18px' }}>
            {status === 'success' ? 'Deletion Scheduled' : 'Confirm Account Deletion'}
          </h1>
          {status === 'loading' && <p role="status">Checking your secure confirmation link…</p>}
          {status === 'invalid' && (
            <p role="alert" style={{ color: '#B91C1C', lineHeight: 1.7 }}>
              This link has expired, has already been used, or is no longer valid. Your deletion has not been confirmed by this page.
            </p>
          )}
          {status === 'error' && (
            <p role="alert" style={{ color: '#B91C1C', lineHeight: 1.7 }}>{error}</p>
          )}
          {(status === 'ready' || status === 'submitting') && (
            <>
              <p style={{ color: '#475569', lineHeight: 1.7 }}>
                Your account deletion request was approved. Please review what will be deleted before confirming.
              </p>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 11, padding: '15px 17px', margin: '18px 0' }}>
                <div style={{ color: '#64748B', fontSize: 12, marginBottom: 6 }}>Deletion choice</div>
                <strong>{scopeLabel(scope)}</strong>
              </div>
              <p style={{ color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 11, padding: '14px', lineHeight: 1.65, fontSize: 13 }}>
                Clicking Confirm Deletion starts the 24-hour waiting period. You can revoke your request from Settings before processing begins.
              </p>
              {error && <p role="alert" style={{ color: '#B91C1C' }}>{error}</p>}
              <button type="button" onClick={confirm} disabled={status === 'submitting'} style={{ ...button, background: '#E11D48', color: '#FFFFFF', marginTop: 9, opacity: status === 'submitting' ? 0.6 : 1 }}>
                {status === 'submitting' ? 'Confirming…' : 'Confirm Deletion'}
              </button>
            </>
          )}
          {status === 'success' && (
            <>
              <p role="status" style={{ color: '#166534', lineHeight: 1.7 }}>
                Your deletion request has been confirmed. The 24-hour waiting period has started.
              </p>
              <p style={{ color: '#475569', lineHeight: 1.7 }}>
                Changed your mind? Sign in and choose <strong>Revoke Deletion Request</strong> in Settings before processing begins.
              </p>
            </>
          )}
          {status !== 'loading' && (
            <div style={{ marginTop: 22 }}>
              <Link to="/login" style={{ ...button, border: '1px solid #CBD5E1', color: '#0D1B3E', background: '#FFFFFF' }}>
                Go to ShuttleTracker
              </Link>
            </div>
          )}
          <div style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid #E2E8F0', fontSize: 12, color: '#94A3B8' }}>
            ShuttleTracker · Account Security
          </div>
        </section>
      </div>
    </main>
  )
}