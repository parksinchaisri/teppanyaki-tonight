import { addDoc, collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db, firebaseConfigured } from './config';
import type { ReflectionRow } from './types';

interface SubmitReflectionArgs {
  classCode: string;
  studentId: string;
  studentName: string;
  challengeKey: string;
  questionText: string;
  response: string;
}

export async function submitReflection(args: SubmitReflectionArgs): Promise<void> {
  if (!firebaseConfigured) return;
  await addDoc(collection(db, 'classes', args.classCode, 'reflections'), {
    studentId: args.studentId,
    studentName: args.studentName,
    challengeKey: args.challengeKey,
    questionText: args.questionText,
    response: args.response,
    submittedAt: Date.now(),
  });
}

// Which challenges this student has already reflected on, straight from the
// source of truth. The gate previously trusted localStorage alone, so a student
// who reflected and then lost local storage — another device, cleared data, a
// private window — was re-blocked and had to submit the same reflection twice.
export function subscribeStudentReflections(
  classCode: string,
  studentId: string,
  cb: (challengeKeys: string[]) => void,
): () => void {
  if (!firebaseConfigured) {
    cb([]);
    return () => {};
  }
  const q = query(collection(db, 'classes', classCode, 'reflections'), where('studentId', '==', studentId));
  return onSnapshot(
    q,
    (snap) => {
      const keys = snap.docs
        .map((d) => String((d.data() as { challengeKey?: unknown }).challengeKey ?? ''))
        .filter(Boolean);
      cb([...new Set(keys)]);
    },
    (err) => {
      // Non-fatal: the gate falls back to whatever this browser remembers.
      console.warn('Reflection subscription failed:', err);
      cb([]);
    },
  );
}

// Admin-only read. Rules allow reads scoped to a classCode path (anyone with the
// code can reach it) — acceptable for a classroom tool, as documented in the spec.
export async function getReflections(classCode: string): Promise<ReflectionRow[]> {
  if (!firebaseConfigured) return [];
  const snap = await getDocs(collection(db, 'classes', classCode, 'reflections'));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      studentId: String(data.studentId ?? ''),
      studentName: String(data.studentName ?? 'Anonymous'),
      challengeKey: String(data.challengeKey ?? ''),
      questionText: String(data.questionText ?? ''),
      response: String(data.response ?? ''),
      submittedAt: Number(data.submittedAt ?? 0),
    };
  });
}
