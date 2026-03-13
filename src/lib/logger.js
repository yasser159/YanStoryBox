const MAX_ENTRIES = 250;

const listeners = new Set();
const entries = [];

function notify() {
  const snapshot = [...entries];
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function push(entry) {
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  notify();
}

export function logEvent(level, event, details = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    level,
    event,
    details,
    timestamp: new Date().toISOString(),
  };

  const payload = `[Diagnostics] ${event}`;
  if (level === 'error') {
    console.error(payload, entry);
  } else if (level === 'warn') {
    console.warn(payload, entry);
  } else {
    console.log(payload, entry);
  }

  push(entry);
  return entry;
}

export function getLogEntries() {
  return [...entries];
}

export function subscribeToLogs(listener) {
  listeners.add(listener);
  listener(getLogEntries());
  return () => listeners.delete(listener);
}
