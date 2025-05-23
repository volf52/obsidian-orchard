import type { OrchardSettings } from "@/settings/types";
import { type AllowedEvents, GlobalEventBus } from "./app-event-target";

const Event: AllowedEvents = "SETTINGS_UPDATED";

let pendingSubs: Array<() => void> = [];

export const notifySettingUpdate = (settings: OrchardSettings) =>
  GlobalEventBus.dispatch(Event, settings);

export const onSettingUpdate = (fn: (s: OrchardSettings) => void) => {
  const unsub = GlobalEventBus.subscribe(Event, fn);

  pendingSubs.push(unsub);

  return unsub;
};

export const clearAllSettingUpdates = () => {
  for (const unsub of pendingSubs) {
    unsub();
  }
  pendingSubs = [];
};
