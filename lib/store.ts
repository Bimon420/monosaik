import { create } from 'zustand';

interface DiscoState {
  isDiscoEnabled: boolean;
  toggleDisco: () => void;
}

export const useDiscoStore = create<DiscoState>((set) => ({
  isDiscoEnabled: false,
  toggleDisco: () => set((state) => ({ isDiscoEnabled: !state.isDiscoEnabled })),
}));
