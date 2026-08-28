import { useApp } from '../../store/appContext';

// Shown to students in a live class before the instructor presses Start Class.
export function LobbyWaiting() {
  const { session, setSession } = useApp();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-accent)]">
        Operations Simulation
      </div>
      <h1 className="mt-2 text-4xl font-bold">Teppanyaki Tonight</h1>

      <div className="mt-10 flex items-center gap-3 text-lg text-[var(--color-text-secondary)]">
        <span className="inline-flex gap-1">
          <Dot delay="0s" />
          <Dot delay=".2s" />
          <Dot delay=".4s" />
        </span>
        Waiting for your instructor to start the session…
      </div>

      <p className="mt-6 text-sm text-[var(--color-text-muted)]">
        You&apos;re in as <span className="text-[var(--color-text-primary)]">{session?.displayName}</span> ·{' '}
        <span className="font-mono">{session?.classCode}</span>
      </p>

      <button
        onClick={() => setSession(null)}
        className="mt-8 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      >
        Leave
      </button>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <>
      <style>{`@keyframes lobbyDot{0%,80%,100%{opacity:.25}40%{opacity:1}}`}</style>
      <span
        style={{ animation: `lobbyDot 1.4s ease-in-out ${delay} infinite` }}
        className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]"
      />
    </>
  );
}
