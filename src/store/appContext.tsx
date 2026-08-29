import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { subscribeSettings } from '../firebase/classSettings';
import { subscribeAttemptCounts } from '../firebase/attempts';
import { subscribeLiveState } from '../firebase/liveSession';
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
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() => loadSession());
  const [settings, setSettings] = useState<ClassSettings>(DEFAULT_SETTINGS);
  const [params, setParams] = useState<ParamOverrides>(DEFAULT_PARAMS);
  const [completed, setCompleted] = useState<Record<string, boolean>>(() => loadCompleted());
  const [reflected, setReflected] = useState<Record<string, boolean>>(() => loadReflected());
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
      setServerAttempts({});
      return;
    }
    return subscribeAttemptCounts(session.classCode, session.studentId, setServerAttempts);
  }, [session?.classCode, session?.studentId]);

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
    setReflected((prev) => {
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
    }),
    [session, settings, params, completed, reflected, challengeStates, animationTime, attemptCounts, liveState],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
