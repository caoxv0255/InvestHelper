import { create } from "zustand";

interface AppState {
  activeNav: string;
  setActiveNav: (nav: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeNav: "dashboard",
  setActiveNav: (nav) => set({ activeNav: nav }),
}));
