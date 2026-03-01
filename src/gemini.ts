import { type Habit, type DailyLog } from './db';
import { getExcuseFrequency, computeStreak, computeDailyScore, getDateStr } from './analytics';

const SYSTEM_INSTRUCTION = `You are a brutally honest behavioral performance analyst and personal discipline coach.
You have access to the user's habit tracking data. Analyze completion logs, excuse patterns, and discipline trends.
Identify repeated avoidance patterns, emotional triggers, and weak systems.
Provide analysis with no motivational fluff, no empty encouragement.
Be direct, concise, and strategic.

When doing a full analysis, respond in this format:
## 1. Behavioral Pattern Summary
## 2. Root Cause Diagnosis
## 3. Psychological Avoidance Indicators
## 4. Strategic Fix Plan
## 5. Weekly System Adjustment
## 6. Hard Truth

For regular chat questions, respond conversationally but stay brutally honest and data-driven.
Keep responses concise. Reference the user's actual data when relevant.`;

function buildDataContext(habits: Habit[], logs: DailyLog[]): string {
  const last30Days = logs.filter(l => l.date >= getDateStr(30));
  const excuseFreq = getExcuseFrequency(last30Days);

  const habitSummaries = habits.filter(h => !h.archived).map(h => {
    const hLogs = last30Days.filter(l => l.habitId === h.id);
    const completed = hLogs.filter(l => l.completed).length;
    const streak = computeStreak(h.id, logs);
    return {
      name: h.name,
      category: h.category,
      type: h.targetType,
      target: h.targetValue,
      completedDays: completed,
      totalLoggedDays: hLogs.length,
      completionRate: hLogs.length > 0 ? Math.round((completed / hLogs.length) * 100) : 0,
      currentStreak: streak,
      excuses: hLogs.filter(l => !l.completed && l.excuseTag).map(l => l.excuseTag),
    };
  });

  const dailyScores: { date: string; score: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const dateStr = getDateStr(i);
    const dayLogs = last30Days.filter(l => l.date === dateStr);
    dailyScores.push({ date: dateStr, score: computeDailyScore(habits, dayLogs) });
  }

  return JSON.stringify({
    habitSummaries,
    excuseFrequency: excuseFreq,
    disciplineScoreTrend: dailyScores,
    totalHabits: habits.length,
    period: 'Last 30 days',
  }, null, 2);
}

async function callGemini(apiKey: string, messages: { role: string; parts: { text: string }[] }[], systemInstruction?: string): Promise<string> {
  const body: Record<string, unknown> = {
    contents: messages,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  };

  if (systemInstruction) {
    body.system_instruction = { parts: [{ text: systemInstruction }] };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response from Gemini');
  return text;
}

export async function analyzeWithGemini(
  apiKey: string,
  habits: Habit[],
  logs: DailyLog[]
): Promise<string> {
  const dataContext = buildDataContext(habits, logs);
  const prompt = `Perform a full behavioral pattern analysis on this data:\n\n${dataContext}`;

  return callGemini(apiKey, [
    { role: 'user', parts: [{ text: prompt }] }
  ], SYSTEM_INSTRUCTION);
}

interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
}

export async function chatWithGemini(
  apiKey: string,
  userMessage: string,
  habits: Habit[],
  logs: DailyLog[],
  history: ChatMsg[]
): Promise<string> {
  const dataContext = buildDataContext(habits, logs);

  // Build context-aware system instruction with data
  const systemWithData = `${SYSTEM_INSTRUCTION}

USER'S CURRENT HABIT DATA (Last 30 days):
${dataContext}`;

  // Convert chat history to Gemini format (last 10 turns max)
  const recentHistory = history.slice(-10);
  const geminiMessages = recentHistory.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));

  // Add current user message
  geminiMessages.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  return callGemini(apiKey, geminiMessages, systemWithData);
}
