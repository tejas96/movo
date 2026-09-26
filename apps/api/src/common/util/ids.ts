import { uuidv7 } from 'uuidv7';

/** Time-sortable UUID v7. */
export function newId(): string {
  return uuidv7();
}
