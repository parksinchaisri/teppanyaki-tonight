import { useEffect, useState } from 'react';
import { getClassDoc, subscribeSettings } from '../firebase/classSettings';
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

  useEffect(() => {
    if (!authed) return;
    return subscribeSettings(classCode, (s, p) => {
      setSettings(s);
      setParams(p);
    });
  }, [authed, classCode]);

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

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
          <h1 className="text-xl font-bold">Instructor Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Enter your class code and PIN.</p>
          <div className="mt-5 flex flex-col gap-3">
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
            onClick={() => setAuthed(false)}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        {tab === 'settings' && <SettingsTab classCode={classCode} settings={settings} params={params} />}
        {tab === 'live' && <LiveBoardTab classCode={classCode} settings={settings} />}
        {tab === 'results' && <ResultsTab classCode={classCode} />}
        {tab === 'reflections' && <ReflectionsTab classCode={classCode} />}
      </main>
    </div>
  );
}
