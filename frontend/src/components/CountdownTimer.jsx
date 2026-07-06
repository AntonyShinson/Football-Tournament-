import { useEffect, useState } from 'react';
import { minutesRemaining } from '../lib/matchState.js';

/** Shows "23 min left to respond" for a match pending confirmation, ticking down live. */
export default function CountdownTimer({ match }) {
  const [mins, setMins] = useState(() => minutesRemaining(match));

  useEffect(() => {
    const id = setInterval(() => setMins(minutesRemaining(match)), 15000);
    return () => clearInterval(id);
  }, [match]);

  if (match.status !== 'pending_confirmation') return null;

  return (
    <span className="badge badge-amber">
      {mins > 0 ? `${mins} min left to respond` : 'Auto-confirming…'}
    </span>
  );
}
