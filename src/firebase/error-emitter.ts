'use client';

type ErrorEvents = {
  'permission-error': (error: any) => void;
};

type ErrorListener<K extends keyof ErrorEvents> = (
  ...args: Parameters<ErrorEvents[K]>
) => void;

class ErrorEmitter {
  private listeners: { [K in keyof ErrorEvents]?: ErrorListener<K>[] } = {};

  on<K extends keyof ErrorEvents>(event: K, listener: ErrorListener<K>) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event]?.push(listener);
  }

  off<K extends keyof ErrorEvents>(event: K, listener: ErrorListener<K>) {
    this.listeners[event] = this.listeners[event]?.filter(l => l !== listener);
  }

  emit<K extends keyof ErrorEvents>(event: K, ...args: Parameters<ErrorEvents[K]>) {
    this.listeners[event]?.forEach(listener => {
      listener(...args);
    });
  }
}

export const errorEmitter = new ErrorEmitter();
