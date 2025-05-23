export type AllowedEvents = "SETTINGS_UPDATED";

class AppEventTarget {
  private readonly evtTarget = new EventTarget();

  subscribe<T>(event: AllowedEvents, onEvent: (data: T) => void) {
    const controller = new AbortController();

    this.evtTarget.addEventListener(
      event,
      //@ts-expect-error
      (e: CustomEvent<T>) => onEvent(e.detail),
      {
        signal: controller.signal,
      },
    );

    return () => {
      console.log("Unsubbing");
      controller.abort();
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
