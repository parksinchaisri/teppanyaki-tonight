import { useState } from 'react';
import { getClassDoc } from '../firebase/classSettings';
import { firebaseConfigured } from '../firebase/config';

// The shared instructor PIN gate. Used by the admin dashboard and by Theater
// Mode, which is opened in its own tab and so starts unauthenticated.
export function AdminLogin({ onAuthed }: { onAuthed: (classCode: string) => void }) {
  const [classCode, setClassCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setError('');
    setBusy(true);
    const code = classCode.trim();
    try {
      const cls = await getClassDoc(code);
      if (!cls) {
        setError('Class code not found.');
      } else if (firebaseConfigured && cls.instructorPin !== pin.trim()) {
        setError('Incorrect PIN.');
      } else {
        onAuthed(code);
      }
    } catch {
      setError('Could not connect.');
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--color-text-secondary)]">Enter your class code and PIN.</p>
      <input
        value={classCode}
        onChange={(e) => setClassCode(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && classCode.trim() && handleLogin()}
        placeholder="Class code"
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 font-mono outline-none focus:border-[var(--color-accent)]"
      />
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && classCode.trim() && handleLogin()}
        placeholder="PIN"
        type="password"
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 font-mono outline-none focus:border-[var(--color-accent)]"
      />
      {error && <span className="text-sm text-[var(--color-accent-red)]">{error}</span>}
      <button
        onClick={handleLogin}
        disabled={busy || !classCode.trim()}
        className="rounded-md bg-[var(--color-accent)] px-4 py-2.5 font-medium text-white disabled:opacity-40"
      >
        {busy ? 'Checking…' : 'Enter'}
      </button>
      {!firebaseConfigured && (
        <p className="text-center text-xs text-[var(--color-text-muted)]">Demo mode — any code works.</p>
      )}
    </div>
  );
}
