import type { OrchardSettings } from "../settings";

type SettingUpdateSub = (s: OrchardSettings) => void;

type CustomEventListener<T> = (evt: CustomEvent<T>) => void;

const EVENTS = {
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
} as const;

class AppEventTarget {
  private readonly mapping = new Map<SettingUpdateSub, EventListener>();
  private readonly evtTarget = new EventTarget();

  notifySettingUpdate(settings: OrchardSettings) {
    const evt = new CustomEvent<OrchardSettings>(EVENTS.SETTINGS_UPDATED, {
      detail: settings,
    });
    this.evtTarget.dispatchEvent(evt);
  }

  onSettingUpdate(fn: SettingUpdateSub) {
    const handler: CustomEventListener<OrchardSettings> = (e) => {
      fn(e.detail);
    };

    this.evtTarget.addEventListener(EVENTS.SETTINGS_UPDATED, handler);
    this.mapping.set(fn, handler);
  }

  offSettingUpdate(fn: SettingUpdateSub) {
    const handler = this.mapping.get(fn);
    if (handler) {
      this.evtTarget.removeEventListener(EVENTS.SETTINGS_UPDATED, handler);
    }
  }

  clear() {
    for (const handler of this.mapping.values()) {
      this.evtTarget.removeEventListener(EVENTS.SETTINGS_UPDATED, handler);
    }
  }
}

export default AppEventTarget;
