import { addDoc, collection, getDocs } from 'firebase/firestore';
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
