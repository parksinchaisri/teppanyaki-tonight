import { useEffect, useMemo, useState } from 'react';
import { getReflections } from '../firebase/reflections';
import type { ReflectionRow } from '../firebase/types';
import { CHALLENGES, challengeLabel } from '../challenges/definitions';
import { downloadCSV } from '../lib/csv';
import { reflectionsCSV } from '../lib/exports';

export function ReflectionsTab({ classCode }: { classCode: string }) {
  const [rows, setRows] = useState<ReflectionRow[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getReflections(classCode).then((r) => {
      if (active) {
        setRows(r);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [classCode]);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => filter === 'all' || r.challengeKey === filter)
      .filter((r) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return r.studentName.toLowerCase().includes(q) || r.response.toLowerCase().includes(q);
      })
      .sort((a, b) => b.submittedAt - a.submittedAt);
  }, [rows, filter, search]);

  function exportCSV() {
    downloadCSV(`teppanyaki-reflections-${classCode}.csv`, reflectionsCSV(filtered));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Reflections</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or text…"
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm outline-none"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm outline-none"
          >
            <option value="all">All challenges</option>
            {CHALLENGES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.title}
              </option>
            ))}
          </select>
          <button onClick={exportCSV} className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white">
            Download CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-[var(--color-text-muted)]">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center text-[var(--color-text-muted)]">
          No reflections {rows.length > 0 ? 'match your filter' : 'submitted yet'}.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.studentName}</span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {challengeLabel(r.challengeKey)} · {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : ''}
                </span>
              </div>
              <p className="mt-1 text-xs italic text-[var(--color-text-muted)]">{r.questionText}</p>
              <p className="mt-2 text-sm text-[var(--color-text-primary)]">{r.response}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
