// Minimal synchronous event bus used by the game and engine modules.
// Handler exceptions are caught and logged so one listener cannot stop the rest.

/**
 * @returns {{on: Function, off: Function, emit: Function}}
 */
export function createEvents() {
  const handlers = new Map();

  return {
    on(name, handler) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(handler);
      return () => this.off(name, handler);
    },
    off(name, handler) {
      const list = handlers.get(name);
      if (list) {
        const index = list.indexOf(handler);
        if (index >= 0) list.splice(index, 1);
      }
    },
    emit(name, payload) {
      const list = handlers.get(name);
      if (list) {
        for (let i = 0; i < list.length; i++) {
          try {
            list[i](payload);
          } catch (error) {
            console.error(`[events] handler for "${name}" threw`, error);
          }
        }
      }
    },
  };
}
