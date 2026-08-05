import { useEffect, useMemo, useRef } from 'react'
import {
  Chart,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js'

Chart.register(
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
)

const normaliseCoachValues = (skills, coachSkills) => {
  if (!Array.isArray(coachSkills) || coachSkills.length === 0) {
    return []
  }

  const coachMap = new Map(
    coachSkills.map(skill => [
      String(skill.name || '').toLowerCase(),
      Number(skill.val),
    ])
  )

  return skills.map(skill => {
    const value = coachMap.get(
      String(skill.name || '').toLowerCase()
    )

    return Number.isFinite(value) ? value : null
  })
}

export default function SkillRadarChart({
  skills = [],
  coachSkills = [],
}) {
  const radarRef = useRef(null)
  const chartRef = useRef(null)

  const coachValues = useMemo(
    () => normaliseCoachValues(skills, coachSkills),
    [skills, coachSkills]
  )

  const hasCoachAssessment = coachValues.some(
    value => Number.isFinite(value)
  )

  useEffect(() => {
    if (!radarRef.current || skills.length === 0) return undefined

    if (chartRef.current) {
      chartRef.current.destroy()
    }

    const datasets = [
      {
        label: 'Player assessment',
        data: skills.map(skill => Number(skill.val) || 0),
        backgroundColor: 'rgba(26, 95, 255, 0.12)',
        borderColor: '#1A5FFF',
        borderWidth: 2.5,
        pointBackgroundColor: skills.map(skill =>
          skill.low ? '#F59E0B' : '#1A5FFF'
        ),
        pointBorderColor: skills.map(skill =>
          skill.low ? '#D97706' : '#1240CC'
        ),
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        spanGaps: true,
      },
    ]

    if (hasCoachAssessment) {
      datasets.push({
        label: 'Coach assessment',
        data: coachValues,
        backgroundColor: 'rgba(124, 58, 237, 0.035)',
        borderColor: '#7C3AED',
        borderWidth: 2.5,
        borderDash: [7, 5],
        pointBackgroundColor: '#7C3AED',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        pointRadius: 4.5,
        pointHoverRadius: 7,
        fill: false,
        spanGaps: true,
      })
    }

    chartRef.current = new Chart(radarRef.current, {
      type: 'radar',
      data: {
        labels: skills.map(skill => skill.name),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          intersect: false,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: context => {
                const value = context.raw

                if (value === null || value === undefined) {
                  return `${context.dataset.label}: Not assessed`
                }

                return `${context.dataset.label}: ${value}/100`
              },
            },
          },
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            beginAtZero: true,
            ticks: {
              stepSize: 25,
              backdropColor: 'transparent',
              color: '#8892A4',
              font: {
                size: 10,
              },
            },
            grid: {
              color: 'rgba(136,146,164,0.2)',
            },
            angleLines: {
              color: 'rgba(136,146,164,0.25)',
            },
            pointLabels: {
              color: '#0D1B3E',
              font: {
                size: 12,
                weight: '600',
              },
            },
          },
        },
      },
    })

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [skills, coachValues, hasCoachAssessment])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 260,
      }}
    >
      <canvas ref={radarRef} />
    </div>
  )
}