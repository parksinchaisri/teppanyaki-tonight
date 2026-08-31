import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { subscribeSettings } from '../firebase/classSettings';
import { subscribeAttemptCounts } from '../firebase/attempts';
import { subscribeLiveState } from '../firebase/liveSession';
import { subscribeStudentReflections } from '../firebase/reflections';
import { subscribeOwnStudent } from '../firebase/students';
import { usePresence } from '../hooks/usePresence';
import {
  DEFAULT_LIVE_STATE,
  DEFAULT_PARAMS,
  DEFAULT_SETTINGS,
  type ClassSettings,
  type LiveSessionState,
} from '../firebase/types';
import type { ParamOverrides } from '../engine/types';
import type { ChallengeUIState } from '../components/challenges/ChallengeShell';

export interface Session {
  classCode: string;
  studentId: string;
  displayName: string;
}

const SESSION_KEY = 'teppanyaki.session';
const COMPLETED_KEY = 'teppanyaki.completed';
const REFLECTED_KEY = 'teppanyaki.reflected';

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (s.classCode && s.studentId && s.displayName) return s;
    return null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(COMPLETED_KEY);
  localStorage.removeItem(REFLECTED_KEY);
}

function loadCompleted(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(COMPLETED_KEY) ?? '{}');
  } catch {
    return {};
  }
}

// Which challenges this student has submitted a reflection for. Persisted like
// `completed` so a refresh mid-class does not re-lock their progress.
function loadReflected(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(REFLECTED_KEY) ?? '{}');
  } catch {
    return {};
  }
}

interface AppContextValue {
  session: Session | null;
  setSession: (s: Session | null) => void;
  settings: ClassSettings;
  params: ParamOverrides;
  completed: Record<string, boolean>;
  markCompleted: (challengeKey: string) => void;
  reflected: Record<string, boolean>;
  markReflected: (challengeKey: string) => void;
  // Per-challenge UI state lives here (not in ChallengesTab) so a student's configs
  // and results survive switching between the top-level Prepare/Challenges/Leaderboard
  // tabs, not just the challenge sub-tabs.
  challengeStates: Record<string, ChallengeUIState>;
  setChallengeStates: Dispatch<SetStateAction<Record<string, ChallengeUIState>>>;
  // Animation playhead position (minutes from midnight) per challenge key, so the
  // scrubber stays where the student left it across tab switches.
  animationTime: Record<string, number>;
  setAnimationTime: Dispatch<SetStateAction<Record<string, number>>>;
  // Per-challenge count of brand-new Simulate runs by this student, used to
  // enforce `maxAttempts`. Server-backed (so it survives a refresh) but bumped
  // locally on each run so the limit applies immediately and in demo mode.
  attemptCounts: Record<string, number>;
  bumpAttempt: (challengeKey: string) => number;
  // Instructor-driven session flow (iteration 8). Only meaningful when
  // settings.liveSessionMode is on; self-paced classes ignore it entirely.
  liveState: LiveSessionState;
  // Set once each time the instructor moves the class to a different challenge,
  // so the student's own UI follows the room. A fresh object per transition —
  // consumers use it as an effect dependency and act exactly once. Never
  // re-emitted on reconnect or re-render, so it nudges rather than locks: a
  // student is free to navigate away again straight after.
  forcedChallenge: { key: string; seq: number } | null;
  // True once this student's own roster document is known to be gone — the
  // instructor removed them. Never set from a failed or pending read.
  removedFromClass: boolean;
  // Where this student is right now, reported to the roster. Components call
  // this on navigation; the presence hook handles the writing.
  reportView: (view: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() => loadSession());
  const [settings, setSettings] = useState<ClassSettings>(DEFAULT_SETTINGS);
  const [params, setParams] = useState<ParamOverrides>(DEFAULT_PARAMS);
  const [completed, setCompleted] = useState<Record<string, boolean>>(() => loadCompleted());
  // Local (optimistic, survives reload) merged with what Firestore actually holds,
  // so the gate never re-blocks a student whose reflection is already recorded.
  const [localReflected, setLocalReflected] = useState<Record<string, boolean>>(() => loadReflected());
  const [serverReflected, setServerReflected] = useState<Record<string, boolean>>({});
  const [challengeStates, setChallengeStates] = useState<Record<string, ChallengeUIState>>({});
  const [animationTime, setAnimationTime] = useState<Record<string, number>>({});
  const [liveState, setLiveState] = useState<LiveSessionState>(DEFAULT_LIVE_STATE);
  const [serverAttempts, setServerAttempts] = useState<Record<string, number>>({});
  const [localAttempts, setLocalAttempts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!session?.classCode) {
      setSettings(DEFAULT_SETTINGS);
      setParams(DEFAULT_PARAMS);
      return;
    }
    const unsub = subscribeSettings(session.classCode, (s, p) => {
      setSettings(s);
      setParams(p);
    });
    return unsub;
  }, [session?.classCode]);

  useEffect(() => {
    if (!session?.classCode) {
      setLiveState(DEFAULT_LIVE_STATE);
      return;
    }
    return subscribeLiveState(session.classCode, setLiveState);
  }, [session?.classCode]);

  useEffect(() => {
    if (!session?.classCode || !session.studentId) {
      setServerReflected({});
      return;
    }
    return subscribeStudentReflections(session.classCode, session.studentId, (keys) =>
      setServerReflected(Object.fromEntries(keys.map((k) => [k, true]))),
    );
  }, [session?.classCode, session?.studentId]);

  useEffect(() => {
    if (!session?.classCode || !session.studentId) {
      setServerAttempts({});
      return;
    }
    return subscribeAttemptCounts(session.classCode, session.studentId, setServerAttempts);
  }, [session?.classCode, session?.studentId]);

  // ── Roster presence and the student's own roster row ─────────────────────
  const [removedFromClass, setRemovedFromClass] = useState(false);
  const [currentView, setCurrentView] = useState('');
  usePresence(session?.classCode ?? null, session?.studentId ?? null, currentView);

  useEffect(() => {
    if (!session?.classCode || !session.studentId) {
      setRemovedFromClass(false);
      return;
    }
    return subscribeOwnStudent(session.classCode, session.studentId, (own) => {
      if (own.status === 'missing') {
        setRemovedFromClass(true);
        return;
      }
      if (own.status !== 'present') return;
      setRemovedFromClass(false);
      // The roster document is authoritative for the name: an instructor
      // correcting it here must reach the next attempt this student logs,
      // without a rejoin or even a refresh.
      if (own.displayName && own.displayName !== session.displayName) {
        setSessionState((prev) => {
          if (!prev) return prev;
          const next = { ...prev, displayName: own.displayName };
          saveSession(next);
          return next;
        });
      }
    });
  }, [session?.classCode, session?.studentId, session?.displayName]);

  // Section 5: follow the instructor to the new challenge.
  const [forcedChallenge, setForcedChallenge] = useState<{ key: string; seq: number } | null>(null);
  // `undefined` means "nothing observed yet". The first value a client sees is
  // its starting position, not a transition — a student joining or refreshing
  // mid-round must not be yanked out of whatever they were reading.
  const seenChallenge = useRef<string | null | undefined>(undefined);
  const forceSeq = useRef(0);

  useEffect(() => {
    seenChallenge.current = undefined;
    setForcedChallenge(null);
  }, [session?.classCode, session?.studentId]);

  useEffect(() => {
    const next = liveState.currentChallenge;
    const previous = seenChallenge.current;
    seenChallenge.current = next;
    if (!settings.liveSessionMode) return;
    if (previous === undefined || previous === next || !next) return;
    forceSeq.current += 1;
    setForcedChallenge({ key: next, seq: forceSeq.current });
  }, [liveState.currentChallenge, settings.liveSessionMode]);

  const reflected = useMemo(
    () => ({ ...localReflected, ...serverReflected }),
    [localReflected, serverReflected],
  );

  // The server count is authoritative once it catches up; the local count covers
  // the write round-trip (and demo mode, where nothing is persisted at all).
  const attemptCounts = useMemo(() => {
    const merged: Record<string, number> = { ...serverAttempts };
    for (const [k, v] of Object.entries(localAttempts)) {
      merged[k] = Math.max(merged[k] ?? 0, v);
    }
    return merged;
  }, [serverAttempts, localAttempts]);

  // Returns the 1-indexed attempt number this run should be recorded under.
  const bumpAttempt = (challengeKey: string): number => {
    const next = (attemptCounts[challengeKey] ?? 0) + 1;
    setLocalAttempts((prev) => ({ ...prev, [challengeKey]: Math.max(prev[challengeKey] ?? 0, next) }));
    return next;
  };

  const setSession = (s: Session | null) => {
    if (s) saveSession(s);
    else clearSession();
    setSessionState(s);
  };

  const markCompleted = (challengeKey: string) => {
    setCompleted((prev) => {
      const next = { ...prev, [challengeKey]: true };
      localStorage.setItem(COMPLETED_KEY, JSON.stringify(next));
      return next;
    });
  };

  const markReflected = (challengeKey: string) => {
    setLocalReflected((prev) => {
      const next = { ...prev, [challengeKey]: true };
      localStorage.setItem(REFLECTED_KEY, JSON.stringify(next));
      return next;
    });
  };

  const value = useMemo(
    () => ({
      session,
      setSession,
      settings,
      params,
      completed,
      markCompleted,
      reflected,
      markReflected,
      challengeStates,
      setChallengeStates,
      animationTime,
      setAnimationTime,
      attemptCounts,
      bumpAttempt,
      liveState,
      forcedChallenge,
      removedFromClass,
      reportView: setCurrentView,
    }),
    [
      session,
      settings,
      params,
      completed,
      reflected,
      challengeStates,
      animationTime,
      attemptCounts,
      liveState,
      forcedChallenge,
      removedFromClass,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
