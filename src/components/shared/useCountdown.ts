import { useEffect, useState } from 'react';
import { formatCountdown } from '../../firebase/liveSession';

// Local 1-second countdown against a shared `endsAt` timestamp. Every client
// derives the remaining time itself — nothing is written to Firestore per tick.
export function useCountdown(endsAt: number | null): {
  msRemaining: number;
  expired: boolean;
  label: string;
} {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt == null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const msRemaining = endsAt == null ? 0 : Math.max(0, endsAt - now);
  return {
    msRemaining,
    expired: endsAt != null && msRemaining <= 0,
    label: formatCountdown(msRemaining),
  };
}
