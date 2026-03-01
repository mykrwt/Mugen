import { useMemo, useState } from 'react';
import { Check, X, CalendarDays, Flame, Trophy } from 'lucide-react';
import type { Habit, DailyLog } from '../db';
import Icon from '../components/Icon';
import { computeStreak, computeMaxStreak } from '../analytics';

interface Props {
  habits: Habit[];
  logs: DailyLog[];
  onDateSelect: (date: string) => void;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CELL = 11;
const GAP = 2;

function buildGrid() {
  const today = new Date();
  const weeks: { date: string; inFuture: boolean }[][] = [];
  const monthMarkers: { weekIndex: number; label: string }[] = [];

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 363);
  const dow = startDate.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  startDate.setDate(startDate.getDate() + mondayOffset);

  const current = new Date(startDate);
  let lastMonth = -1;
  let weekIdx = 0;

  while (current <= today) {
    const week: { date: string; inFuture: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = current.toISOString().split('T')[0];
      const inFuture = current > today;
      week.push({ date: dateStr, inFuture });
      if (d === 0) {
        const month = current.getMonth();
        if (month !== lastMonth) {
          monthMarkers.push({ weekIndex: weekIdx, label: MONTH_NAMES[month] });
          lastMonth = month;
        }
      }
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
    weekIdx++;
  }

  return { grid: weeks, monthMarkers };
}

const { grid, monthMarkers } = buildGrid();
const totalWidth = grid.length * (CELL + GAP) - GAP;

type DayStatus = 'done' | 'skipped' | 'none';

function getHabitDayStatus(habitId: string, date: string, logMap: Map<string, DailyLog>): DayStatus {
  const log = logMap.get(`${habitId}::${date}`);
  if (!log) return 'none';
  return log.completed ? 'done' : 'skipped';
}

function statusColor(status: DayStatus): string {
  switch (status) {
    case 'done': return '#22c55e';
    case 'skipped': return '#ef4444';
    case 'none': return '#1e1e1e';
  }
}

// ---- Shared HeatGrid ----
function HeatGrid({
  getColor,
  getCellTitle,
  onCellClick,
  selectedDate,
}: {
  getColor: (date: string, inFuture: boolean) => string;
  getCellTitle: (date: string) => string;
  onCellClick: (date: string) => void;
  selectedDate: string | null;
}) {
  return (
    <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as const }}>
      <div style={{ minWidth: totalWidth + 22 }}>
        {/* Month labels */}
        <div className="flex mb-1.5 ml-5">
          <div className="relative flex-1" style={{ height: 11 }}>
            {monthMarkers.map((m, i) => (
              <span
                key={i}
                className="absolute text-[8px] text-text-dim font-medium leading-none"
                style={{ left: m.weekIndex * (CELL + GAP) }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>

        {/* Grid body */}
        <div className="flex gap-[2px]">
          {/* Day label column */}
          <div className="flex flex-col gap-[2px] mr-1 flex-shrink-0">
            {DAY_LABELS.map((d, i) => (
              <div
                key={i}
                style={{ width: 12, height: CELL }}
                className="text-[8px] text-text-dim flex items-center justify-end font-medium"
              >
                {i % 2 === 0 ? d : ''}
              </div>
            ))}
          </div>

          {/* Week columns */}
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[2px]">
              {week.map((cell, di) => {
                if (cell.inFuture) {
                  return <div key={di} style={{ width: CELL, height: CELL }} />;
                }
                const color = getColor(cell.date, cell.inFuture);
                const isSelected = selectedDate === cell.date;
                return (
                  <button
                    key={di}
                    onClick={() => onCellClick(cell.date)}
                    style={{
                      width: CELL,
                      height: CELL,
                      backgroundColor: color,
                      outline: isSelected ? '2px solid #d4af37' : 'none',
                      outlineOffset: '1px',
                      borderRadius: 2,
                    }}
                    className="transition-transform hover:scale-110 flex-shrink-0"
                    title={getCellTitle(cell.date)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Per-Habit Heatmap (always expanded, no toggle) ----
function HabitHeatmap({
  habit,
  logMap,
  allLogs,
}: {
  habit: Habit;
  logMap: Map<string, DailyLog>;
  allLogs: DailyLog[];
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const streak = useMemo(() => computeStreak(habit.id, allLogs), [habit.id, allLogs]);
  const maxStreak = useMemo(() => computeMaxStreak(habit.id, allLogs), [habit.id, allLogs]);
  const habitLogs = useMemo(() => allLogs.filter(l => l.habitId === habit.id), [allLogs, habit.id]);
  const doneCount = useMemo(() => habitLogs.filter(l => l.completed).length, [habitLogs]);
  const skipCount = useMemo(() => habitLogs.filter(l => !l.completed && l.excuseTag).length, [habitLogs]);
  const completionRate = habitLogs.length > 0 ? Math.round((doneCount / habitLogs.length) * 100) : 0;

  const selectedLog = selectedDate ? logMap.get(`${habit.id}::${selectedDate}`) : undefined;
  const selectedStatus = selectedDate ? getHabitDayStatus(habit.id, selectedDate, logMap) : 'none';

  const rateColor =
    completionRate >= 70 ? 'text-success' :
    completionRate >= 40 ? 'text-warning' :
    habitLogs.length === 0 ? 'text-text-dim' : 'text-danger';

  return (
    <div className="bg-bg-card rounded-2xl border border-border card-shadow overflow-hidden">
      {/* Habit header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-9 h-9 rounded-xl bg-bg-elevated flex items-center justify-center flex-shrink-0">
          <Icon name={habit.icon} size={16} className="text-text-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate">{habit.name}</div>
          <div className="text-text-dim text-[10px] uppercase tracking-wider">{habit.category}</div>
        </div>
        <div className={`text-lg font-bold tabular-nums ${rateColor}`}>
          {habitLogs.length > 0 ? `${completionRate}%` : '—'}
        </div>
      </div>

      {/* Stats row — symmetric 4-col */}
      <div className="grid grid-cols-4 gap-px border-t border-b border-border bg-border mx-0">
        {[
          { label: 'Done', value: doneCount, color: 'text-success' },
          { label: 'Skipped', value: skipCount, color: 'text-danger' },
          { label: 'Streak', value: `${streak}d`, color: 'text-gold', icon: <Flame size={9} className="text-gold" /> },
          { label: 'Best', value: `${maxStreak}d`, color: 'text-text-muted', icon: <Trophy size={9} /> },
        ].map(s => (
          <div key={s.label} className="bg-bg-card py-2.5 text-center">
            <div className={`text-sm font-bold tabular-nums flex items-center justify-center gap-0.5 ${s.color}`}>
              {s.icon}{s.value}
            </div>
            <div className="text-text-dim text-[9px] uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div className="px-4 pt-3 pb-2">
        <HeatGrid
          getColor={(date) => statusColor(getHabitDayStatus(habit.id, date, logMap))}
          getCellTitle={(date) => {
            const status = getHabitDayStatus(habit.id, date, logMap);
            if (status === 'done') return `${date}: Done`;
            if (status === 'skipped') {
              const log = logMap.get(`${habit.id}::${date}`);
              return `${date}: Skipped${log?.excuseTag ? ` — ${log.excuseTag}` : ''}`;
            }
            return `${date}: Not logged`;
          }}
          onCellClick={(date) => setSelectedDate(prev => prev === date ? null : date)}
          selectedDate={selectedDate}
        />

        {/* Legend */}
        <div className="flex items-center gap-3 mt-2.5">
          {[
            { color: '#22c55e', label: 'Done' },
            { color: '#ef4444', label: 'Skipped' },
            { color: '#1e1e1e', label: 'None' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <div
                className="w-[10px] h-[10px] rounded-[2px] border border-white/5"
                style={{ backgroundColor: l.color }}
              />
              <span className="text-[9px] text-text-dim">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className={`mx-4 mb-4 p-3 rounded-xl border animate-fade-in ${
          selectedStatus === 'done' ? 'border-success/25 bg-success/5' :
          selectedStatus === 'skipped' ? 'border-danger/25 bg-danger/5' :
          'border-border bg-bg-elevated'
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-text">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long', month: 'short', day: 'numeric',
                })}
              </div>
              <div className={`text-[10px] mt-0.5 font-semibold ${
                selectedStatus === 'done' ? 'text-success' :
                selectedStatus === 'skipped' ? 'text-danger' : 'text-text-dim'
              }`}>
                {selectedStatus === 'done' ? 'Completed' :
                 selectedStatus === 'skipped' ? 'Skipped' : 'Not logged'}
              </div>
            </div>
            {selectedLog?.value != null && (
              <div className="text-right">
                <div className="text-[9px] text-text-dim uppercase tracking-wider">Value</div>
                <div className="text-gold text-sm font-bold">{selectedLog.value}</div>
              </div>
            )}
          </div>
          {selectedLog?.excuseTag && (
            <div className="mt-2 text-[10px] text-danger/80 font-medium border-t border-border/40 pt-2">
              Reason: {selectedLog.excuseTag}
            </div>
          )}
          {selectedLog?.reflectionText && (
            <div className="mt-1 text-[10px] text-text-dim italic">
              "{selectedLog.reflectionText}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Main HeatmapView ----
export default function HeatmapView({ habits, logs, onDateSelect }: Props) {
  const logMap = useMemo(() => {
    const map = new Map<string, DailyLog>();
    logs.forEach(l => map.set(`${l.habitId}::${l.date}`, l));
    return map;
  }, [logs]);

  const overallData = useMemo(() => {
    const map = new Map<string, { completed: number; total: number; ratio: number }>();
    const byDate = new Map<string, DailyLog[]>();
    logs.forEach(l => {
      if (!byDate.has(l.date)) byDate.set(l.date, []);
      byDate.get(l.date)!.push(l);
    });
    byDate.forEach((dayLogs, date) => {
      const completed = dayLogs.filter(l => l.completed).length;
      map.set(date, { completed, total: dayLogs.length, ratio: dayLogs.length > 0 ? completed / dayLogs.length : 0 });
    });
    return map;
  }, [logs]);

  const [selectedOverallDate, setSelectedOverallDate] = useState<string | null>(null);

  const totalDaysLogged = overallData.size;
  const perfectDays = Array.from(overallData.values()).filter(d => d.ratio === 1).length;
  const activeHabits = habits.filter(h => !h.archived);

  const selectedOverallData = selectedOverallDate ? overallData.get(selectedOverallDate) : null;
  const selectedDayLogs = selectedOverallDate ? logs.filter(l => l.date === selectedOverallDate) : [];

  const overallColor = (ratio: number): string => {
    if (ratio >= 0.9) return '#22c55e';
    if (ratio >= 0.7) return '#16a34a';
    if (ratio >= 0.5) return '#f59e0b';
    if (ratio >= 0.3) return '#ea580c';
    if (ratio > 0) return '#ef4444';
    return '#1e1e1e';
  };

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-lg font-bold">History</h1>
        <p className="text-text-dim text-[10px] tracking-wider uppercase">Activity heatmaps</p>
      </div>

      {/* Summary stats */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-bg-card rounded-2xl border border-border p-3 text-center card-shadow">
            <div className="text-2xl font-bold tabular-nums text-text">{totalDaysLogged}</div>
            <div className="text-text-dim text-[9px] uppercase tracking-wider mt-0.5">Tracked</div>
          </div>
          <div className="bg-bg-card rounded-2xl border border-border p-3 text-center card-shadow">
            <div className="text-2xl font-bold tabular-nums text-success">{perfectDays}</div>
            <div className="text-text-dim text-[9px] uppercase tracking-wider mt-0.5">Perfect</div>
          </div>
          <div className="bg-bg-card rounded-2xl border border-border p-3 text-center card-shadow">
            <div className="text-2xl font-bold tabular-nums text-gold">{activeHabits.length}</div>
            <div className="text-text-dim text-[9px] uppercase tracking-wider mt-0.5">Habits</div>
          </div>
        </div>
      </div>

      {/* Overall heatmap */}
      <div className="px-4 mb-4">
        <div className="bg-bg-card rounded-2xl border border-border p-4 card-shadow">
          <div className="flex items-center gap-1.5 mb-3">
            <CalendarDays size={11} className="text-text-dim" />
            <span className="text-text-dim text-[10px] tracking-[0.15em] uppercase font-medium">Overall — 52 Weeks</span>
          </div>

          <HeatGrid
            getColor={(date) => {
              const d = overallData.get(date);
              return d ? overallColor(d.ratio) : '#1e1e1e';
            }}
            getCellTitle={(date) => {
              const d = overallData.get(date);
              return d ? `${date}: ${d.completed}/${d.total}` : `${date}: no data`;
            }}
            onCellClick={(date) => setSelectedOverallDate(prev => prev === date ? null : date)}
            selectedDate={selectedOverallDate}
          />

          {/* Legend */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[9px] text-text-dim">Less</span>
            <div className="flex gap-[3px]">
              {[0, 0.2, 0.5, 0.75, 1].map((r, i) => (
                <div
                  key={i}
                  className="w-[11px] h-[11px] rounded-[2px]"
                  style={{ backgroundColor: r === 0 ? '#1e1e1e' : overallColor(r) }}
                />
              ))}
            </div>
            <span className="text-[9px] text-text-dim">More</span>
          </div>

          {/* Selected day popup */}
          {selectedOverallDate && (
            <div className="mt-3 p-3 bg-bg rounded-xl border border-gold/15 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold">
                  {new Date(selectedOverallDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long', month: 'short', day: 'numeric',
                  })}
                </div>
                {selectedOverallData && (
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{ color: overallColor(selectedOverallData.ratio) }}
                  >
                    {selectedOverallData.completed}/{selectedOverallData.total}
                  </span>
                )}
              </div>

              {selectedDayLogs.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedDayLogs.map(log => {
                    const habit = habits.find(h => h.id === log.habitId);
                    return (
                      <div key={log.id} className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                          log.completed ? 'bg-success/15' : 'bg-danger/10'
                        }`}>
                          {log.completed
                            ? <Check size={10} className="text-success" strokeWidth={3} />
                            : <X size={10} className="text-danger" />
                          }
                        </div>
                        <span className="flex-1 truncate text-[11px] text-text-muted font-medium">
                          {habit?.name || 'Unknown'}
                        </span>
                        {!log.completed && log.excuseTag && (
                          <span className="text-[9px] text-danger/70 truncate max-w-[80px]">{log.excuseTag}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-text-dim text-xs text-center py-2">No habits logged</div>
              )}

              <button
                onClick={() => onDateSelect(selectedOverallDate)}
                className="mt-2.5 w-full py-2 rounded-lg bg-gold/8 border border-gold/20 text-gold text-[10px] font-semibold hover:bg-gold/15 transition-all"
              >
                Go to this day →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Per-Habit Heatmaps */}
      <div className="px-4 pb-4">
        {activeHabits.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-bg-card border border-border flex items-center justify-center mx-auto mb-3">
              <CalendarDays size={24} className="text-text-dim" />
            </div>
            <div className="text-text-muted text-sm font-semibold mb-1">No habits yet</div>
            <div className="text-text-dim text-xs">Add habits to see individual heatmaps</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-text-dim text-[10px] tracking-[0.15em] uppercase font-medium">Per-Habit</span>
              <span className="text-text-dim text-[10px]">{activeHabits.length} habits</span>
            </div>
            <div className="space-y-3">
              {activeHabits.map(habit => (
                <HabitHeatmap
                  key={habit.id}
                  habit={habit}
                  logMap={logMap}
                  allLogs={logs}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="h-4" />
    </div>
  );
}
