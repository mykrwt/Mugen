import { useState, useEffect, useCallback } from 'react';
import * as db from './db';
import type { Habit, DailyLog } from './db';

export function useHabits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const h = await db.getActiveHabits();
    setHabits(h);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { habits, loading, refresh };
}

export function useLogs(date?: string) {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (date) {
      const l = await db.getLogsByDate(date);
      setLogs(l);
    } else {
      const l = await db.getAllLogs();
      setLogs(l);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => { refresh(); }, [refresh]);
  return { logs, loading, refresh };
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useSetting<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    db.getSetting(key).then(v => {
      if (v !== undefined) setValue(v);
      setLoaded(true);
    });
  }, [key]);

  const update = useCallback(async (newVal: T) => {
    setValue(newVal);
    await db.setSetting(key, newVal);
  }, [key]);

  return { value, update, loaded };
}
