import { useEffect, useState } from 'react';
import { getLogEntries, subscribeToLogs } from '../lib/logger';

export function useDiagnostics() {
  const [entries, setEntries] = useState(() => getLogEntries());

  useEffect(() => subscribeToLogs(setEntries), []);

  return entries;
}
