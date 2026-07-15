export const ALL_PLAYERS = [
  { id: 1, name: 'Adeline', club: 'Penang BC', level: 'Advanced', style: 'Aggressive', smash: 82, defense: 70, footwork: 78, net: 72, serve: 68, stamina: 75, assigned: true },
  { id: 2, name: 'Yee En', club: 'Seberang BC', level: 'Intermediate', style: 'Defensive', smash: 65, defense: 80, footwork: 70, net: 76, serve: 64, stamina: 68, assigned: true },
  { id: 3, name: 'JetHow', club: 'Penang BC', level: 'Advanced', style: 'All-round', smash: 78, defense: 75, footwork: 80, net: 74, serve: 72, stamina: 80, assigned: true },
  { id: 4, name: 'Syafiq Yusuf', club: 'USM BC', level: 'Intermediate', style: 'Attacking', smash: 74, defense: 60, footwork: 68, net: 62, serve: 60, stamina: 64, assigned: false },
  { id: 5, name: 'Farid Noor', club: 'Penang BC', level: 'Beginner', style: 'Defensive', smash: 50, defense: 65, footwork: 55, net: 58, serve: 52, stamina: 60, assigned: false },
  { id: 6, name: 'Hafiz Rahman', club: 'Kedah BC', level: 'Advanced', style: 'Aggressive', smash: 88, defense: 68, footwork: 82, net: 70, serve: 74, stamina: 78, assigned: false },
  { id: 7, name: 'Nurul Izzah', club: 'KL Badminton', level: 'Intermediate', style: 'Defensive', smash: 60, defense: 84, footwork: 70, net: 78, serve: 66, stamina: 72, assigned: false },
]

export const INIT_SESSIONS = [
  { id: 1, date: '2026-05-05', time: '07:00', venue: 'Dewan Sukan USM', type: 'Footwork Drills', players: [1, 2, 3], notes: 'Focus on back court movement' },
  { id: 2, date: '2026-05-07', time: '18:00', venue: 'Kompleks Sukan', type: 'Match Practice', players: [1, 3], notes: 'Singles practice sets' },
  { id: 3, date: '2026-05-10', time: '07:00', venue: 'Dewan Sukan USM', type: 'Smash Training', players: [1, 2, 3], notes: 'Jump smash technique' },
]

export const INIT_NOTES = [
  { id: 1, playerId: 1, date: '28 Apr', text: 'Adeline shows great improvement in back court smash. Needs to work on net play consistency.' },
  { id: 2, playerId: 2, date: '25 Apr', text: 'Yee En defense is solid. Encourage more aggressive attacking opportunities.' },
  { id: 3, playerId: 3, date: '22 Apr', text: 'JetHow is the most balanced player. Ready to compete at state level.' },
]

export const SESSION_TYPES = [
  'Footwork Drills',
  'Smash Training',
  'Defense Drills',
  'Match Practice',
  'Net Play',
  'Fitness & Conditioning',
  'Strategy Session',
]

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function averageSkill(player) {
  return Math.round(
    (
      player.smash +
      player.footwork +
      player.defense +
      player.net +
      player.serve +
      player.stamina
    ) / 6
  )
}

export function getSkillList(player) {
  return [
    { label: 'Smash', val: player.smash },
    { label: 'Footwork', val: player.footwork },
    { label: 'Defense', val: player.defense },
    { label: 'Net play', val: player.net },
    { label: 'Serve', val: player.serve },
    { label: 'Stamina', val: player.stamina },
  ]
}
