/** Brand-green palette for person/member avatar discs, cycled by slot position so
    a person's colour stays stable across the listing cards, settle-up, and editor. */
export const AVATAR_COLORS = ["#529471", "#83cc61", "#385455", "#6bae7e", "#4a7d63"];

export const avatarColor = (index: number): string => AVATAR_COLORS[index % AVATAR_COLORS.length];
