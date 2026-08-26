import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, firebaseConfigured } from './config';
import { DEFAULT_PARAMS, DEFAULT_SETTINGS, type ClassDoc, type ClassSettings } from './types';
import type { ParamOverrides } from '../engine/types';

function readParams(data: { params?: unknown } | undefined): ParamOverrides {
  const p = (data?.params ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  return {
    dinnerMargin: num(p.dinnerMargin),
    drinkMargin: num(p.drinkMargin),
    fixedCostEvening: num(p.fixedCostEvening),
    patienceMean: num(p.patienceMean),
    defaultBarSeats: num(p.defaultBarSeats),
    defaultTables: num(p.defaultTables),
  };
}

// Fetch a class document once. Returns null if the class code does not exist.
export async function getClassDoc(classCode: string): Promise<ClassDoc | null> {
  if (!firebaseConfigured) return { instructorPin: '0000', settings: DEFAULT_SETTINGS, params: DEFAULT_PARAMS };
  const snap = await getDoc(doc(db, 'classes', classCode));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<ClassDoc>;
  return {
    instructorPin: String(data.instructorPin ?? ''),
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
    params: readParams(data),
  };
}

// Bootstrap a brand-new class document (no PIN required to reach this — the
// Firestore rules only allow `create` when the document does not already exist).
export async function createClass(
  classCode: string,
  pin: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!firebaseConfigured) return { ok: true }; // demo mode — nothing to persist
  const ref = doc(db, 'classes', classCode);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) return { ok: false, error: 'Class code already taken. Choose a different one.' };
    await setDoc(ref, {
      instructorPin: pin,
      createdAt: Date.now(),
      settings: { ...DEFAULT_SETTINGS },
      params: {},
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not create the class. Please try again.' };
  }
}

export async function getSettings(classCode: string): Promise<ClassSettings> {
  const cls = await getClassDoc(classCode);
  return cls?.settings ?? DEFAULT_SETTINGS;
}

// Live subscription to a class's settings AND param overrides. Returns unsubscribe.
export function subscribeSettings(
  classCode: string,
  cb: (s: ClassSettings, params: ParamOverrides) => void,
): () => void {
  if (!firebaseConfigured) {
    cb(DEFAULT_SETTINGS, DEFAULT_PARAMS);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'classes', classCode),
    (snap) => {
      const data = snap.data() as Partial<ClassDoc> | undefined;
      cb({ ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) }, readParams(data));
    },
    () => cb(DEFAULT_SETTINGS, DEFAULT_PARAMS),
  );
}

export async function updateSettings(classCode: string, settings: ClassSettings): Promise<void> {
  if (!firebaseConfigured) return;
  await updateDoc(doc(db, 'classes', classCode), { settings });
}

// Write individual settings fields without rewriting the whole `settings` map.
// The Session Control tab flips several toggles in quick succession, and a
// whole-object write built from a stale snapshot silently reverts whichever
// change has not round-tripped yet. Keys may be nested paths relative to
// `settings` (e.g. 'maxAttempts.batching').
export async function updateSettingsFields(
  classCode: string,
  fields: Record<string, unknown>,
): Promise<void> {
  if (!firebaseConfigured) return;
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) payload[`settings.${k}`] = v;
  await updateDoc(doc(db, 'classes', classCode), payload);
}

// Persist per-class engine overrides. Undefined fields are stripped so absent
// values fall back to engine defaults.
export async function updateParams(classCode: string, params: ParamOverrides): Promise<void> {
  if (!firebaseConfigured) return;
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'number' && Number.isFinite(v)) clean[k] = v;
  }
  await updateDoc(doc(db, 'classes', classCode), { params: clean });
}

export async function updatePin(classCode: string, pin: string): Promise<void> {
  if (!firebaseConfigured) return;
  await updateDoc(doc(db, 'classes', classCode), { instructorPin: pin });
}

// Delete every studentResults and reflections document for a class, leaving the
// class document (settings, PIN, params) intact. Batched in chunks of 400.
export async function resetClassData(classCode: string): Promise<void> {
  if (!firebaseConfigured) return;
  for (const sub of ['studentResults', 'reflections']) {
    const snap = await getDocs(collection(db, 'classes', classCode, sub));
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
}
