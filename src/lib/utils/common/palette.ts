/** Brand-green palette for person/member avatar discs, cycled by slot position so
    a person's colour stays stable across the listing cards, settle-up, and editor. */
export const AVATAR_COLORS = ["#529471", "#83cc61", "#385455", "#6bae7e", "#4a7d63"];

export const avatarColor = (index: number): string => AVATAR_COLORS[index % AVATAR_COLORS.length];

/**
 * Avatar initials: first + last word initial ("Maya Smith" → "MS", "Person 2" →
 * "P2"), or the single initial for a one-word name. Empty for a blank name.
 */
export function nameInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
