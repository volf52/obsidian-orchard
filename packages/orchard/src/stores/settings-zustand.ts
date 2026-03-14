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

/**
 * Initialize the singleton settings store or replace its settings with the provided initial settings.
 *
 * @param initialSettings - The OrchardSettings to use for initializing the store or to replace the store's current settings.
 * @returns The singleton StoreApi instance for the settings store
 */
export function initializeSettingsStore(
  initialSettings: OrchardSettings,
): StoreApi<SettingsStore> {
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

/**
 * Retrieve the initialized settings store.
 *
 * @throws If the settings store has not been initialized via `initializeSettingsStore`.
 * @returns The initialized settings store.
 */
export function getSettingsStore(): StoreApi<SettingsStore> {
  if (!settingsStore) {
    throw new Error(
      'Settings store not initialized. Call initializeSettingsStore first.',
    )
  }
  return settingsStore
}

/**
 * Replace the current settings in the store with the provided settings.
 *
 * @param newSettings - The complete OrchardSettings object to set as the store's current settings
 */
export function updateSettings(newSettings: OrchardSettings): void {
  getSettingsStore().getState().updateSettings(newSettings)
}

/**
 * Merge the provided partial settings into the current Orchard settings.
 *
 * @param updates - Partial settings to shallow-merge into the existing settings; keys in `updates` overwrite current values
 */
export function updateSettingKeys(updates: Partial<OrchardSettings>): void {
  getSettingsStore().getState().updateSettingKeys(updates)
}

/**
 * Subscribe to updates of the entire settings object.
 *
 * @param callback - Invoked with the current `OrchardSettings` whenever the settings change
 * @returns A function that unsubscribes and stops further callbacks when called
 */
export function onSettingsChange(
  callback: (settings: OrchardSettings) => void,
): () => void {
  const store = getSettingsStore()
  return store.subscribe((state: SettingsStore) => callback(state.settings))
}

/**
 * Subscribe to changes for a single settings property and invoke a callback when its value changes.
 *
 * @param key - The settings property key to observe.
 * @param callback - Called with the new value whenever the specified key's value changes.
 * @returns A function that unsubscribes the listener.
 */
export function onSettingChange<K extends keyof OrchardSettings>(
  key: K,
  callback: (value: OrchardSettings[K]) => void,
): () => void {
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

/**
 * Retrieve the current Orchard settings from the initialized store.
 *
 * @returns The current `OrchardSettings` object held in the settings store.
 */
export function getCurrentSettings(): OrchardSettings {
  return getSettingsStore().getState().settings
}

/**
 * Reset the settings store to the provided default settings.
 *
 * @param defaultSettings - Default Orchard settings used to replace the current settings; a copy of this object will become the new store state
 */
export function resetSettings(defaultSettings: OrchardSettings): void {
  getSettingsStore().getState().resetSettings(defaultSettings)
}

let allSubscriptions: Array<() => void> = []

/**
 * Registers an unsubscribe function for later collective cleanup.
 *
 * @param unsub - The unsubscribe function to track for future cleanup
 */
export function trackSubscription(unsub: () => void): void {
  allSubscriptions.push(unsub)
}

/**
 * Unsubscribes all tracked subscriptions and clears the internal subscription list.
 *
 * Calls each registered unsubscribe function; if an unsubscribe throws, the error is logged
 * and cleanup continues for the remaining subscriptions.
 */
export function clearAllSubscriptions(): void {
  for (const unsub of allSubscriptions) {
    try {
      unsub()
    } catch (error) {
      console.error('Error cleaning up subscription:', error)
    }
  }
  allSubscriptions = []
}

/**
 * Reset the module-level settings store to an uninitialized state and unsubscribe all tracked subscriptions.
 *
 * Clears any registered subscription handlers and sets the internal settings store reference to `null`
 * so the store must be reinitialized before use.
 */
export function resetSettingsStore(): void {
  clearAllSubscriptions()
  settingsStore = null
}
