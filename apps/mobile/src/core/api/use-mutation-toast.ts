import { useToast } from '@movo/design-system';
import { useErrorMessage } from './use-error-message';

/**
 * Runs a piece of mutation work and turns any failure into an error toast, so screens stop
 * repeating `try { await m.mutateAsync() } catch (e) { toast.show(toMessage(e), 'error') }`.
 * Resolves to true when the work finished, false when it failed (the toast is already shown).
 */
export function useMutationToast(): (work: () => Promise<unknown>) => Promise<boolean> {
  const toast = useToast();
  const toMessage = useErrorMessage();
  return async (work) => {
    try {
      await work();
      return true;
    } catch (e) {
      toast.show(toMessage(e), 'error');
      return false;
    }
  };
}
