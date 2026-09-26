import { useEffect, useRef } from 'react';
import { bootstrapSession } from './auth';

export function useBootstrap(): void {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void bootstrapSession();
  }, []);
}
