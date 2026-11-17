import { useEffect, useState } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

type Listener = (message: ToastMessage) => void;
const listeners = new Set<Listener>();
let nextToastId = 1;

/** Shows a short notification at the bottom of the screen. */
export function notify(text: string, kind: 'info' | 'error' = 'info'): void {
  const message = { id: nextToastId++, text, kind };
  listeners.forEach((listener) => listener(message));
}

export function Toasts() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  useEffect(() => {
    const listener: Listener = (message) => {
      setMessages((list) => [...list.slice(-2), message]);
      window.setTimeout(
        () => setMessages((list) => list.filter((m) => m.id !== message.id)),
        message.kind === 'error' ? 6000 : 3200,
      );
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return (
    <div className="toasts" aria-live="polite">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`toast ${m.kind}`}
          role={m.kind === 'error' ? 'alert' : 'status'}
        >
          {m.text}
        </div>
      ))}
    </div>
  );
}
