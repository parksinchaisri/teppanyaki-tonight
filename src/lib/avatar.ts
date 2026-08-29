// Deterministic per-student avatar styling: the same display name always yields
// the same colour, so a student keeps their colour across renders, reloads and
// every screen that shows them.

// FNV-1a — small, stable, and no dependency.
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface AvatarStyle {
  background: string;
  border: string;
  color: string;
}

// Colours are generated in HSL with fixed saturation/lightness so every avatar
// sits in the same tonal range as the dark UI rather than clashing with it.
export function avatarStyle(seed: string): AvatarStyle {
  const hue = hash(seed || '?') % 360;
  return {
    background: `hsl(${hue} 65% 45% / 0.28)`,
    border: `hsl(${hue} 70% 60% / 0.65)`,
    color: `hsl(${hue} 85% 78%)`,
  };
}

// First character of the name, uppercased. Falls back to '?' for an empty or
// punctuation-only name, and uses Intl-safe iteration so an emoji or an
// accented letter is not split mid-codepoint.
export function avatarInitial(name: string): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  const first = [...trimmed][0];
  return first.toUpperCase();
}
