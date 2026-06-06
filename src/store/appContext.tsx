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
import { DEFAULT_PARAMS, DEFAULT_SETTINGS, type ClassSettings } from '../firebase/types';
import type { ParamOverrides } from '../engine/types';
import type { ChallengeUIState } from '../components/challenges/ChallengeShell';

export interface Session {
  classCode: string;
  studentId: string;
  displayName: string;
}

const SESSION_KEY = 'teppanyaki.session';
const COMPLETED_KEY = 'teppanyaki.completed';

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
}

function loadCompleted(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(COMPLETED_KEY) ?? '{}');
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
  // Per-challenge UI state lives here (not in ChallengesTab) so a student's configs
  // and results survive switching between the top-level Prepare/Challenges/Leaderboard
  // tabs, not just the challenge sub-tabs.
  challengeStates: Record<string, ChallengeUIState>;
  setChallengeStates: Dispatch<SetStateAction<Record<string, ChallengeUIState>>>;
  // Animation playhead position (minutes from midnight) per challenge key, so the
  // scrubber stays where the student left it across tab switches.
  animationTime: Record<string, number>;
  setAnimationTime: Dispatch<SetStateAction<Record<string, number>>>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() => loadSession());
  const [settings, setSettings] = useState<ClassSettings>(DEFAULT_SETTINGS);
  const [params, setParams] = useState<ParamOverrides>(DEFAULT_PARAMS);
  const [completed, setCompleted] = useState<Record<string, boolean>>(() => loadCompleted());
  const [challengeStates, setChallengeStates] = useState<Record<string, ChallengeUIState>>({});
  const [animationTime, setAnimationTime] = useState<Record<string, number>>({});

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

  const value = useMemo(
    () => ({
      session,
      setSession,
      settings,
      params,
      completed,
      markCompleted,
      challengeStates,
      setChallengeStates,
      animationTime,
      setAnimationTime,
    }),
    [session, settings, params, completed, challengeStates, animationTime],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
