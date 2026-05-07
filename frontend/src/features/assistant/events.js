const listeners = new Set();

export function subscribeAssistantEvents(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitAssistantEvent(event) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // Ignore listener failures to keep the assistant optional.
    }
  });
}

