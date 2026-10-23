import { createContext, useContext } from 'react';

/**
 * True inside a glass card. Rows read it and drop their own glass pill, so a list in a card
 * looks like the mockup's grouped lists (one card, plain rows) without each screen passing
 * `onGray`.
 */
export const InGlass = createContext(false);

export function useInGlass(): boolean {
  return useContext(InGlass);
}
