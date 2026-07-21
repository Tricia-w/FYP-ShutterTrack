import { useEffect, useRef } from 'react'
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

export default function SkillRadarChart({ skills }) {
  const radarRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!radarRef.current) return

    if (chartRef.current) {
      chartRef.current.destroy()
    }

    chartRef.current = new Chart(radarRef.current, {
      type: 'radar',
      data: {
        labels: skills.map((s) => s.name),
        datasets: [
          {
            label: 'Skills',
            data: skills.map((s) => s.val),
            backgroundColor: 'rgba(26, 95, 255, 0.12)',
            borderColor: '#1A5FFF',
            borderWidth: 2,
            pointBackgroundColor: skills.map((s) =>
              s.low ? '#F59E0B' : '#1A5FFF'
            ),
            pointBorderColor: skills.map((s) =>
              s.low ? '#D97706' : '#1240CC'
            ),
            pointRadius: 5,
            pointHoverRadius: 7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          r: {
            min: 0,
            max: 100,
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
  }, [skills])

  return (
    <div style={{ position: 'relative', width: '100%', height: 260 }}>
      <canvas ref={radarRef} />
    </div>
  )
}