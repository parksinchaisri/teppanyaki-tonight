import { useEffect, useState } from 'react';
import { createClass, getClassDoc, subscribeSettings } from '../firebase/classSettings';
import { firebaseConfigured } from '../firebase/config';
import { DEFAULT_PARAMS, DEFAULT_SETTINGS, type ClassSettings } from '../firebase/types';
import type { ParamOverrides } from '../engine/types';
import { SettingsTab } from './SettingsTab';
import { LiveBoardTab } from './LiveBoardTab';
import { ResultsTab } from './ResultsTab';
import { ReflectionsTab } from './ReflectionsTab';

type AdminTab = 'settings' | 'live' | 'results' | 'reflections';

export function AdminApp() {
  const [classCode, setClassCode] = useState('');
  const [pin, setPin] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<AdminTab>('live');
  const [settings, setSettings] = useState<ClassSettings>(DEFAULT_SETTINGS);
  const [params, setParams] = useState<ParamOverrides>(DEFAULT_PARAMS);

  // Login vs. create-class mode for the gate screen.
  const [mode, setMode] = useState<'login' | 'create'>('login');
  const [newCode, setNewCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [createdBanner, setCreatedBanner] = useState('');

  useEffect(() => {
    if (!authed) return;
    return subscribeSettings(classCode, (s, p) => {
      setSettings(s);
      setParams(p);
    });
  }, [authed, classCode]);

  function switchMode(next: 'login' | 'create') {
    setMode(next);
    setError('');
  }

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
        setAuthed(true);
      }
    } catch {
      setError('Could not connect.');
    }
    setBusy(false);
  }

  const codeValid = /^[A-Z0-9-]{3,20}$/.test(newCode);
  const pinValid = newPin.length >= 4 && newPin.length <= 8;
  const canCreate = codeValid && pinValid && newPin === confirmPin && !busy;

  async function handleCreate() {
    setError('');
    if (!codeValid) {
      setError('Class code must be 3–20 characters (letters, numbers, hyphens).');
      return;
    }
    if (!pinValid) {
      setError('PIN must be 4–8 characters.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await createClass(newCode, newPin);
      if (!res.ok) {
        setError(res.error || 'Could not create the class.');
        setBusy(false);
        return;
      }
      setClassCode(newCode);
      setCreatedBanner(`Class ${newCode} created!`);
      setAuthed(true);
    } catch {
      setError('Could not connect.');
    }
    setBusy(false);
  }

  if (!authed) {
    const tabBtn = (m: 'login' | 'create', label: string) => (
      <button
        onClick={() => switchMode(m)}
        className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          mode === m
            ? 'bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]'
            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
        }`}
      >
        {label}
      </button>
    );

    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
          <h1 className="text-xl font-bold">Instructor Dashboard</h1>

          <div className="mt-4 flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-1">
            {tabBtn('login', 'Log in')}
            {tabBtn('create', 'Create new class')}
          </div>

          {mode === 'login' ? (
            <div className="mt-5 flex flex-col gap-3">
              <p className="text-sm text-[var(--color-text-secondary)]">Enter your class code and PIN.</p>
              <input
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
                placeholder="Class code"
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 font-mono outline-none focus:border-[var(--color-accent)]"
              />
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
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
          ) : (
            <div className="mt-5 flex flex-col gap-3">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Pick a class code and an instructor PIN. No PIN needed to create.
              </p>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-text-secondary)]">Class code</span>
                <input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                  placeholder="e.g. OPS-101"
                  maxLength={20}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 font-mono outline-none focus:border-[var(--color-accent)]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-text-secondary)]">Instructor PIN (4–8 chars)</span>
                <input
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  type="password"
                  maxLength={8}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 font-mono outline-none focus:border-[var(--color-accent)]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-text-secondary)]">Confirm PIN</span>
                <input
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  type="password"
                  maxLength={8}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 font-mono outline-none focus:border-[var(--color-accent)]"
                />
              </label>
              {error && <span className="text-sm text-[var(--color-accent-red)]">{error}</span>}
              <button
                onClick={handleCreate}
                disabled={!canCreate}
                className="rounded-md bg-[var(--color-accent-green)] px-4 py-2.5 font-medium text-black disabled:opacity-40"
              >
                {busy ? 'Creating…' : 'Create Class'}
              </button>
              {!firebaseConfigured && (
                <p className="text-center text-xs text-[var(--color-text-muted)]">
                  Demo mode — class isn&apos;t persisted.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const TABS: { key: AdminTab; label: string }[] = [
    { key: 'settings', label: 'Settings' },
    { key: 'live', label: 'Live Board' },
    { key: 'results', label: 'Results' },
    { key: 'reflections', label: 'Reflections' },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <span className="font-bold">Instructor · {classCode}</span>
            <nav className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                    tab === t.key
                      ? 'bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          <button
            onClick={() => {
              setAuthed(false);
              setCreatedBanner('');
            }}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        {createdBanner && (
          <div className="mb-4 flex items-center justify-between rounded-md border border-[var(--color-accent-green)]/40 bg-[var(--color-accent-green)]/10 px-4 py-2.5 text-sm text-[var(--color-accent-green)]">
            <span>{createdBanner}</span>
            <button onClick={() => setCreatedBanner('')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
              ✕
            </button>
          </div>
        )}
        {tab === 'settings' && <SettingsTab classCode={classCode} settings={settings} params={params} />}
        {tab === 'live' && <LiveBoardTab classCode={classCode} settings={settings} />}
        {tab === 'results' && <ResultsTab classCode={classCode} />}
        {tab === 'reflections' && <ReflectionsTab classCode={classCode} />}
      </main>
    </div>
  );
}
