/**
 * Roots every query key hangs off. Each feature builds its own keys in `features/<x>/keys.ts`.
 * Society keys start with the society id so switching societies never shows stale data.
 */
export const meKey = ['me'] as const;

export const societyKey = (societyId: string) => ['society', societyId] as const;

/** Every society's data at once. */
export const anySocietyKey = ['society'] as const;
