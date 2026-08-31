import { collection, deleteDoc, doc, getDocs, onSnapshot, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db, firebaseConfigured } from './config';

// ── Presence ────────────────────────────────────────────────────────────────

// `updateDoc`, never `setDoc`: a heartbeat from a student the instructor has
// just removed must fail, not quietly recreate their roster row.
export async function writePresence(
  classCode: string,
  studentId: string,
  patch: { currentView?: string; lastSeenAt?: number },
): Promise<void> {
  if (!firebaseConfigured) return;
  try {
    await updateDoc(doc(db, 'classes', classCode, 'students', studentId), patch);
  } catch {
    // Offline, or the student has been removed. Neither is worth interrupting
    // the student for — removal is surfaced by the own-document subscription.
  }
}

// ── The student's view of their own roster row ──────────────────────────────

// 'unknown' covers "not read yet" and "the read failed": only a definite
// 'missing' is allowed to lock a student out, so a rules or network problem can
// never eject a whole class.
export type OwnStudentState =
  | { status: 'unknown' }
  | { status: 'missing' }
  | { status: 'present'; displayName: string };

export function subscribeOwnStudent(
  classCode: string,
  studentId: string,
  cb: (s: OwnStudentState) => void,
): () => void {
  if (!firebaseConfigured) {
    cb({ status: 'unknown' });
    return () => {};
  }
  return onSnapshot(
    doc(db, 'classes', classCode, 'students', studentId),
    (snap) => {
      if (!snap.exists()) {
        cb({ status: 'missing' });
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      cb({ status: 'present', displayName: String(data.displayName ?? '') });
    },
    (err) => {
      console.warn('Own student subscription failed (check Firestore rules for classes/*/students):', err);
      cb({ status: 'unknown' });
    },
  );
}

// ── Instructor actions ──────────────────────────────────────────────────────

const CASCADE_COLLECTIONS = ['attempts', 'studentResults', 'reflections'] as const;

// Removing a student is normally roster cleanup, not a request to destroy their
// data — so `cascade` is opt-in and off by default at the call site.
export async function removeStudent(
  classCode: string,
  studentId: string,
  cascade: boolean,
): Promise<{ deleted: number }> {
  if (!firebaseConfigured) return { deleted: 0 };
  let deleted = 0;
  if (cascade) {
    for (const sub of CASCADE_COLLECTIONS) {
      const snap = await getDocs(
        query(collection(db, 'classes', classCode, sub), where('studentId', '==', studentId)),
      );
      // Same 400-per-batch chunking as "Reset Class Data".
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      deleted += snap.size;
    }
  }
  await deleteDoc(doc(db, 'classes', classCode, 'students', studentId));
  return { deleted };
}

// Correcting a name fixes the roster and the live leaderboard. It deliberately
// does not rewrite `attempts` or `reflections`: those rows record what the name
// was when they were written, and history is not edited.
export async function renameStudent(
  classCode: string,
  studentId: string,
  displayName: string,
): Promise<{ resultsUpdated: number }> {
  const name = displayName.trim();
  // Matches the studentResults rule, which rejects names outside 2–30 chars.
  if (name.length < 2 || name.length > 30) throw new Error('Name must be 2–30 characters.');
  if (!firebaseConfigured) return { resultsUpdated: 0 };

  await updateDoc(doc(db, 'classes', classCode, 'students', studentId), { displayName: name });

  const snap = await getDocs(
    query(collection(db, 'classes', classCode, 'studentResults'), where('studentId', '==', studentId)),
  );
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.update(d.ref, { studentName: name }));
    await batch.commit();
  }
  return { resultsUpdated: snap.size };
}
