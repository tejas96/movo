import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '../storage/mmkv';

interface TenantState {
  activeSocietyId: string | null;
  setActiveSocietyId: (id: string | null) => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({ activeSocietyId: null, setActiveSocietyId: (id) => set({ activeSocietyId: id }) }),
    {
      name: 'movo.tenant',
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
