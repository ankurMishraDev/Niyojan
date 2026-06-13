import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';
import { db } from '../db/schema';
import { formsApi, surveysApi } from '../lib/services';

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
  syncData: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  isOffline: false,
  setUser: (user) => set({ user }),
  checkConnectivity: async () => {
    const state = await NetInfo.fetch();
    set({ isOffline: !state.isConnected });
    if (state.isConnected) {
      get().syncData();
    }
  },
  syncData: async () => {
    try {
      // 1. Sync local offline forms -> server
      const unsyncedForms = db.getAllSync('SELECT * FROM forms WHERE synced = 0') as any[];
      for (const form of unsyncedForms) {
        try {
          await formsApi.createTemplate({
            name: form.title,
            description: form.description,
            fields: JSON.parse(form.fields)
          });
          db.execSync(`UPDATE forms SET synced = 1 WHERE id = '${form.id}'`);
        } catch (err) {
          console.log('Failed to sync form:', form.id, err);
        }
      }

      // 2. Sync local offline surveys -> server
      const unsyncedSurveys = db.getAllSync('SELECT * FROM surveys WHERE synced = 0') as any[];
      for (const survey of unsyncedSurveys) {
        try {
          await surveysApi.submit({
            form_id: survey.formId,
            data: JSON.parse(survey.data)
          });
          db.execSync(`UPDATE surveys SET synced = 1 WHERE id = '${survey.id}'`);
        } catch (err) {
          console.log('Failed to sync survey:', survey.id, err);
        }
      }

      console.log('Data successfully synced to server');
    } catch (e) {
      console.log('Syncing data failed:', e);
    }
  }
}));

// Listen to network changes
NetInfo.addEventListener(state => {
  const isOffline = !state.isConnected;
  useAppStore.setState({ isOffline });
  if (!isOffline) {
    useAppStore.getState().syncData();
  }
});