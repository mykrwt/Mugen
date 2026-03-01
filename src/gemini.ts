import { type Habit, type DailyLog } from './db';
import { getExcuseFrequency, computeStreak, computeDailyScore, getDateStr } from './analytics';

const SYSTEM_INSTRUCTION = `You are a brutally honest behavioral performance analyst and personal discipline coach.
You analyze habit tracking data: completion logs, excuse patterns, discipline trends.
Identify repeated avoidance patterns, emotional triggers, and weak systems.
Be direct, concise, strategic. No fluff, no empty encouragement, no filler words.
Reference actual numbers from the data. Be specific.

When doing a FULL ANALYSIS, use exactly these headers:
## 1. Behavioral Pattern Summary
## 2. Root Cause Diagnosis
## 3. Psychological Avoidance Indicators
## 4. Strategic Fix Plan
## 5. Weekly System Adjustment
## 6. Hard Truth

For regular chat, respond conversationally but stay honest and data-driven. Keep it short.`;

function buildDataContext(habits: Habit[], logs: DailyLog[]): string {
  const cutoff = getDateStr(30);
  const last30Days = logs.filter(l => l.date >= cutoff);
  const excuseFreq = getExcuseFrequency(last30Days);

  const habitSummaries = habits.filter(h => !h.archived).map(h => {
    const hLogs = last30Days.filter(l => l.habitId === h.id);
    const completed = hLogs.filter(l => l.completed).length;
    const streak = computeStreak(h.id, logs);
    const excuses = hLogs
      .filter(l => !l.completed && l.excuseTag)
      .map(l => l.excuseTag)
      .filter(Boolean);

    return {
      name: h.name,
      category: h.category,
      type: h.targetType,
      completedDays: completed,
      totalLoggedDays: hLogs.length,
      completionRate: `${hLogs.length > 0 ? Math.round((completed / hLogs.length) * 100) : 0}%`,
      currentStreak: `${streak} days`,
      topExcuses: excuses.slice(0, 5),
    };
  });

  const dailyScores: { date: string; score: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const dateStr = getDateStr(i);
    const dayLogs = last30Days.filter(l => l.date === dateStr);
    dailyScores.push({ date: dateStr, score: computeDailyScore(habits, dayLogs) });
  }

  const avgScore = dailyScores.length > 0
    ? Math.round(dailyScores.reduce((s, d) => s + d.score, 0) / dailyScores.length)
    : 0;

  return JSON.stringify({
    summary: {
      totalActiveHabits: habits.filter(h => !h.archived).length,
      analysisPeriod: 'Last 30 days',
      averageDisciplineScore: `${avgScore}%`,
      totalLogsAnalyzed: last30Days.length,
    },
    habitSummaries,
    excuseFrequency: excuseFreq,
    disciplineScoreTrend: {
      last7Days: dailyScores.slice(-7),
      last30DaysAvg: `${avgScore}%`,
    },
  }, null, 2);
}

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
  promptFeedback?: {
    blockReason?: string;
  };
}

// Try multiple models in order of preference
const MODELS_TO_TRY = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-pro',
];

async function callGeminiModel(
  apiKey: string,
  model: string,
  messages: GeminiContent[],
  systemInstruction?: string
): Promise<string> {
  const body: Record<string, unknown> = {
    contents: messages,
    generationConfig: {
      temperature: 0.75,
      maxOutputTokens: 1500,
      topP: 0.9,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new Error(`NETWORK_ERROR: ${(networkErr as Error).message}`);
  }

  const rawText = await response.text();

  if (!response.ok) {
    // Parse error details
    let errData: GeminiResponse = {};
    try { errData = JSON.parse(rawText); } catch { /* ignore */ }

    const code = response.status;
    const errMsg = errData.error?.message || rawText.slice(0, 200);
    const errStatus = errData.error?.status || '';

    if (code === 429 || errStatus === 'RESOURCE_EXHAUSTED') {
      throw new Error(`RATE_LIMIT: ${errMsg}`);
    }
    if (code === 401 || code === 403 || errStatus === 'PERMISSION_DENIED' || errStatus === 'UNAUTHENTICATED') {
      throw new Error(`INVALID_KEY: ${errMsg}`);
    }
    if (code === 404) {
      throw new Error(`MODEL_NOT_FOUND: ${model}`);
    }
    if (code === 400) {
      throw new Error(`BAD_REQUEST: ${errMsg}`);
    }
    if (code >= 500) {
      throw new Error(`SERVER_ERROR_${code}: ${errMsg}`);
    }
    throw new Error(`API_ERROR_${code}: ${errMsg}`);
  }

  let data: GeminiResponse;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`PARSE_ERROR: Could not parse response`);
  }

  // Check for blocked content
  if (data.promptFeedback?.blockReason) {
    throw new Error(`BLOCKED: ${data.promptFeedback.blockReason}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY') {
      throw new Error('SAFETY_BLOCK: Response blocked by safety filters');
    }
    throw new Error(`EMPTY_RESPONSE: No text in response (finishReason: ${finishReason || 'unknown'})`);
  }

  return text;
}

async function callGemini(
  apiKey: string,
  messages: GeminiContent[],
  systemInstruction?: string
): Promise<string> {
  let lastError: Error = new Error('No models tried');

  for (const model of MODELS_TO_TRY) {
    try {
      const result = await callGeminiModel(apiKey, model, messages, systemInstruction);
      return result;
    } catch (err) {
      const errMsg = (err as Error).message || '';

      // Don't retry on auth/key errors — fail immediately
      if (errMsg.startsWith('INVALID_KEY') || errMsg.startsWith('RATE_LIMIT') ||
          errMsg.startsWith('BAD_REQUEST') || errMsg.startsWith('NETWORK_ERROR') ||
          errMsg.startsWith('BLOCKED') || errMsg.startsWith('SAFETY_BLOCK')) {
        throw err;
      }

      // For model not found or server errors, try next model
      lastError = err as Error;
      console.warn(`Model ${model} failed: ${errMsg}, trying next...`);
      continue;
    }
  }

  throw lastError;
}

export async function analyzeWithGemini(
  apiKey: string,
  habits: Habit[],
  logs: DailyLog[]
): Promise<string> {
  if (!apiKey || apiKey.trim().length < 10) {
    throw new Error('INVALID_KEY: API key is empty or too short');
  }

  const dataContext = buildDataContext(habits, logs);
  const prompt = `Perform a full behavioral pattern analysis on my habit tracking data:\n\n${dataContext}\n\nBe specific with the numbers. Be blunt.`;

  return callGemini(
    apiKey.trim(),
    [{ role: 'user', parts: [{ text: prompt }] }],
    SYSTEM_INSTRUCTION
  );
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
  if (!apiKey || apiKey.trim().length < 10) {
    throw new Error('INVALID_KEY: API key is empty or too short');
  }

  const dataContext = buildDataContext(habits, logs);

  const systemWithData = `${SYSTEM_INSTRUCTION}

USER'S HABIT DATA (Last 30 days):
${dataContext}

Keep responses concise. Reference specific habits and numbers from the data when relevant.`;

  // Build conversation history (last 8 turns to avoid token limits)
  const recentHistory = history.slice(-8);
  const geminiMessages: GeminiContent[] = recentHistory.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));

  // Add current message
  geminiMessages.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  return callGemini(apiKey.trim(), geminiMessages, systemWithData);
}
