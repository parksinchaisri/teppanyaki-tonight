import { useApp } from '../../store/appContext';

// Shown when this student's roster document has been deleted by the instructor.
// Blocking on purpose: there is no "continue anyway", because every write they
// could make from here would be attributed to a student the class no longer has.
// Rejoining mints a fresh studentId, which is the intended outcome — a
// removed-and-rejoined student is a new student.
export function RemovedFromClass() {
  const { setSession } = useApp();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-accent-red)]/50 bg-[var(--color-surface)] p-8 text-center">
        <div className="text-4xl">🚪</div>
        <h1 className="mt-4 text-2xl font-bold">You&apos;ve been removed from this class by your instructor.</h1>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          If you think this was a mistake, ask your instructor and then rejoin with your class code.
        </p>
        <button
          onClick={() => setSession(null)}
          className="mt-6 rounded-md bg-[var(--color-accent)] px-5 py-2.5 font-medium text-white"
        >
          Rejoin
        </button>
      </div>
    </div>
  );
}
