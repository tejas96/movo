import { createContext, useContext } from 'react';

/**
 * A scrolling Screen provides this. Input calls it on focus so the field ends up above the
 * keyboard (and the BottomBar), which Android does not do reliably with an edge-to-edge window.
 */
export const RevealFocusedContext = createContext<(() => void) | null>(null);

export function useRevealFocused(): (() => void) | null {
  return useContext(RevealFocusedContext);
}
