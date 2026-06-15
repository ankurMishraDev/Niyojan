import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';
import { flush, cacheTemplatesForOffline } from '../lib/syncService';

interface User {
  id: string;
  role: 'ngo' | 'volunteer';
  name: string;
  email: string;
  organizationName?: string;
}

interface AppState {
  user: User | null;
  isOffline: boolean;
  setUser: (user: User | null) => void;
  checkConnectivity: () => Promise<void>;
  onConnected: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  isOffline: false,
  setUser: (user) => set({ user }),
  checkConnectivity: async () => {
    const state = await NetInfo.fetch();
    const isOffline = !state.isConnected;
    set({ isOffline });
    if (!isOffline) {
      void cacheTemplatesForOffline();
      void flush();
    }
  },
  onConnected: async () => {
    set({ isOffline: false });
    void cacheTemplatesForOffline();
    void flush();
  },
}));

// NetInfo listener — replaces the broken syncData approach
NetInfo.addEventListener((state) => {
  const isOffline = !state.isConnected;
  useAppStore.setState({ isOffline });
  if (!isOffline) {
    void cacheTemplatesForOffline();
    void flush();
  }
});
