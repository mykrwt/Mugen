import { useMemo } from 'react';
import {
  Plus, TrendingUp, TrendingDown, Minus,
  Target, Flame, AlertTriangle, Brain,
  CalendarCheck, Activity, ListChecks, ChevronRight,
  Grid3X3, Wifi, WifiOff, Zap
} from 'lucide-react';
import type { Habit, DailyLog } from '../db';
import { todayStr } from '../db';
import Icon from '../components/Icon';
import {
  computeDailyScore,
  computeStreak,
  getMostCommonExcuse,
  getWorstHabit,
  getCompletionRate7Days,
  getDateStr,
} from '../analytics';

interface Props {
  habits: Habit[];
  logs: DailyLog[];
  navigateTo: (page: string, date?: string) => void;
  online: boolean;
}

export default function Dashboard({ habits, logs, navigateTo, online }: Props) {
  const today = todayStr();
  const todayLogs = useMemo(() => logs.filter(l => l.date === today), [logs, today]);
  const dailyScore = useMemo(() => computeDailyScore(habits, todayLogs), [habits, todayLogs]);

  const completedToday = todayLogs.filter(l => l.completed).length;
  const totalToday = habits.length;
  const unloggedToday = totalToday - todayLogs.length;

  const bestStreak = useMemo(() => {
    if (habits.length === 0) return { habit: null as Habit | null, streak: 0 };
    let best = { habit: habits[0] as Habit | null, streak: 0 };
    habits.forEach(h => {
      const s = computeStreak(h.id, logs);
      if (s > best.streak) best = { habit: h, streak: s };
    });
    return best;
  }, [habits, logs]);

  const worstHabit = useMemo(() => getWorstHabit(habits, logs), [habits, logs]);
  const topExcuse = useMemo(() => getMostCommonExcuse(logs), [logs]);
  const weeklyRates = useMemo(() => getCompletionRate7Days(logs), [logs]);

  const weeklyScore = useMemo(() => {
    let total = 0, count = 0;
    for (let i = 6; i >= 0; i--) {
      const d = getDateStr(i);
      const dayLogs = logs.filter(l => l.date === d);
      if (dayLogs.length > 0) {
        total += computeDailyScore(habits, dayLogs);
        count++;
      }
    }
    return count > 0 ? Math.round(total / count) : 0;
  }, [habits, logs]);

  const scoreColor =
    dailyScore >= 70 ? 'text-success' :
    dailyScore >= 40 ? 'text-warning' :
    'text-danger';

  const scoreBg =
    dailyScore >= 70 ? 'border-success/20' :
    dailyScore >= 40 ? 'border-warning/20' :
    'border-danger/20';

  const weeklyTrend = useMemo(() => {
    if (weeklyRates.length < 4) return 'neutral';
    const firstHalf = weeklyRates.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const secondHalf = weeklyRates.slice(4).reduce((a, b) => a + b, 0) / 3;
    if (secondHalf > firstHalf + 0.05) return 'improving';
    if (secondHalf < firstHalf - 0.05) return 'declining';
    return 'stable';
  }, [weeklyRates]);

  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="p-4 max-w-lg mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 mt-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">Ruthless</h1>
            <div className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-success' : 'bg-warning'}`} />
          </div>
          <p className="text-text-dim text-[10px] tracking-[0.2em] uppercase mt-0.5">Discipline Intelligence</p>
        </div>
        <button
          onClick={() => navigateTo('habits')}
          className="flex items-center gap-2 h-9 px-3 rounded-xl bg-gold text-bg text-xs font-bold hover:bg-gold-dim transition-colors"
        >
          <Plus size={14} strokeWidth={2.5} />
          New Habit
        </button>
      </div>

      <div className="space-y-2.5">
        {/* Discipline Score — full width hero */}
        <button
          onClick={() => navigateTo('analytics')}
          className={`w-full bg-bg-card rounded-2xl p-5 border ${scoreBg} text-left hover:border-gold/30 transition-all card-shadow`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-text-dim" />
              <span className="text-text-dim text-[10px] tracking-[0.15em] uppercase font-medium">Discipline Score</span>
            </div>
            <div className={`flex items-center gap-1 text-[10px] font-medium ${
              weeklyTrend === 'improving' ? 'text-success' :
              weeklyTrend === 'declining' ? 'text-danger' : 'text-text-dim'
            }`}>
              {weeklyTrend === 'improving' && <><TrendingUp size={11} /> Improving</>}
              {weeklyTrend === 'declining' && <><TrendingDown size={11} /> Declining</>}
              {weeklyTrend === 'stable' && <><Minus size={11} /> Stable</>}
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div className="flex items-end gap-1">
              <span className={`text-6xl font-bold tabular-nums leading-none ${scoreColor}`}>{dailyScore}</span>
              <span className="text-text-dim text-xl mb-1">%</span>
            </div>
            <div className="text-right">
              <div className="text-text-dim text-[10px] uppercase tracking-wider">7-day avg</div>
              <div className="text-2xl font-bold text-text tabular-nums">{weeklyScore}<span className="text-sm text-text-dim font-normal">%</span></div>
            </div>
          </div>
          {/* Mini bar chart */}
          <div className="flex items-end gap-[3px] h-8 mt-4">
            {weeklyRates.map((rate, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end">
                <div
                  className="rounded-sm transition-all"
                  style={{
                    height: `${Math.max(3, rate * 32)}px`,
                    backgroundColor:
                      rate > 0.7 ? '#22c55e' :
                      rate > 0.4 ? '#f59e0b' :
                      rate > 0 ? '#ef4444' : '#222',
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex mt-1.5">
            {DAYS.map((d, i) => (
              <span key={i} className="text-[8px] text-text-dim flex-1 text-center">{d}</span>
            ))}
          </div>
        </button>

        {/* Today + Streak row */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Today's Habits */}
          <button
            onClick={() => navigateTo('daily')}
            className="bg-bg-card rounded-2xl p-4 border border-border text-left hover:border-gold/30 transition-all card-shadow"
          >
            <div className="flex items-center gap-1.5 mb-3">
              <CalendarCheck size={12} className="text-text-dim" />
              <span className="text-text-dim text-[10px] tracking-[0.15em] uppercase font-medium">Today</span>
            </div>
            <div className="text-3xl font-bold tabular-nums leading-none">
              {completedToday}<span className="text-text-dim text-base font-normal">/{totalToday}</span>
            </div>
            <div className="text-text-muted text-[10px] mt-1.5">done today</div>
            {unloggedToday > 0 && (
              <div className="mt-2 text-[9px] text-warning font-medium flex items-center gap-1">
                <Zap size={9} /> {unloggedToday} unlogged
              </div>
            )}
          </button>

          {/* Best Streak */}
          <button
            onClick={() => navigateTo('heatmap')}
            className="bg-bg-card rounded-2xl p-4 border border-border text-left hover:border-gold/30 transition-all card-shadow"
          >
            <div className="flex items-center gap-1.5 mb-3">
              <Flame size={12} className="text-text-dim" />
              <span className="text-text-dim text-[10px] tracking-[0.15em] uppercase font-medium">Streak</span>
            </div>
            <div className="text-3xl font-bold text-gold tabular-nums leading-none">
              {bestStreak.streak}<span className="text-base text-text-dim font-normal">d</span>
            </div>
            <div className="text-text-muted text-[10px] mt-1.5 truncate flex items-center gap-1">
              {bestStreak.habit ? (
                <>
                  <Icon name={bestStreak.habit.icon} size={11} className="text-text-dim flex-shrink-0" />
                  <span className="truncate">{bestStreak.habit.name}</span>
                </>
              ) : 'No data'}
            </div>
          </button>
        </div>

        {/* Heatmap preview */}
        <button
          onClick={() => navigateTo('heatmap')}
          className="w-full bg-bg-card rounded-2xl p-4 border border-border text-left hover:border-gold/30 transition-all card-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Grid3X3 size={12} className="text-text-dim" />
              <span className="text-text-dim text-[10px] tracking-[0.15em] uppercase font-medium">Activity Map</span>
            </div>
            <ChevronRight size={12} className="text-text-dim" />
          </div>
          {/* Mini heatmap: last 7 weeks × 7 days */}
          <MiniHeatmap logs={logs} />
        </button>

        {/* Habits list */}
        <button
          onClick={() => navigateTo('daily')}
          className="w-full bg-bg-card rounded-2xl p-4 border border-border text-left hover:border-gold/30 transition-all card-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <ListChecks size={12} className="text-text-dim" />
              <span className="text-text-dim text-[10px] tracking-[0.15em] uppercase font-medium">Habits</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-text-dim text-[10px]">{habits.length} total</span>
              <ChevronRight size={12} className="text-text-dim" />
            </div>
          </div>
          {habits.length === 0 ? (
            <div className="text-text-dim text-xs py-2">No habits yet — tap New Habit to get started</div>
          ) : (
            <div className="space-y-2">
              {habits.slice(0, 4).map(h => {
                const log = todayLogs.find(l => l.habitId === h.id);
                return (
                  <div key={h.id} className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      log?.completed ? 'bg-success/15' : 'bg-bg-elevated'
                    }`}>
                      <Icon
                        name={h.icon}
                        size={14}
                        className={log?.completed ? 'text-success' : 'text-text-dim'}
                      />
                    </div>
                    <span className="text-xs text-text-muted flex-1 truncate">{h.name}</span>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      log?.completed ? 'bg-success' :
                      log && !log.completed ? 'bg-danger' :
                      'bg-border'
                    }`} />
                  </div>
                );
              })}
              {habits.length > 4 && (
                <div className="text-text-dim text-[10px] text-center pt-1">
                  +{habits.length - 4} more habits
                </div>
              )}
            </div>
          )}
        </button>

        {/* Bottom row: Weakest + Excuse + AI */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Weakest Habit */}
          <button
            onClick={() => navigateTo('analytics')}
            className="bg-bg-card rounded-2xl p-3.5 border border-border text-left hover:border-gold/30 transition-all card-shadow"
          >
            <div className="flex items-center gap-1 mb-2">
              <AlertTriangle size={10} className="text-text-dim" />
              <span className="text-text-dim text-[9px] tracking-[0.1em] uppercase font-medium">Worst</span>
            </div>
            {worstHabit ? (
              <>
                <Icon name={worstHabit.icon} size={20} className="text-danger mb-1.5" />
                <div className="text-text-muted text-[9px] truncate">{worstHabit.name}</div>
              </>
            ) : (
              <div className="text-text-dim text-[9px]">No data</div>
            )}
          </button>

          {/* Top Excuse */}
          <button
            onClick={() => navigateTo('analytics')}
            className="bg-bg-card rounded-2xl p-3.5 border border-border text-left hover:border-gold/30 transition-all card-shadow"
          >
            <div className="flex items-center gap-1 mb-2">
              <Activity size={10} className="text-text-dim" />
              <span className="text-text-dim text-[9px] tracking-[0.1em] uppercase font-medium">Excuse</span>
            </div>
            <div className="text-[11px] font-semibold text-text leading-tight">{topExcuse || 'None'}</div>
            <div className="text-text-dim text-[9px] mt-1">most used</div>
          </button>

          {/* AI Coach */}
          <button
            onClick={() => navigateTo('ai')}
            className="bg-bg-card rounded-2xl p-3.5 border border-border text-left hover:border-gold/30 transition-all card-shadow"
          >
            <div className="flex items-center gap-1 mb-2">
              <Brain size={10} className="text-text-dim" />
              <span className="text-text-dim text-[9px] tracking-[0.1em] uppercase font-medium">AI</span>
            </div>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center mb-1.5 ${online ? 'bg-gold/15' : 'bg-border'}`}>
              {online ? <Wifi size={11} className="text-gold" /> : <WifiOff size={11} className="text-text-dim" />}
            </div>
            <div className="text-[9px] text-text-dim">{online ? 'Tap to analyze' : 'Offline'}</div>
          </button>
        </div>
      </div>
    </div>
  );
}

// Mini heatmap component showing last 7 weeks
function MiniHeatmap({ logs }: { logs: DailyLog[] }) {
  const grid = useMemo(() => {
    const weeks: { date: string; ratio: number }[][] = [];
    const today = new Date();

    for (let week = 6; week >= 0; week--) {
      const days: { date: string; ratio: number }[] = [];
      for (let day = 6; day >= 0; day--) {
        const d = new Date(today);
        d.setDate(d.getDate() - (week * 7 + day));
        const dateStr = d.toISOString().split('T')[0];
        const dayLogs = logs.filter(l => l.date === dateStr);
        const ratio = dayLogs.length > 0
          ? dayLogs.filter(l => l.completed).length / dayLogs.length
          : -1;
        days.push({ date: dateStr, ratio });
      }
      weeks.push(days);
    }
    return weeks;
  }, [logs]);

  const getColor = (ratio: number) => {
    if (ratio < 0) return '#1a1a1a';
    if (ratio >= 0.9) return '#22c55e';
    if (ratio >= 0.7) return '#16a34a';
    if (ratio >= 0.5) return '#f59e0b';
    if (ratio >= 0.3) return '#ea580c';
    return '#ef4444';
  };

  return (
    <div className="flex gap-[3px]">
      {grid.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px] flex-1">
          {week.map((day, di) => (
            <div
              key={di}
              className="rounded-[2px]"
              style={{
                backgroundColor: getColor(day.ratio),
                height: '10px',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
