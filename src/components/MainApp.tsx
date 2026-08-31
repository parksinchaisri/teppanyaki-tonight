import { useEffect, useState } from 'react';
import { useApp } from '../store/appContext';
import { LobbyWaiting } from './onboarding/LobbyWaiting';
import { RemovedFromClass } from './onboarding/RemovedFromClass';
import { PrepareTab } from './tabs/PrepareTab';
import { ChallengesTab } from './tabs/ChallengesTab';
import { LeaderboardTab } from './tabs/LeaderboardTab';

type Tab = 'prepare' | 'challenges' | 'leaderboard';

const TABS: { key: Tab; label: string }[] = [
  { key: 'prepare', label: 'Prepare' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'leaderboard', label: 'Leaderboard' },
];

export function MainApp() {
  const { session, setSession, settings, liveState, forcedChallenge, removedFromClass, reportView } = useApp();
  const [tab, setTab] = useState<Tab>('prepare');

  // Report the top-level tab. ChallengesTab overrides this with the challenge
  // it is showing, since "Challenges" alone tells the instructor very little.
  useEffect(() => {
    if (tab !== 'challenges') reportView(tab === 'prepare' ? 'Prepare' : 'Leaderboard');
  }, [tab, reportView]);

  // The instructor has moved the class to a new challenge: bring everyone to
  // the Challenges tab. `forcedChallenge` is a fresh object only on an actual
  // transition, so this fires once and does not fight later navigation.
  useEffect(() => {
    if (forcedChallenge) setTab('challenges');
  }, [forcedChallenge]);

  // Outranks every other screen, including the lobby: there is nothing this
  // student can usefully do in a class they are no longer on.
  if (removedFromClass) return <RemovedFromClass />;

  // In a live class nothing is available until the instructor starts. Self-paced
  // classes never see this — liveSessionMode gates it.
  if (settings.liveSessionMode && liveState.phase === 'lobby') {
    return <LobbyWaiting />;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold">Teppanyaki Tonight</span>
              <span className="hidden font-mono text-xs text-[var(--color-text-muted)] sm:inline">
                {session?.classCode}
              </span>
            </div>
            <nav className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
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
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--color-text-secondary)]">{session?.displayName}</span>
            <button
              onClick={() => setSession(null)}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              Leave
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        {tab === 'prepare' && <PrepareTab onStart={() => setTab('challenges')} />}
        {tab === 'challenges' && <ChallengesTab />}
        {tab === 'leaderboard' && <LeaderboardTab />}
      </main>
    </div>
  );
}
