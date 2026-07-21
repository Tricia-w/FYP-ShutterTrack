import { useEffect, useRef } from 'react'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
} from 'chart.js'

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler
)

export default function MonthlyTrendLineChart({ monthly }) {
  const chartRef = useRef(null)
  const chartInstance = useRef(null)

  useEffect(() => {
    if (!chartRef.current) return

    if (chartInstance.current) {
      chartInstance.current.destroy()
    }

    chartInstance.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: monthly.map((m) => m.month.replace(' 2026', '')),
        datasets: [
          {
            label: 'Monthly Spending',
            data: monthly.map((m) => m.amt),
            borderColor: '#1A5FFF',
            backgroundColor: 'rgba(26, 95, 255, 0.12)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: monthly.map((m) =>
              m.current ? '#F59E0B' : '#1A5FFF'
            ),
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
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
          tooltip: {
            callbacks: {
              label(context) {
                return `RM ${context.raw}.00`
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: '#8892A4',
              font: {
                size: 11,
                weight: '600',
              },
            },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: '#8892A4',
              font: {
                size: 11,
              },
              callback(value) {
                return `RM ${value}`
              },
            },
            grid: {
              color: 'rgba(136,146,164,0.2)',
            },
          },
        },
      },
    })

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy()
        chartInstance.current = null
      }
    }
  }, [monthly])

  return (
    <div style={{ position: 'relative', width: '100%', height: 220 }}>
      <canvas ref={chartRef} />
    </div>
  )
}