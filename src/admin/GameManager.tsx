import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteClassCompletely,
  listClasses,
  PartialDeleteError,
  verifyClassPin,
  type ClassSummary,
} from '../firebase/manager';
import { exportAllForClass } from '../lib/exports';
import { firebaseConfigured } from '../firebase/config';

type Stage = { code: string; step: 'pin' | 'confirm'; pin: string; typed: string; error: string } | null;

export function GameManager() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  // Deleting is only offered for classes exported in this session — the export
  // is the safety interlock, so it deliberately does not persist across reloads.
  const [exported, setExported] = useState<Set<string>>(new Set());
  // Masked by default so a casually shared screen does not expose every PIN.
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<Stage>(null);

  async function refresh() {
    setLoading(true);
    try {
      setClasses(await listClasses());
    } catch {
      setNotice('Could not list classes.');
    }
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleExport(code: string) {
    setBusy(code);
    setNotice('');
    try {
      await exportAllForClass(code);
      setExported((prev) => new Set(prev).add(code));
      setNotice(`Exported results, attempts and reflections for ${code}.`);
    } catch {
      setNotice(`Could not export ${code}. Nothing was deleted.`);
    }
    setBusy('');
  }

  async function handleDelete() {
    if (!stage) return;
    setBusy(stage.code);
    try {
      await deleteClassCompletely(stage.code);
      setNotice(`Deleted class ${stage.code}.`);
      setStage(null);
      await refresh();
    } catch (err) {
      // Never report a clean failure when part of the class is already gone.
      const partial =
        err instanceof PartialDeleteError && err.cleared.length > 0
          ? ` ${err.cleared.join(' and ')} were already deleted — this class is now partially deleted. Re-run Delete once the rules are in place.`
          : '';
      const at = err instanceof PartialDeleteError ? ` while deleting ${err.failedAt}` : '';
      setStage({
        ...stage,
        error: `Delete failed${at}. Check the Firestore delete rules are deployed.${partial}`,
      });
    }
    setBusy('');
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Game Manager</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Every class on this deployment. Export before deleting — deletion is permanent.
          </p>
        </div>
        <Link
          to="/admin"
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          ← Back to dashboard
        </Link>
      </div>

      {!firebaseConfigured && (
        <p className="mb-4 rounded-md border border-[var(--color-accent-amber)]/40 bg-[var(--color-accent-amber)]/10 p-3 text-sm text-[var(--color-accent-amber)]">
          Demo mode — no classes to manage.
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
          {notice}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-raised)] text-xs uppercase text-[var(--color-text-secondary)]">
            <tr>
              <th className="px-4 py-2 text-left">Class code</th>
              <th className="px-4 py-2 text-left">PIN</th>
              <th className="px-4 py-2 text-left">Created</th>
              <th className="px-4 py-2 text-right">Students</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && classes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                  No classes found.
                </td>
              </tr>
            )}
            {classes.map((c) => {
              const canDelete = exported.has(c.code);
              return (
                <tr key={c.code} className="border-t border-[var(--color-border)]/40">
                  <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                  <td className="px-4 py-3">
                    <PinCell
                      pin={c.instructorPin}
                      shown={revealed.has(c.code)}
                      onToggle={() =>
                        setRevealed((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.code)) next.delete(c.code);
                          else next.add(c.code);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{c.studentCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleExport(c.code)}
                        disabled={busy === c.code}
                        className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                      >
                        {busy === c.code ? 'Exporting…' : 'Export All Data'}
                      </button>
                      <button
                        onClick={() => setStage({ code: c.code, step: 'pin', pin: '', typed: '', error: '' })}
                        disabled={!canDelete}
                        title={canDelete ? undefined : 'Export this class before it can be deleted.'}
                        className="rounded-md border border-[var(--color-accent-red)]/50 px-3 py-1.5 text-xs font-medium text-[var(--color-accent-red)] disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:text-[var(--color-text-muted)] disabled:opacity-50"
                      >
                        Delete Class
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {stage && (
        <DeleteDialog
          stage={stage}
          busy={busy === stage.code}
          onChange={setStage}
          onCancel={() => setStage(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

// Looking a PIN up here is what keeps a forgotten PIN from permanently
// stranding a class — Export and Delete still ask for it, but it is always
// recoverable rather than lost.
function PinCell({ pin, shown, onToggle }: { pin: string; shown: boolean; onToggle: () => void }) {
  if (!pin) return <span className="text-xs text-[var(--color-text-muted)]">—</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-sm">{shown ? pin : '•'.repeat(Math.max(4, pin.length))}</span>
      <button
        onClick={onToggle}
        title={shown ? 'Hide PIN' : 'Show PIN'}
        aria-label={shown ? 'Hide PIN' : 'Show PIN'}
        className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
      >
        {shown ? '🙈 Hide' : '👁 Show PIN'}
      </button>
    </span>
  );
}

function DeleteDialog({
  stage,
  busy,
  onChange,
  onCancel,
  onConfirm,
}: {
  stage: NonNullable<Stage>;
  busy: boolean;
  onChange: (s: Stage) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  async function checkPin() {
    const ok = await verifyClassPin(stage.code, stage.pin);
    if (!ok) return onChange({ ...stage, error: 'Incorrect PIN for this class.' });
    onChange({ ...stage, step: 'confirm', error: '' });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-xl border border-[var(--color-accent-red)]/40 bg-[var(--color-surface)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[var(--color-accent-red)]">Delete {stage.code}</h2>

        {stage.step === 'pin' ? (
          <>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Enter the instructor PIN for this class to continue.
            </p>
            <input
              type="password"
              value={stage.pin}
              autoFocus
              onChange={(e) => onChange({ ...stage, pin: e.target.value, error: '' })}
              onKeyDown={(e) => e.key === 'Enter' && checkPin()}
              placeholder="Instructor PIN"
              className="mt-3 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 font-mono outline-none focus:border-[var(--color-accent)]"
            />
            {stage.error && <p className="mt-2 text-sm text-[var(--color-accent-red)]">{stage.error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onCancel} className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={checkPin}
                disabled={!stage.pin.trim()}
                className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              This permanently deletes every result, attempt, reflection and student record for this class. It cannot
              be undone. Type <span className="font-mono text-[var(--color-text-primary)]">{stage.code}</span> to
              confirm.
            </p>
            <input
              value={stage.typed}
              autoFocus
              onChange={(e) => onChange({ ...stage, typed: e.target.value })}
              placeholder={stage.code}
              className="mt-3 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 font-mono outline-none focus:border-[var(--color-accent-red)]"
            />
            {stage.error && <p className="mt-2 text-sm text-[var(--color-accent-red)]">{stage.error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onCancel} className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={stage.typed !== stage.code || busy}
                className="rounded-md bg-[var(--color-accent-red)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {busy ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
