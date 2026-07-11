import { useEffect, useState } from 'react'
import { formatOpensIn } from '#/lib/game'

interface OpensInProps {
  opensAt: number
}

/**
 * Live countdown until a scheduled lobby opens ("2h 05m"), ticking
 * every 15 seconds. Used by the group game panel and the pinned chat
 * banner.
 */
export default function OpensIn({ opensAt }: OpensInProps) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((count) => count + 1), 15000)
    return () => clearInterval(interval)
  }, [])

  return <>{formatOpensIn(opensAt)}</>
}
