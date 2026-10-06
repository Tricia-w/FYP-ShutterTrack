export default function FitnessIndicators({
  indicators = [],
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 12,
      }}
    >
      {indicators.map(item => {
        const value = Math.max(
          0,
          Math.min(100, Number(item?.val) || 0)
        )

        return (
          <div key={item.name}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 6,
              }}
            >
              <span style={{ fontWeight: 700 }}>
                {item.name}
              </span>

              <span style={{ fontWeight: 700 }}>
                {Math.round(value)} / 100
              </span>
            </div>

            <div
              style={{
                height: 8,
                overflow: 'hidden',
                borderRadius: 999,
                background: 'var(--soft, #EEF1F8)',
              }}
            >
              <div
                style={{
                  width: `${value}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: 'var(--blue, #1A5FFF)',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
