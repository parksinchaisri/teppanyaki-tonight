import { useEffect, useRef } from 'react';
import { writePresence } from '../firebase/students';

// A beat every 25s against a 30s "Active" threshold, so a healthy client always
// lands inside the window even if one write is slow.
const HEARTBEAT_MS = 25 * 1000;

function tabIsLive(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus();
}

// Reports where this student is and that they are still here. Deliberately
// silent about a backgrounded tab: the instructor wants to know who is actually
// looking at the screen, so a hidden tab stops beating and decays to Idle and
// then Away on its own rather than reporting a presence nobody has.
export function usePresence(classCode: string | null, studentId: string | null, currentView: string): void {
  // Read inside the interval instead of re-subscribing on every navigation.
  const viewRef = useRef(currentView);
  viewRef.current = currentView;

  // The view is worth writing the moment it changes, whether or not a beat is
  // due — the roster should track navigation, not lag up to 25s behind it.
  useEffect(() => {
    if (!classCode || !studentId || !currentView) return;
    void writePresence(classCode, studentId, { currentView, lastSeenAt: Date.now() });
  }, [classCode, studentId, currentView]);

  useEffect(() => {
    if (!classCode || !studentId) return;

    const beat = () => {
      if (!tabIsLive()) return;
      void writePresence(classCode, studentId, { currentView: viewRef.current, lastSeenAt: Date.now() });
    };

    const id = setInterval(beat, HEARTBEAT_MS);
    // Coming back to the tab should show as Active immediately rather than
    // after up to 25s of looking Away.
    document.addEventListener('visibilitychange', beat);
    window.addEventListener('focus', beat);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', beat);
      window.removeEventListener('focus', beat);
    };
  }, [classCode, studentId]);
}
