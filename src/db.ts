import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'ruthless-db';
const DB_VERSION = 1;

export interface Habit {
  id: string;
  name: string;
  icon: string;
  category: string;
  targetType: 'boolean' | 'numeric';
  targetValue: number | null;
  archived: boolean;
  order: number;
  createdAt: number;
}

export interface DailyLog {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  value: number | null;
  completed: boolean;
  excuseTag: string | null;
  reflectionText: string | null;
  loggedAt: number;
}

export interface AIAnalysis {
  id: string;
  generatedAt: number;
  summary: string;
  storedSnapshotOfData: string;
}

export interface AppSettings {
  geminiApiKey: string;
  hapticFeedback: boolean;
  strictExcuseEnforcement: boolean;
}

export function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

let dbInstance: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('habits')) {
        const habitStore = db.createObjectStore('habits', { keyPath: 'id' });
        habitStore.createIndex('archived', 'archived');
        habitStore.createIndex('order', 'order');
      }
      if (!db.objectStoreNames.contains('logs')) {
        const logStore = db.createObjectStore('logs', { keyPath: 'id' });
        logStore.createIndex('habitId', 'habitId');
        logStore.createIndex('date', 'date');
        logStore.createIndex('habitDate', ['habitId', 'date']);
      }
      if (!db.objectStoreNames.contains('analyses')) {
        db.createObjectStore('analyses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
  });
  return dbInstance;
}

// Habits
export async function getAllHabits(): Promise<Habit[]> {
  const db = await getDB();
  const habits = await db.getAll('habits');
  return habits.sort((a, b) => a.order - b.order);
}

export async function getActiveHabits(): Promise<Habit[]> {
  const all = await getAllHabits();
  return all.filter(h => !h.archived);
}

export async function addHabit(habit: Habit): Promise<void> {
  const db = await getDB();
  await db.put('habits', habit);
}

export async function updateHabit(habit: Habit): Promise<void> {
  const db = await getDB();
  await db.put('habits', habit);
}

export async function deleteHabit(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('habits', id);
  // Delete associated logs
  const logs = await getLogsByHabit(id);
  const tx = db.transaction('logs', 'readwrite');
  for (const log of logs) {
    await tx.store.delete(log.id);
  }
  await tx.done;
}

// Logs
export async function getLogsByDate(date: string): Promise<DailyLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('logs', 'date', date);
}

export async function getLogsByHabit(habitId: string): Promise<DailyLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('logs', 'habitId', habitId);
}

export async function getLogForHabitDate(habitId: string, date: string): Promise<DailyLog | undefined> {
  const db = await getDB();
  const results = await db.getAllFromIndex('logs', 'habitDate', [habitId, date]);
  return results[0];
}

export async function addLog(log: DailyLog): Promise<void> {
  const db = await getDB();
  await db.put('logs', log);
}

export async function updateLog(log: DailyLog): Promise<void> {
  const db = await getDB();
  await db.put('logs', log);
}

export async function getAllLogs(): Promise<DailyLog[]> {
  const db = await getDB();
  return db.getAll('logs');
}

// AI Analyses
export async function saveAnalysis(analysis: AIAnalysis): Promise<void> {
  const db = await getDB();
  await db.put('analyses', analysis);
}

export async function getAllAnalyses(): Promise<AIAnalysis[]> {
  const db = await getDB();
  const all = await db.getAll('analyses');
  return all.sort((a, b) => b.generatedAt - a.generatedAt);
}

// Settings
export async function getSetting(key: string): Promise<any> {
  const db = await getDB();
  const result = await db.get('settings', key);
  return result?.value;
}

export async function setSetting(key: string, value: any): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key, value });
}

// Export/Import
export async function exportAllData(): Promise<string> {
  const habits = await getAllHabits();
  const logs = await getAllLogs();
  const analyses = await getAllAnalyses();
  return JSON.stringify({ habits, logs, analyses, exportedAt: Date.now() }, null, 2);
}

export async function importAllData(jsonStr: string): Promise<void> {
  const data = JSON.parse(jsonStr);
  const db = await getDB();
  
  if (data.habits) {
    const tx = db.transaction('habits', 'readwrite');
    for (const h of data.habits) await tx.store.put(h);
    await tx.done;
  }
  if (data.logs) {
    const tx = db.transaction('logs', 'readwrite');
    for (const l of data.logs) await tx.store.put(l);
    await tx.done;
  }
  if (data.analyses) {
    const tx = db.transaction('analyses', 'readwrite');
    for (const a of data.analyses) await tx.store.put(a);
    await tx.done;
  }
}

export async function resetAllData(): Promise<void> {
  const db = await getDB();
  await db.clear('habits');
  await db.clear('logs');
  await db.clear('analyses');
  await db.clear('settings');
}

// Get logs for date range
export async function getLogsInRange(startDate: string, endDate: string): Promise<DailyLog[]> {
  const allLogs = await getAllLogs();
  return allLogs.filter(l => l.date >= startDate && l.date <= endDate);
}
