type CustomEventListener<T> = (evt: CustomEvent<T>) => void;

export type AllowedEvents = "SETTINGS_UPDATED";

class AppEventTarget {
  private readonly evtTarget = new EventTarget();

  subscribe<T>(event: AllowedEvents, onEvent: (data: T) => void) {
    const handler: CustomEventListener<T> = (e) => {
      onEvent(e.detail);
    };
    this.evtTarget.addEventListener(event, handler);

    return () => {
      this.evtTarget.removeEventListener(event, handler);
    };
  }

  dispatch<T>(event: AllowedEvents, data: T) {
    const evt = new CustomEvent<T>(event, {
      detail: data,
    });
    this.evtTarget.dispatchEvent(evt);
  }
}

export const GlobalEventBus = new AppEventTarget();
