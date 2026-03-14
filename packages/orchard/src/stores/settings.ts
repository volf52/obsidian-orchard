import type { StoreApi } from 'zustand/vanilla'
import { createStore } from 'zustand/vanilla'
import type { OrchardSettings } from '@/settings/types'

interface SettingsStore {
  settings: OrchardSettings
  updateSettings: (settings: OrchardSettings) => void
  updateSettingKeys: (updates: Partial<OrchardSettings>) => void
  resetSettings: (defaultSettings: OrchardSettings) => void
}

let settingsStore: StoreApi<SettingsStore> | null = null

export const initializeSettingsStore = (
  initialSettings: OrchardSettings,
): StoreApi<SettingsStore> => {
  if (settingsStore) {
    settingsStore.getState().updateSettings(initialSettings)
    return settingsStore
  }

  settingsStore = createStore<SettingsStore>((set) => ({
    settings: initialSettings,
    updateSettings: (settings: OrchardSettings) => {
      set({ settings })
    },
    updateSettingKeys: (updates: Partial<OrchardSettings>) => {
      set((state) => ({
        settings: { ...state.settings, ...updates },
      }))
    },
    resetSettings: (defaultSettings: OrchardSettings) => {
      set({ settings: { ...defaultSettings } })
    },
  }))

  return settingsStore
}

export const getSettingsStore = (): StoreApi<SettingsStore> => {
  if (!settingsStore) {
    throw new Error(
      'Settings store not initialized. Call initializeSettingsStore first.',
    )
  }
  return settingsStore
}

export const updateSettings = (newSettings: OrchardSettings): void => {
  getSettingsStore().getState().updateSettings(newSettings)
}

export const updateSettingKeys = (updates: Partial<OrchardSettings>): void => {
  getSettingsStore().getState().updateSettingKeys(updates)
}

export const onSettingsChange = (
  callback: (settings: OrchardSettings) => void,
): (() => void) => {
  const store = getSettingsStore()
  return store.subscribe((state: SettingsStore) => callback(state.settings))
}

export const onSettingChange = <K extends keyof OrchardSettings>(
  key: K,
  callback: (value: OrchardSettings[K]) => void,
): (() => void) => {
  const store = getSettingsStore()
  let previousValue = store.getState().settings[key]

  return store.subscribe((state: SettingsStore) => {
    const currentValue = state.settings[key]
    if (currentValue !== previousValue) {
      previousValue = currentValue
      callback(currentValue)
    }
  })
}

export const getCurrentSettings = (): OrchardSettings => {
  return getSettingsStore().getState().settings
}

export const resetSettings = (defaultSettings: OrchardSettings): void => {
  getSettingsStore().getState().resetSettings(defaultSettings)
}

let allSubscriptions: Array<() => void> = []

export const trackSubscription = (unsub: () => void): void => {
  allSubscriptions.push(unsub)
}

export const clearAllSubscriptions = (): void => {
  for (const unsub of allSubscriptions) {
    try {
      unsub()
    } catch (error) {
      console.error('Error cleaning up subscription:', error)
    }
  }
  allSubscriptions = []
}

export const resetSettingsStore = (): void => {
  clearAllSubscriptions()
  settingsStore = null
}
