import { useTranslation } from 'react-i18next';
import { errorCode } from './errors';

/** Maps any thrown error to a translated sentence. Server messages never reach the screen. */
export function useErrorMessage(): (error: unknown) => string {
  const { t } = useTranslation('errors');
  return (error) => {
    const code = errorCode(error);
    return t(code as 'INTERNAL');
  };
}
