import { useEffect, useRef } from 'react'
import {
  Chart,
  PieController,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'

Chart.register(PieController, ArcElement, Tooltip, Legend)

export default function ExpensePieChart({ expenses }) {
  const pieRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!pieRef.current) return

    if (chartRef.current) {
      chartRef.current.destroy()
    }

    chartRef.current = new Chart(pieRef.current, {
      type: 'pie',
      data: {
        labels: expenses.map((e) => e.label),
        datasets: [
          {
            data: expenses.map((e) => e.val),
            backgroundColor: expenses.map((e) => e.color),
            borderColor: '#ffffff',
            borderWidth: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#0D1B3E',
              font: {
                size: 11,
                weight: '600',
              },
              padding: 14,
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.label || ''
                const value = context.raw || 0
                return `${label}: RM ${value}.00`
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
  }, [expenses])

  return (
    <div style={{ position: 'relative', width: '100%', height: 260 }}>
      <canvas ref={pieRef} />
    </div>
  )
}