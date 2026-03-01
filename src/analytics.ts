import { type Habit, type DailyLog } from './db';

export const EXCUSE_OPTIONS = [
  'Lazy',
  'Distracted',
  'No time',
  'Low energy',
  'Emotional issue',
  'Forgot',
  'Avoided deliberately',
  'Other',
] as const;

export type ExcuseTag = typeof EXCUSE_OPTIONS[number];

export function getDateStr(daysAgo: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

export function getDaysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  while (s <= e) {
    days.push(s.toISOString().split('T')[0]);
    s.setDate(s.getDate() + 1);
  }
  return days;
}

export function computeDailyScore(habits: Habit[], logs: DailyLog[]): number {
  if (habits.length === 0) return 0;
  const completed = logs.filter(l => l.completed).length;
  const baseScore = completed / habits.length;

  // Penalty for repeated excuses
  const excuseCounts: Record<string, number> = {};
  logs.filter(l => !l.completed && l.excuseTag).forEach(l => {
    excuseCounts[l.excuseTag!] = (excuseCounts[l.excuseTag!] || 0) + 1;
  });

  let penalty = 0;
  Object.values(excuseCounts).forEach(count => {
    if (count > 1) penalty += count * 0.03;
  });

  return Math.max(0, Math.min(100, Math.round((baseScore - penalty) * 100)));
}

export function computeStreak(habitId: string, logs: DailyLog[]): number {
  const habitLogs = logs.filter(l => l.habitId === habitId);
  const logMap = new Map<string, boolean>();
  habitLogs.forEach(l => logMap.set(l.date, l.completed));

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    if (logMap.get(dateStr) === true) {
      streak++;
    } else if (logMap.has(dateStr)) {
      break;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

export function computeMaxStreak(habitId: string, logs: DailyLog[]): number {
  const habitLogs = logs
    .filter(l => l.habitId === habitId && l.completed)
    .sort((a, b) => a.date.localeCompare(b.date));
  
  if (habitLogs.length === 0) return 0;
  
  let maxStreak = 1;
  let currentStreak = 1;
  
  for (let i = 1; i < habitLogs.length; i++) {
    const prev = new Date(habitLogs[i - 1].date + 'T00:00:00');
    const curr = new Date(habitLogs[i].date + 'T00:00:00');
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  return maxStreak;
}

export function getExcuseFrequency(logs: DailyLog[]): Record<string, number> {
  const freq: Record<string, number> = {};
  logs.filter(l => !l.completed && l.excuseTag).forEach(l => {
    freq[l.excuseTag!] = (freq[l.excuseTag!] || 0) + 1;
  });
  return freq;
}

export function getMostCommonExcuse(logs: DailyLog[]): string | null {
  const freq = getExcuseFrequency(logs);
  const entries = Object.entries(freq);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export function getWorstHabit(habits: Habit[], logs: DailyLog[]): Habit | null {
  if (habits.length === 0) return null;
  let worst: Habit | null = null;
  let worstRate = 1;

  habits.forEach(h => {
    const hLogs = logs.filter(l => l.habitId === h.id);
    if (hLogs.length === 0) return;
    const completed = hLogs.filter(l => l.completed).length;
    const rate = completed / hLogs.length;
    if (rate < worstRate) {
      worstRate = rate;
      worst = h;
    }
  });
  return worst;
}

export function getWeeklyScores(habits: Habit[], logs: DailyLog[], weeks: number = 4): { date: string; score: number }[] {
  const scores: { date: string; score: number }[] = [];
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const dateStr = getDateStr(i);
    const dayLogs = logs.filter(l => l.date === dateStr);
    const score = computeDailyScore(habits, dayLogs);
    scores.push({ date: dateStr, score });
  }
  return scores;
}

export function getHeatmapData(logs: DailyLog[], _habits: Habit[]): Map<string, number> {
  const map = new Map<string, number>();
  
  // Get all dates from last 364 days
  for (let i = 363; i >= 0; i--) {
    const dateStr = getDateStr(i);
    const dayLogs = logs.filter(l => l.date === dateStr);
    if (dayLogs.length === 0) {
      map.set(dateStr, -1); // no data
    } else {
      const completed = dayLogs.filter(l => l.completed).length;
      map.set(dateStr, dayLogs.length > 0 ? completed / dayLogs.length : 0);
    }
  }
  return map;
}

export function getCompletionRate7Days(logs: DailyLog[]): number[] {
  const rates: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const dateStr = getDateStr(i);
    const dayLogs = logs.filter(l => l.date === dateStr);
    if (dayLogs.length === 0) {
      rates.push(0);
    } else {
      rates.push(dayLogs.filter(l => l.completed).length / dayLogs.length);
    }
  }
  return rates;
}
