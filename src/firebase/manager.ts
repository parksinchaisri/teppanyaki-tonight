import { collection, deleteDoc, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db, firebaseConfigured } from './config';

export interface ClassSummary {
  code: string;
  createdAt: number;
  studentCount: number;
  // The class document is publicly readable, so the PIN is already part of what
  // this listing fetches. It is masked in the UI until explicitly revealed.
  instructorPin: string;
}

// The top-level classes collection is already publicly readable, so the manager
// can list every class without a PIN. Destructive actions below still require
// the individual class's PIN.
export async function listClasses(): Promise<ClassSummary[]> {
  if (!firebaseConfigured) return [];
  const snap = await getDocs(collection(db, 'classes'));
  const rows = await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data() as { createdAt?: unknown; instructorPin?: unknown };
      let studentCount = 0;
      try {
        const students = await getDocs(collection(db, 'classes', d.id, 'students'));
        studentCount = students.size;
      } catch {
        studentCount = 0;
      }
      return {
        code: d.id,
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
        studentCount,
        instructorPin: String(data.instructorPin ?? ''),
      };
    }),
  );
  return rows.sort((a, b) => b.createdAt - a.createdAt || a.code.localeCompare(b.code));
}

// Verify a class's own instructor PIN — the same per-class secret used
// everywhere else. There is deliberately no global manager password.
export async function verifyClassPin(classCode: string, pin: string): Promise<boolean> {
  if (!firebaseConfigured) return true;
  const snap = await getDoc(doc(db, 'classes', classCode));
  if (!snap.exists()) return false;
  return String((snap.data() as { instructorPin?: unknown }).instructorPin ?? '') === pin.trim();
}

const SUBCOLLECTIONS = ['studentResults', 'reflections', 'attempts', 'students', 'live'];

// Deleting a class spans several collections and cannot be one atomic write, so
// a failure part-way through leaves the class partially deleted. This error
// carries what was already cleared, so the UI can say so instead of implying
// nothing happened.
export class PartialDeleteError extends Error {
  constructor(
    message: string,
    readonly cleared: string[],
    readonly failedAt: string,
  ) {
    super(message);
    this.name = 'PartialDeleteError';
  }
}

// Permanently delete a class: every subcollection document first, then the class
// document itself. Unlike "Reset Class Data" this also clears attempts and the
// live-session doc, since nothing is meant to survive.
export async function deleteClassCompletely(classCode: string): Promise<{ deleted: number }> {
  if (!firebaseConfigured) return { deleted: 0 };
  let deleted = 0;
  const cleared: string[] = [];
  for (const sub of SUBCOLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, 'classes', classCode, sub));
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db);
        docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deleted += Math.min(400, docs.length - i);
      }
      cleared.push(sub);
    } catch (err) {
      throw new PartialDeleteError(String((err as { code?: string }).code ?? err), cleared, sub);
    }
  }
  try {
    await deleteDoc(doc(db, 'classes', classCode));
  } catch (err) {
    throw new PartialDeleteError(String((err as { code?: string }).code ?? err), cleared, 'the class document');
  }
  return { deleted };
}
