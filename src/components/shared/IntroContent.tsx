import { CHALLENGE_BY_KEY } from '../../challenges/definitions';
import { activeChallengeKeys, maxAttemptsFor, type ClassSettings } from '../../firebase/types';

// The guarded briefing copy, used verbatim.
const GUARDED_COPY = [
  "You're running one restaurant service, start to finish. Guests arrive, wait for a table, get seated, eat, and leave. Your only goal: end the night with the highest profit.",
  "One fact matters more than any other: your kitchen team can only work on one full table at a time. A half-empty table still takes their full attention — so an empty seat isn't free, it's wasted capacity for that whole seating.",
  "Every choice tonight — how you group guests, how big your waiting area is, how fast tables turn over, how much you promote the restaurant — comes back to one question: how do I keep my kitchen team working at full capacity?",
];

// The welcome copy, the playlist with its real attempt caps, and the one rule
// students most often get wrong. Shared verbatim between Theater's intro screen
// and the Prepare tab so the projected version and the one on every student's
// own screen cannot drift apart.
export function IntroContent({ settings, projected = false }: { settings: ClassSettings; projected?: boolean }) {
  const guarded = settings.preparePageMode === 'guarded';
  // `projected` only scales type for the room — the words are identical.
  const body = projected ? 'text-xl lg:text-2xl' : '';

  return (
    <div className={projected ? 'text-left' : undefined}>
      {guarded ? (
        GUARDED_COPY.map((para) => (
          <p key={para} className={`mt-3 first:mt-0 text-[var(--color-text-secondary)] ${body}`}>
            {para}
          </p>
        ))
      ) : (
        <>
          <h1 className={projected ? 'text-4xl font-bold lg:text-5xl' : 'text-3xl font-bold'}>
            Welcome to Teppanyaki Tonight
          </h1>
          <p className={`mt-3 text-[var(--color-text-secondary)] ${body}`}>
            You are the manager-on-duty of a teppanyaki restaurant for a single evening service
            (6:00 PM–10:30 PM). Guests arrive, wait at the bar, and are seated in groups at
            chef-staffed grill tables. Your job is to choose operating policies — how you batch guests, how big the
            bar is, how long seatings run, how much you advertise — that make the most profit by the end of the night.
          </p>
          <p className={`mt-3 text-[var(--color-text-secondary)] ${body}`}>
            The one idea that runs through every challenge: <span className="text-[var(--color-text-primary)]">your
            chef is a batch server.</span> Seating a party of four at an eight-seat table doesn&apos;t just waste four
            chairs — it wastes <em>half the chef&apos;s capacity</em> for the entire length of that seating. Almost
            everything you discover tonight traces back to that fact.
          </p>
        </>
      )}

      <ChallengeRunSheet settings={settings} projected={projected} />
      <SubmitWarning projected={projected} />
    </div>
  );
}

// Read live from settings rather than written down anywhere: an instructor who
// changes an attempt cap five minutes before class must not be contradicted by
// the screen the room is reading.
function ChallengeRunSheet({ settings, projected }: { settings: ClassSettings; projected: boolean }) {
  const keys = activeChallengeKeys(settings);
  const items = keys
    .map((k) => CHALLENGE_BY_KEY[k])
    .filter(Boolean)
    .map((def, i) => ({
      key: def.key,
      n: i + 1,
      label: def.shortLabel,
      attempts: maxAttemptsFor(settings, def.key),
    }));
  if (!items.length) return null;

  return (
    <section className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2
        className={`mb-3 uppercase tracking-[0.2em] text-[var(--color-accent)] ${
          projected ? 'text-base' : 'text-xs'
        }`}
      >
        Tonight&apos;s challenges
      </h2>
      <ol className={`grid gap-2 sm:grid-cols-2 ${projected ? 'text-xl lg:text-2xl' : 'text-sm'}`}>
        {items.map((it) => (
          <li key={it.key} className="flex items-baseline gap-2">
            <span className="font-mono text-[var(--color-text-muted)]">{it.n}.</span>
            <span className="font-medium">{it.label}</span>
            <span className="text-[var(--color-text-secondary)]">
              — {it.attempts} {it.attempts === 1 ? 'attempt' : 'attempts'}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// Set apart on purpose: running and submitting are two different actions, and a
// student who conflates them ends the round with nothing on the board.
function SubmitWarning({ projected }: { projected: boolean }) {
  return (
    <p
      className={`mt-4 rounded-xl border-l-4 border-[var(--color-accent-amber)] bg-[var(--color-accent-amber)]/10 px-5 py-4 font-medium leading-snug ${
        projected ? 'text-2xl lg:text-3xl' : 'text-base'
      }`}
    >
      Running a simulation does not submit it. You must click &ldquo;Submit Best to Leaderboard&rdquo; or your result
      won&apos;t count.
    </p>
  );
}
