import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  BarChart3, TrendingUp, AlertTriangle, Flame,
  Trophy, Target, Brain, WifiOff, Loader2,
  Zap, RefreshCw, ShieldAlert, AlertCircle,
  Send, Sparkles, Clock, ChevronDown, ChevronUp, KeyRound,
} from 'lucide-react';
import type { Habit, DailyLog, AIAnalysis } from '../db';
import { getSetting, saveAnalysis, getAllAnalyses, generateId } from '../db';
import { analyzeWithGemini, chatWithGemini } from '../gemini';
import Icon from '../components/Icon';
import {
  getExcuseFrequency,
  getWorstHabit,
  computeDailyScore,
  getDateStr,
  computeStreak,
  computeMaxStreak,
  getCompletionRate7Days,
} from '../analytics';

interface Props {
  habits: Habit[];
  logs: DailyLog[];
  online: boolean;
}

type ErrorType = 'rate_limit' | 'invalid_key' | 'network' | 'overloaded' | 'no_data' | 'no_key' | 'generic';
interface AppError { type: ErrorType; message: string; }

const PIE_COLORS = [
  '#d4af37', '#ef4444', '#22c55e', '#3b82f6',
  '#a855f7', '#f59e0b', '#14b8a6', '#f97316',
];

const TABS = ['Analytics', 'AI Coach'] as const;
type Tab = typeof TABS[number];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  isAnalysis?: boolean;
}

// Read API key fresh from DB on every call — no caching
async function loadApiKey(): Promise<string> {
  try {
    const key = await getSetting('geminiApiKey');
    if (key && typeof key === 'string' && key.trim().length > 10) {
      return key.trim();
    }
  } catch (e) {
    console.error('Failed to load API key:', e);
  }
  return '';
}

// Parse Gemini error codes into user-friendly messages
function parseGeminiError(err: unknown): AppError {
  const raw = ((err as Error)?.message || '').trim();
  const lower = raw.toLowerCase();

  if (raw.startsWith('RATE_LIMIT') || lower.includes('rate') || lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('429')) {
    return { type: 'rate_limit', message: 'Rate limited. Wait 60 seconds and try again.' };
  }
  if (raw.startsWith('INVALID_KEY') || lower.includes('invalid') || lower.includes('api key') || lower.includes('permission') || lower.includes('401') || lower.includes('403')) {
    return { type: 'invalid_key', message: 'Invalid API key. Check your key in Settings → Gemini API Key.' };
  }
  if (raw.startsWith('NETWORK_ERROR') || lower.includes('fetch') || lower.includes('network') || lower.includes('failed to fetch')) {
    return { type: 'network', message: 'Network error. Check your connection and try again.' };
  }
  if (raw.startsWith('SERVER_ERROR') || lower.includes('503') || lower.includes('overload') || lower.includes('unavailable')) {
    return { type: 'overloaded', message: 'Gemini is overloaded. Try again in a moment.' };
  }
  if (raw.startsWith('MODEL_NOT_FOUND') || lower.includes('model')) {
    return { type: 'generic', message: 'Model unavailable. Retrying with backup model...' };
  }
  // Show raw message for unknown errors so user can debug
  return { type: 'generic', message: raw.length > 0 ? `Error: ${raw.slice(0, 150)}` : 'Something went wrong. Check your API key in Settings.' };
}

export default function InsightsView({ habits, logs, online }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Analytics');

  // Analytics
  const excuseFreq = useMemo(() => getExcuseFrequency(logs), [logs]);
  const excuseEntries = useMemo(() =>
    Object.entries(excuseFreq).sort((a, b) => b[1] - a[1]), [excuseFreq]);
  const totalExcuses = useMemo(() =>
    excuseEntries.reduce((s, e) => s + e[1], 0), [excuseEntries]);
  const worstHabit = useMemo(() => getWorstHabit(habits, logs), [habits, logs]);

  const last28Scores = useMemo(() => {
    const scores: { date: string; score: number }[] = [];
    for (let i = 27; i >= 0; i--) {
      const d = getDateStr(i);
      const dayLogs = logs.filter(l => l.date === d);
      scores.push({ date: d, score: computeDailyScore(habits, dayLogs) });
    }
    return scores;
  }, [habits, logs]);

  const completionRates = useMemo(() => getCompletionRate7Days(logs), [logs]);

  const habitStats = useMemo(() => {
    return habits.filter(h => !h.archived).map(h => {
      const hLogs = logs.filter(l => l.habitId === h.id);
      const completed = hLogs.filter(l => l.completed).length;
      const total = hLogs.length;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const streak = computeStreak(h.id, logs);
      const maxStreak = computeMaxStreak(h.id, logs);
      const excuses = hLogs.filter(l => !l.completed && l.excuseTag).length;
      return { habit: h, completed, total, rate, streak, maxStreak, excuses };
    }).sort((a, b) => a.rate - b.rate);
  }, [habits, logs]);

  const overallCompletion = useMemo(() => {
    if (logs.length === 0) return 0;
    return Math.round((logs.filter(l => l.completed).length / logs.length) * 100);
  }, [logs]);

  const maxScore = Math.max(...last28Scores.map(s => s.score), 1);
  const activeHabits = habits.filter(h => !h.archived);

  // AI Coach Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [appError, setAppError] = useState<AppError | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AIAnalysis[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [keyChecked, setKeyChecked] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const checkKey = useCallback(async () => {
    const key = await loadApiKey();
    setHasKey(key.length > 0);
    setKeyChecked(true);
    try {
      const analyses = await getAllAnalyses();
      setAnalysisHistory(analyses);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { checkKey(); }, [checkKey]);

  // Re-check key when switching to AI tab
  useEffect(() => {
    if (activeTab === 'AI Coach') {
      checkKey();
      setAppError(null);
    }
  }, [activeTab, checkKey]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 150);
  }, []);

  const handleFullAnalysis = async () => {
    if (loading) return;

    const key = await loadApiKey();

    if (!key) {
      setAppError({ type: 'no_key', message: 'No API key. Add your Gemini key in Settings tab.' });
      return;
    }
    if (!online) {
      setAppError({ type: 'network', message: 'You are offline. AI requires internet.' });
      return;
    }
    if (activeHabits.length === 0 || logs.length === 0) {
      setAppError({ type: 'no_data', message: 'Not enough data yet. Track habits for a few days first.' });
      return;
    }

    setLoading(true);
    setAppError(null);

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      text: 'Run a full behavioral pattern analysis on my last 30 days.',
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    scrollToBottom();

    try {
      const response = await analyzeWithGemini(key, habits, logs);

      const aiMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        text: response,
        timestamp: Date.now(),
        isAnalysis: true,
      };
      setMessages(prev => [...prev, aiMsg]);

      const analysis: AIAnalysis = {
        id: generateId(),
        generatedAt: Date.now(),
        summary: response,
        storedSnapshotOfData: JSON.stringify({ habits: habits.length, logs: logs.length }),
      };
      await saveAnalysis(analysis);
      const analyses = await getAllAnalyses();
      setAnalysisHistory(analyses);
      scrollToBottom();
    } catch (err) {
      console.error('Full analysis error:', err);
      setAppError(parseGeminiError(err));
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || loading) return;

    const key = await loadApiKey();

    if (!key) {
      setAppError({ type: 'no_key', message: 'No API key. Add it in Settings.' });
      return;
    }
    if (!online) {
      setAppError({ type: 'network', message: 'You are offline.' });
      return;
    }

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);
    setAppError(null);
    scrollToBottom();

    try {
      const chatHistory = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        text: m.text,
      }));
      const response = await chatWithGemini(key, text, habits, logs, chatHistory);

      const aiMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        text: response,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
      scrollToBottom();
    } catch (err) {
      console.error('Chat error:', err);
      setAppError(parseGeminiError(err));
    } finally {
      setLoading(false);
    }
  };

  const renderMessageText = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return (
          <h2 key={i} className="text-gold font-bold text-xs mt-4 mb-1.5 first:mt-0 flex items-center gap-2">
            <div className="w-1 h-3 rounded-full bg-gold flex-shrink-0" />
            {line.replace(/^##\s*\d*\.?\s*/, '')}
          </h2>
        );
      }
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-text font-semibold text-xs mt-2 mb-1">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <div key={i} className="flex items-start gap-1.5 mb-1 ml-1">
            <div className="w-1 h-1 rounded-full bg-text-dim mt-1.5 flex-shrink-0" />
            <p className="text-text-muted text-[11px] leading-relaxed">{line.slice(2)}</p>
          </div>
        );
      }
      if (/^\d+\.\s/.test(line)) {
        const num = line.match(/^(\d+)\.\s/)?.[1];
        const content = line.replace(/^\d+\.\s/, '');
        return (
          <div key={i} className="flex items-start gap-2 mb-1.5 ml-1">
            <span className="text-gold text-[10px] font-bold tabular-nums mt-0.5 w-3.5 flex-shrink-0">{num}.</span>
            <p className="text-text-muted text-[11px] leading-relaxed">{content}</p>
          </div>
        );
      }
      if (line.trim() === '') return <div key={i} className="h-1" />;
      const parts = line.split(/(\*\*[^*]+\*\*)/);
      return (
        <p key={i} className="text-text-muted text-[11px] mb-1 leading-relaxed">
          {parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j} className="text-text font-semibold">{part.slice(2, -2)}</strong>
              : part
          )}
        </p>
      );
    });
  };

  // Error banner
  const ErrorBanner = ({ error }: { error: AppError }) => {
    const isWarn = ['rate_limit', 'network', 'overloaded'].includes(error.type);
    const EIcon = error.type === 'rate_limit' ? Zap
      : error.type === 'invalid_key' ? ShieldAlert
      : error.type === 'no_key' ? KeyRound
      : error.type === 'network' ? WifiOff
      : AlertCircle;
    return (
      <div className={`rounded-2xl p-3.5 border mb-3 flex-shrink-0 animate-fade-in ${
        isWarn ? 'bg-warning/8 border-warning/25' : 'bg-danger/8 border-danger/25'
      }`}>
        <div className="flex items-start gap-2.5">
          <EIcon size={13} className={`${isWarn ? 'text-warning' : 'text-danger'} flex-shrink-0 mt-0.5`} />
          <p className={`text-xs flex-1 leading-relaxed ${isWarn ? 'text-warning/90' : 'text-danger/90'}`}>
            {error.message}
          </p>
          <button
            onClick={() => setAppError(null)}
            className="flex-shrink-0 text-text-dim hover:text-gold transition-colors p-0.5"
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-lg mx-auto animate-fade-in flex flex-col" style={{ minHeight: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex-shrink-0">
        <h1 className="text-lg font-bold">Insights</h1>
        <p className="text-text-dim text-[10px] tracking-wider uppercase">Behavioral data & AI analysis</p>
      </div>

      {/* Tab switcher */}
      <div className="px-4 mb-4 flex-shrink-0">
        <div className="grid grid-cols-2 bg-bg-card rounded-xl border border-border p-1 gap-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === tab
                  ? 'bg-gold/15 text-gold border border-gold/30'
                  : 'text-text-dim hover:text-text-muted'
              }`}
            >
              {tab === 'Analytics' ? <BarChart3 size={13} /> : <Brain size={13} />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ANALYTICS TAB */}
      {activeTab === 'Analytics' && (
        <div className="px-4 pb-4 space-y-3 flex-1">
          {activeHabits.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-bg-card border border-border flex items-center justify-center mx-auto mb-4">
                <BarChart3 size={28} className="text-text-dim" />
              </div>
              <div className="text-text-muted text-sm font-semibold mb-1">No data yet</div>
              <div className="text-text-dim text-xs">Add habits and start tracking</div>
            </div>
          ) : (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: 'All-time',
                    value: `${overallCompletion}%`,
                    color: overallCompletion >= 70 ? 'text-success' : overallCompletion >= 40 ? 'text-warning' : 'text-danger',
                  },
                  { label: 'Excuses', value: totalExcuses, color: 'text-danger' },
                  { label: 'Active', value: activeHabits.length, color: 'text-gold' },
                ].map(stat => (
                  <div key={stat.label} className="bg-bg-card rounded-2xl border border-border p-3 text-center card-shadow">
                    <div className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
                    <div className="text-text-dim text-[9px] uppercase tracking-wider mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* 7-day bar */}
              <div className="bg-bg-card rounded-2xl border border-border p-4 card-shadow">
                <div className="flex items-center gap-1.5 mb-4">
                  <BarChart3 size={12} className="text-text-dim" />
                  <span className="text-text-dim text-[10px] tracking-[0.15em] uppercase font-medium">7-Day Completion</span>
                </div>
                <div className="flex items-end gap-2 h-24">
                  {completionRates.map((rate, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="text-[9px] text-text-dim tabular-nums font-medium">{Math.round(rate * 100)}%</span>
                      <div className="w-full flex-1 flex flex-col justify-end">
                        <div
                          className="w-full rounded-t-md transition-all"
                          style={{
                            height: `${Math.max(4, rate * 64)}px`,
                            backgroundColor:
                              rate > 0.7 ? '#22c55e' :
                              rate > 0.4 ? '#f59e0b' :
                              rate > 0 ? '#ef4444' : '#222',
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-text-dim font-medium">
                        {new Date(getDateStr(6 - i) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 28-day score trend */}
              <div className="bg-bg-card rounded-2xl border border-border p-4 card-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp size={12} className="text-text-dim" />
                    <span className="text-text-dim text-[10px] tracking-[0.15em] uppercase font-medium">28-Day Score</span>
                  </div>
                  <span className="text-text-dim text-[9px]">
                    Avg:{' '}
                    <span className="text-text-muted font-semibold">
                      {Math.round(last28Scores.reduce((s, d) => s + d.score, 0) / last28Scores.length)}%
                    </span>
                  </span>
                </div>
                <div className="flex items-end gap-[2px] h-16">
                  {last28Scores.map((s, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-[2px] transition-all"
                      style={{
                        height: `${Math.max(2, (s.score / Math.max(maxScore, 1)) * 60)}px`,
                        backgroundColor:
                          s.score > 70 ? '#22c55e' :
                          s.score > 40 ? '#f59e0b' :
                          s.score > 0 ? '#ef4444' : '#1a1a1a',
                        opacity: i < 14 ? 0.5 : 1,
                      }}
                      title={`${s.date}: ${s.score}%`}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[9px] text-text-dim">4 weeks ago</span>
                  <span className="text-[9px] text-text-dim">Today</span>
                </div>
              </div>

              {/* Excuse distribution */}
              <div className="bg-bg-card rounded-2xl border border-border p-4 card-shadow">
                <div className="flex items-center gap-1.5 mb-4">
                  <Target size={12} className="text-text-dim" />
                  <span className="text-text-dim text-[10px] tracking-[0.15em] uppercase font-medium">Excuse Distribution</span>
                </div>
                {totalExcuses > 0 ? (
                  <div className="flex items-center gap-4">
                    <svg viewBox="0 0 100 100" className="w-28 h-28 flex-shrink-0 -rotate-90">
                      {(() => {
                        if (excuseEntries.length === 1) {
                          return <circle cx="50" cy="50" r="38" fill="none" stroke={PIE_COLORS[0]} strokeWidth="20" />;
                        }
                        let cumAngle = 0;
                        return excuseEntries.map(([excuse, count], i) => {
                          const pct = count / totalExcuses;
                          const angle = pct * 360;
                          const startAngle = cumAngle;
                          cumAngle += angle;
                          const startRad = (startAngle * Math.PI) / 180;
                          const endRad = ((startAngle + angle) * Math.PI) / 180;
                          const largeArc = angle > 180 ? 1 : 0;
                          const x1 = 50 + 38 * Math.cos(startRad);
                          const y1 = 50 + 38 * Math.sin(startRad);
                          const x2 = 50 + 38 * Math.cos(endRad);
                          const y2 = 50 + 38 * Math.sin(endRad);
                          return (
                            <path
                              key={excuse}
                              d={`M ${x1} ${y1} A 38 38 0 ${largeArc} 1 ${x2} ${y2} L 50 50 Z`}
                              fill={PIE_COLORS[i % PIE_COLORS.length]}
                            />
                          );
                        });
                      })()}
                      <circle cx="50" cy="50" r="22" fill="#141414" />
                    </svg>
                    <div className="flex-1 space-y-2">
                      {excuseEntries.slice(0, 6).map(([excuse, count], i) => (
                        <div key={excuse} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="flex-1 truncate text-text-muted text-[11px]">{excuse}</span>
                          <span className="text-text-dim text-[10px] tabular-nums font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-text-dim text-xs text-center py-8 flex flex-col items-center gap-2">
                    <Icon name="CheckCircle" size={24} className="text-success/40" />
                    No excuses logged
                  </div>
                )}
              </div>

              {/* Worst habit */}
              {worstHabit && (
                <div className="bg-bg-card rounded-2xl border border-danger/20 p-4 card-shadow">
                  <div className="flex items-center gap-1.5 mb-3">
                    <AlertTriangle size={12} className="text-danger" />
                    <span className="text-danger/80 text-[10px] tracking-[0.15em] uppercase font-medium">Most Failed</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-danger/10 flex items-center justify-center">
                      <Icon name={worstHabit.icon} size={22} className="text-danger" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{worstHabit.name}</div>
                      <div className="text-danger/60 text-[10px] font-medium mt-0.5">Needs attention</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Per-habit breakdown */}
              <div className="bg-bg-card rounded-2xl border border-border p-4 card-shadow">
                <div className="flex items-center gap-1.5 mb-4">
                  <Trophy size={12} className="text-text-dim" />
                  <span className="text-text-dim text-[10px] tracking-[0.15em] uppercase font-medium">Per-Habit</span>
                  <span className="text-text-dim text-[9px] ml-auto">worst → best</span>
                </div>
                <div className="space-y-5">
                  {habitStats.map(({ habit, rate, streak, maxStreak, completed, total, excuses }) => (
                    <div key={habit.id}>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-bg-elevated flex items-center justify-center flex-shrink-0">
                          <Icon name={habit.icon} size={15} className="text-text-muted" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold truncate">{habit.name}</span>
                            <span className={`text-xs font-bold tabular-nums flex-shrink-0 ml-2 ${
                              rate >= 70 ? 'text-success' : rate >= 40 ? 'text-warning' : 'text-danger'
                            }`}>
                              {rate}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-bg rounded-full overflow-hidden mt-1.5">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${rate}%`,
                                backgroundColor: rate >= 70 ? '#22c55e' : rate >= 40 ? '#f59e0b' : '#ef4444',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3 ml-[42px] flex-wrap">
                        <span className="text-[10px] text-text-dim tabular-nums">{completed}/{total}</span>
                        <span className="text-[10px] text-text-dim flex items-center gap-0.5">
                          <Flame size={9} className="text-gold" />{streak}d
                        </span>
                        <span className="text-[10px] text-text-dim flex items-center gap-0.5">
                          <Trophy size={9} />Best: {maxStreak}d
                        </span>
                        {excuses > 0 && (
                          <span className="text-[10px] text-danger/70 flex items-center gap-0.5">
                            <AlertTriangle size={9} />{excuses} skipped
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* AI COACH TAB */}
      {activeTab === 'AI Coach' && (
        <div className="flex flex-col flex-1 px-4 pb-4" style={{ minHeight: 0 }}>
          {/* Offline */}
          {!online && (
            <div className="bg-warning/8 border border-warning/20 rounded-2xl p-3 flex items-center gap-2.5 mb-3 flex-shrink-0">
              <WifiOff size={13} className="text-warning flex-shrink-0" />
              <p className="text-warning text-xs">Offline — AI unavailable</p>
            </div>
          )}

          {/* No key warning */}
          {keyChecked && !hasKey && (
            <div className="bg-bg-card border border-gold/20 rounded-2xl p-4 mb-3 flex-shrink-0">
              <div className="flex items-start gap-2.5">
                <KeyRound size={14} className="text-gold mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-text text-xs font-semibold mb-1">Gemini API key missing</p>
                  <p className="text-text-dim text-[11px] leading-relaxed">
                    Go to <span className="text-gold font-semibold">Settings → Gemini API Key</span> and paste your free key from{' '}
                    <span className="text-gold font-semibold">aistudio.google.com</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {appError && <ErrorBanner error={appError} />}

          {/* Chat area */}
          <div
            className="flex-1 overflow-y-auto space-y-3 mb-3"
            style={{ minHeight: 120, maxHeight: 'calc(100vh - 340px)' }}
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div
                  className="w-14 h-14 rounded-2xl bg-bg-card border border-gold/15 flex items-center justify-center mb-3"
                  style={{ boxShadow: '0 0 30px rgba(212,175,55,0.06)' }}
                >
                  <Brain size={24} className="text-gold/70" />
                </div>
                <p className="text-text-muted text-xs font-semibold mb-1">Behavioral Coach</p>
                <p className="text-text-dim text-[11px] max-w-[200px] leading-relaxed">
                  Brutally honest. Data-driven. No excuses accepted.
                </p>
                {hasKey && online && (
                  <div className="mt-4 space-y-1.5 w-full max-w-[260px]">
                    {[
                      'Why am I failing my habits?',
                      'What\'s my biggest weakness?',
                      'How can I improve my streak?',
                    ].map(q => (
                      <button
                        key={q}
                        onClick={() => setInputText(q)}
                        className="w-full text-left px-3 py-2 rounded-xl bg-bg-card border border-border text-[11px] text-text-dim hover:text-text-muted hover:border-gold/20 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                      <Brain size={12} className="text-gold" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-gold/10 border border-gold/20 rounded-br-sm'
                        : 'bg-bg-card border border-border rounded-bl-sm'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="text-text text-xs leading-relaxed">{msg.text}</p>
                    ) : (
                      <div>{renderMessageText(msg.text)}</div>
                    )}
                    <div className="text-[9px] text-text-dim mt-1.5">
                      {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Typing indicator */}
            {loading && (
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                  <Brain size={12} className="text-gold" />
                </div>
                <div className="bg-bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {[0, 200, 400].map(delay => (
                      <div
                        key={delay}
                        className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-bounce"
                        style={{ animationDelay: `${delay}ms`, animationDuration: '1s' }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Full analysis button */}
          <button
            onClick={handleFullAnalysis}
            disabled={loading || !online || !hasKey}
            className="w-full py-3 rounded-xl bg-bg-card border border-gold/20 text-gold text-xs font-bold disabled:opacity-30 transition-all flex items-center justify-center gap-2 mb-2.5 hover:bg-gold/5 active:scale-[0.98] flex-shrink-0"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Full Pattern Analysis
          </button>

          {/* Chat input */}
          <div className="flex gap-2 flex-shrink-0">
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={hasKey && online ? 'Ask about your habits...' : !online ? 'Offline' : 'Add API key in Settings'}
              disabled={!online || !hasKey || loading}
              rows={1}
              className="flex-1 bg-bg-card border border-border rounded-xl px-4 py-3 text-xs text-text placeholder-text-dim focus:outline-none focus:border-gold/40 transition-colors resize-none disabled:opacity-40"
              style={{ maxHeight: 80 }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || loading || !online || !hasKey}
              className="w-11 h-11 rounded-xl bg-gold text-bg flex items-center justify-center flex-shrink-0 disabled:opacity-30 transition-all active:scale-95 self-end"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>

          {/* Past analyses */}
          {analysisHistory.length > 0 && (
            <div className="mt-3 flex-shrink-0">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 w-full py-1.5 text-text-dim text-[10px] tracking-[0.15em] uppercase font-medium"
              >
                <Clock size={10} /> Past ({analysisHistory.length})
                {showHistory ? <ChevronUp size={10} className="ml-auto" /> : <ChevronDown size={10} className="ml-auto" />}
              </button>
              {showHistory && (
                <div className="space-y-1.5 animate-fade-in mt-1">
                  {analysisHistory.slice(0, 5).map(a => (
                    <button
                      key={a.id}
                      onClick={() => {
                        const msg: ChatMessage = {
                          id: a.id,
                          role: 'assistant',
                          text: a.summary,
                          timestamp: a.generatedAt,
                          isAnalysis: true,
                        };
                        setMessages([msg]);
                        setShowHistory(false);
                        scrollToBottom();
                      }}
                      className="w-full bg-bg-card border border-border rounded-xl p-3 text-left hover:border-gold/20 transition-all"
                    >
                      <div className="text-[10px] text-text-dim mb-0.5">
                        {new Date(a.generatedAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </div>
                      <div className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">
                        {a.summary.substring(0, 100)}...
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="h-4 flex-shrink-0" />
    </div>
  );
}
