import { createContext, useContext, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import {
  ALL_PLAYERS,
  INIT_NOTES,
  INIT_SESSIONS,
  SESSION_TYPES,
} from './coachData'

const CoachContext = createContext(null)

export function CoachProvider() {
  const [players, setPlayers] = useState(ALL_PLAYERS)
  const [sessions, setSessions] = useState(INIT_SESSIONS)
  const [notes, setNotes] = useState(INIT_NOTES)

  const addToTeam = playerId => {
    setPlayers(current =>
      current.map(player =>
        player.id === playerId ? { ...player, assigned: true } : player
      )
    )
  }

  const removeFromTeam = playerId => {
    setPlayers(current =>
      current.map(player =>
        player.id === playerId ? { ...player, assigned: false } : player
      )
    )
  }

  const addCoachNote = (playerId, text) => {
    const cleanText = text.trim()
    if (!cleanText) return false

    setNotes(current => [
      {
        id: Date.now(),
        playerId,
        date: new Date().toLocaleDateString('en-MY', {
          day: 'numeric',
          month: 'short',
        }),
        text: cleanText,
      },
      ...current,
    ])

    return true
  }

  const addSession = form => {
    if (!form.date || !form.venue) return false

    setSessions(current => [
      {
        id: Date.now(),
        ...form,
      },
      ...current,
    ])

    return true
  }

  const myPlayers = useMemo(
    () => players.filter(player => player.assigned),
    [players]
  )

  const upcomingSessions = useMemo(
    () =>
      sessions
        .filter(session => new Date(session.date) >= new Date())
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [sessions]
  )

  const pastSessions = useMemo(
    () =>
      sessions
        .filter(session => new Date(session.date) < new Date())
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [sessions]
  )

  const value = {
    players,
    sessions,
    notes,
    myPlayers,
    upcomingSessions,
    pastSessions,
    sessionTypes: SESSION_TYPES,
    addToTeam,
    removeFromTeam,
    addCoachNote,
    addSession,
  }

  return (
    <CoachContext.Provider value={value}>
      <Outlet />
    </CoachContext.Provider>
  )
}

export function useCoach() {
  const context = useContext(CoachContext)

  if (!context) {
    throw new Error('useCoach must be used inside CoachProvider.')
  }

  return context
}
