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
    const isMobile = window.innerWidth <= 768
    chartInstance.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: monthly.map((m) => m.month.replace(/\s\d{4}$/, '')),
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
            pointRadius: isMobile ? 4 : 5,
            pointHoverRadius: 7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index',
        },
        layout: {
          padding: {
            left: 4,
            right: 8,
            top: 6,
            bottom: 0,
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label(context) {
                return `RM ${Number(context.raw || 0).toFixed(2)}`
              },
            },
          },
        },
        scales: {
          x: {
            offset: true,
            grid: {
              display: false,
            },
            ticks: {
              color: '#8892A4',
              autoSkip: true,
              maxTicksLimit: isMobile ? 6 : 12,
              maxRotation: 0,
              minRotation: 0,
              padding: 6,
              font: {
                size: isMobile ? 9 : 11,
                weight: '600',
              },
              callback(value) {
                const label = this.getLabelForValue(value)
                if (!isMobile) {
                  return label
                }
                return String(label).slice(0, 3)
              },
            },
          },
          y: {
            beginAtZero: true,
            suggestedMax: 100,
            ticks: {
              stepSize: 20,
              color: '#8892A4',
              padding: 4,
              font: {
                size: isMobile ? 9 : 11,
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
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        height: 220,
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={chartRef}
        style={{
          width: '100%',
          maxWidth: '100%',
        }}
      />
    </div>
  )
}