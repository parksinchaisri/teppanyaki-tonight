import { useEffect, useRef, useState } from 'react';
import type { RunStats, SimConfig } from '../../engine/types';
import { PARAMS } from '../../engine/params';
import { useApp } from '../../store/appContext';
import { FloorView } from './FloorView';
import { TimelineScrubber } from './TimelineScrubber';
import { EventLog } from './EventLog';
import { clockLabel } from '../../lib/format';

const STEP_MINUTES = 5;
const MAX_TIME = 690;

export function AnimationPanel({
  run,
  config,
  challengeKey,
}: {
  run: RunStats;
  config: SimConfig;
  challengeKey: string;
}) {
  const { animationTime, setAnimationTime } = useApp();
  const min = config.openingTime;
  const max = MAX_TIME;

  const clamp = (t: number) => Math.max(min, Math.min(max, t));
  // Restore the saved playhead for this challenge (set by a previous visit), else open.
  const [time, setTime] = useState(() => {
    const saved = animationTime[challengeKey];
    return saved != null ? clamp(saved) : min;
  });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  // Keep the latest time in a ref so we can persist it on unmount (e.g. tab switch).
  const timeRef = useRef(time);
  timeRef.current = time;
  const save = (t: number) => setAnimationTime((prev) => ({ ...prev, [challengeKey]: t }));

  // Persist the playhead when the panel unmounts (switching tabs mid-playback too).
  useEffect(() => {
    return () => save(timeRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeKey]);

  // Reset the playhead only when a genuinely different run is selected — not on
  // mount/remount (so the persisted position survives tab switches).
  const prevRun = useRef(run);
  useEffect(() => {
    if (prevRun.current !== run) {
      prevRun.current = run;
      setPlaying(false);
      setTime(min);
      save(min);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, min]);

  useEffect(() => {
    if (!playing) return;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      // 1× = 60 sim-minutes per real second of playback.
      setTime((t) => {
        const next = t + dt * 60 * speed;
        if (next >= max) {
          setPlaying(false);
          return max;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing, speed, max]);

  function togglePlay() {
    setPlaying((p) => {
      if (p) save(timeRef.current); // persist on pause
      else if (time >= max) setTime(min);
      return !p;
    });
  }

  function seek(t: number) {
    setPlaying(false);
    setTime(t);
    save(t);
  }

  function step(dir: 1 | -1) {
    setPlaying(false);
    setTime((t) => {
      const next = clamp(t + dir * STEP_MINUTES);
      save(next);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <TimelineScrubber
        time={time}
        min={min}
        max={max}
        playing={playing}
        speed={speed}
        onSeek={seek}
        onTogglePlay={togglePlay}
        onStep={step}
        onSpeed={setSpeed}
      />
      <FloorView run={run} config={config} time={time} />
      <EventLog events={run.events} time={time} />
      <p className="text-center text-xs text-[var(--color-text-muted)]">
        Service runs {clockLabel(config.openingTime)}–10:30 PM. Drag the playhead or press play to watch this single
        night unfold. (Bar closes to new arrivals at {clockLabel(PARAMS.CLOSE_TIME)}.)
      </p>
    </div>
  );
}
