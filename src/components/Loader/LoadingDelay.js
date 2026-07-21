import { useEffect, useState } from 'react'

export default function useLoadingDelay(
  loading,
  delay = 350
) {
  const [showLoading, setShowLoading] = useState(false)

  useEffect(() => {
    let timer

    if (loading) {
      timer = window.setTimeout(() => {
        setShowLoading(true)
      }, delay)
    } else {
      setShowLoading(false)
    }

    return () => {
      if (timer) {
        window.clearTimeout(timer)
      }
    }
  }, [loading, delay])

  return showLoading
}