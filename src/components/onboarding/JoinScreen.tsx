import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db, firebaseConfigured } from '../../firebase/config';
import { getClassDoc } from '../../firebase/classSettings';
import { useApp } from '../../store/appContext';
import { uuid } from '../../lib/format';

export function JoinScreen() {
  const navigate = useNavigate();
  const { setSession } = useApp();
  const [classCode, setClassCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const nameValid = displayName.trim().length >= 2 && displayName.trim().length <= 30;
  const canSubmit = classCode.trim().length > 0 && nameValid && !busy;

  async function handleJoin() {
    setError('');
    setBusy(true);
    const code = classCode.trim();
    try {
      const cls = await getClassDoc(code);
      if (!cls) {
        setError('Class code not found. Check with your instructor.');
        setBusy(false);
        return;
      }
      const studentId = uuid();
      if (firebaseConfigured) {
        await setDoc(doc(db, 'classes', code, 'students', studentId), {
          displayName: displayName.trim(),
          joinedAt: Date.now(),
        }).catch(() => {});
      }
      setSession({ classCode: code, studentId, displayName: displayName.trim() });
      navigate('/play');
    } catch {
      setError('Could not connect. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-accent)]">
            Operations Simulation
          </div>
          <h1 className="mt-2 text-3xl font-bold">Teppanyaki Tonight</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Run a teppanyaki restaurant for one evening. Find the operating policy that maximises profit.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--color-text-secondary)]">Class Code</span>
            <input
              value={classCode}
              onChange={(e) => setClassCode(e.target.value)}
              placeholder="e.g. test1"
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 font-mono outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--color-text-secondary)]">Display Name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Appears on the leaderboard"
              maxLength={30}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
            />
            {displayName.length > 0 && !nameValid && (
              <span className="text-xs text-[var(--color-accent-amber)]">Name must be 2–30 characters.</span>
            )}
          </label>

          {error && <div className="text-sm text-[var(--color-accent-red)]">{error}</div>}

          <button
            onClick={handleJoin}
            disabled={!canSubmit}
            className="mt-2 rounded-md bg-[var(--color-accent)] px-4 py-2.5 font-medium text-white transition-opacity disabled:opacity-40"
          >
            {busy ? 'Joining…' : 'Enter Restaurant'}
          </button>

          {!firebaseConfigured && (
            <p className="text-center text-xs text-[var(--color-text-muted)]">
              Demo mode — any class code works (leaderboard disabled).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
