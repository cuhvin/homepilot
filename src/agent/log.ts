// Append-only audit log of everything the agent does. Persisted in this browser
// (localStorage, best effort) and downloadable as JSON from the History tab.

export type LogType =
  | 'request' | 'llm' | 'llm_error' | 'validation' | 'blocked' | 'execute'
  | 'confirm' | 'reject' | 'schedule' | 'scheduled_run' | 'safety' | 'event' | 'system';

export interface LogEntry {
  id: string;
  at: string; // real ISO timestamp
  sim: string; // simulated clock label
  type: LogType;
  message: string;
  data?: unknown;
}

const KEY = 'homepilot.audit.v1';
const MAX = 400;

export function loadLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(-MAX) : [];
  } catch {
    return [];
  }
}

export function saveLog(entries: LogEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX)));
  } catch {
    /* storage unavailable (private mode / quota): keep in memory only */
  }
}

let counter = 0;
export function makeEntry(type: LogType, sim: string, message: string, data?: unknown): LogEntry {
  counter++;
  return { id: `${Date.now().toString(36)}-${counter}`, at: new Date().toISOString(), sim, type, message, data };
}

export function downloadLog(entries: LogEntry[]): void {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `homepilot-audit-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
