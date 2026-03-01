import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, Check, X,
  Flame, Target, Pencil, Trash2, MoreVertical,
  Hash, Archive, RotateCcw, Search, ChevronDown,
  BedDouble, Smartphone, Clock, BatteryLow,
  HeartCrack, BrainCircuit, ShieldOff, MessageCircle,
  CheckCircle2,
} from 'lucide-react';
import type { Habit, DailyLog } from '../db';
import {
  getLogForHabitDate, addLog, updateLog, generateId,
  getLogsByDate, addHabit, updateHabit, deleteHabit
} from '../db';
import { EXCUSE_OPTIONS } from '../analytics';
import { computeDailyScore, computeStreak, getMostCommonExcuse } from '../analytics';
import Icon from '../components/Icon';
import Logo from '../components/Logo';
import { UNIQUE_HABIT_ICONS, ICON_CATEGORIES } from '../icons';

interface Props {
  habits: Habit[];
  logs: DailyLog[];
  selectedDate: string;
  onDateChange: (d: string) => void;
  onRefresh: () => Promise<void>;
  navigateTo: (page: string) => void;
}

const REASON_CONFIG: Record<string, { icon: React.ReactNode; label: string; sub: string }> = {
  'Lazy': { icon: <BedDouble size={15} />, label: "No motivation", sub: "Didn't feel like it" },
  'Distracted': { icon: <Smartphone size={15} />, label: 'Distracted', sub: 'Lost focus' },
  'No time': { icon: <Clock size={15} />, label: 'No time', sub: 'Schedule clash' },
  'Low energy': { icon: <BatteryLow size={15} />, label: 'Low energy', sub: 'Physically drained' },
  'Emotional issue': { icon: <HeartCrack size={15} />, label: 'Emotional', sub: 'Stress or mood' },
  'Forgot': { icon: <BrainCircuit size={15} />, label: 'Forgot', sub: 'Slipped my mind' },
  'Avoided deliberately': { icon: <ShieldOff size={15} />, label: 'Chose to skip', sub: 'Conscious choice' },
  'Other': { icon: <MessageCircle size={15} />, label: 'Other', sub: 'Describe below' },
};

const CATEGORIES = ['Health', 'Fitness', 'Mind', 'Productivity', 'Finance', 'Relationships', 'Skills', 'Other'];

type FormState = {
  name: string;
  icon: string;
  category: string;
  targetType: 'boolean' | 'numeric';
  targetValue: string;
};
const DEFAULT_FORM: FormState = {
  name: '',
  icon: 'Target',
  category: 'Health',
  targetType: 'boolean',
  targetValue: '',
};

// Reason modal state type
type ReasonModalState = {
  habitId: string;
  habitName: string;
  habitIcon: string;
  existingLog?: DailyLog;       // The log we're updating (if unchecking or already has skip)
  numValue?: number;             // For numeric habits that didn't meet target
  mode: 'uncheck' | 'skip';    // 'uncheck' = was completed, now removing; 'skip' = never completed
};

export default function HomeView({ habits, logs, selectedDate, onDateChange, onRefresh, navigateTo }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;

  const [dayLogs, setDayLogs] = useState<Map<string, DailyLog>>(new Map());
  const [processing, setProcessing] = useState<string | null>(null);

  const [reasonModal, setReasonModal] = useState<ReasonModalState | null>(null);
  const [numericModal, setNumericModal] = useState<{ habit: Habit; log?: DailyLog } | null>(null);
  const [habitFormModal, setHabitFormModal] = useState<{ editing?: Habit } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [submittingReason, setSubmittingReason] = useState(false);

  const [numericValue, setNumericValue] = useState('');
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [iconSearch, setIconSearch] = useState('');
  const [iconTab, setIconTab] = useState('All');
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const todayLogs = useMemo(() => logs.filter(l => l.date === today), [logs, today]);
  const dailyScore = useMemo(() => computeDailyScore(habits.filter(h => !h.archived), todayLogs), [habits, todayLogs]);
  const topExcuse = useMemo(() => getMostCommonExcuse(logs), [logs]);
  const bestStreak = useMemo(() => {
    const active = habits.filter(h => !h.archived);
    if (!active.length) return { habit: null as Habit | null, streak: 0 };
    let best = { habit: active[0] as Habit | null, streak: 0 };
    active.forEach(h => {
      const s = computeStreak(h.id, logs);
      if (s > best.streak) best = { habit: h, streak: s };
    });
    return best;
  }, [habits, logs]);

  const loadLogs = useCallback(async () => {
    try {
      const ls = await getLogsByDate(selectedDate);
      const map = new Map<string, DailyLog>();
      ls.forEach(l => map.set(l.habitId, l));
      setDayLogs(map);
    } catch (e) { console.error(e); }
  }, [selectedDate]);

  useEffect(() => {
    loadLogs();
    setReasonModal(null);
    setNumericModal(null);
    setSelectedReason(null);
    setOtherText('');
    setMenuOpen(null);
  }, [loadLogs]);

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    const nd = d.toISOString().split('T')[0];
    if (offset > 0 && nd > today) return;
    onDateChange(nd);
  };

  const displayDate = new Date(selectedDate + 'T00:00:00');
  const dayName = displayDate.toLocaleDateString('en-US', { weekday: 'long' });
  const dateDisplay = displayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // ===== HABIT LOGGING =====
  const handleHabitTap = async (habit: Habit) => {
    if (processing) return;
    setMenuOpen(null);
    setProcessing(habit.id);
    try {
      const existing = await getLogForHabitDate(habit.id, selectedDate);

      if (habit.targetType === 'numeric') {
        setNumericValue(existing?.value?.toString() || '');
        setNumericModal({ habit, log: existing });
        setProcessing(null);
        return;
      }

      if (existing?.completed) {
        // Was completed → tapping again to UNCHECK → ask for reason
        setSelectedReason(null);
        setOtherText('');
        setReasonModal({
          habitId: habit.id,
          habitName: habit.name,
          habitIcon: habit.icon,
          existingLog: existing,
          mode: 'uncheck',
        });
        setProcessing(null);
      } else if (existing && !existing.completed) {
        // Was skipped → re-mark as done (clear excuse)
        await updateLog({
          ...existing,
          completed: true,
          excuseTag: null,
          reflectionText: null,
          loggedAt: Date.now(),
        });
        await loadLogs();
        await onRefresh();
        setProcessing(null);
      } else {
        // No log → mark complete
        await addLog({
          id: generateId(),
          habitId: habit.id,
          date: selectedDate,
          value: null,
          completed: true,
          excuseTag: null,
          reflectionText: null,
          loggedAt: Date.now(),
        });
        await loadLogs();
        await onRefresh();
        setProcessing(null);
      }
    } catch (e) { console.error(e); setProcessing(null); }
  };

  const openReasonForSkip = (habit: Habit) => {
    setMenuOpen(null);
    const existing = dayLogs.get(habit.id);
    setReasonModal({
      habitId: habit.id,
      habitName: habit.name,
      habitIcon: habit.icon,
      existingLog: existing,
      mode: 'skip',
    });
    setSelectedReason(null);
    setOtherText('');
  };

  const closeReasonModal = () => {
    setReasonModal(null);
    setSelectedReason(null);
    setOtherText('');
  };

  const handleReasonSubmit = async () => {
    if (!reasonModal || !selectedReason || submittingReason) return;
    if (selectedReason === 'Other' && !otherText.trim()) return;
    setSubmittingReason(true);

    const excuseTag = selectedReason === 'Other' ? `Other: ${otherText.trim()}` : selectedReason;
    const reflection = selectedReason === 'Other' ? otherText.trim() : null;

    try {
      const existingLog = reasonModal.existingLog;

      if (existingLog) {
        // Update the existing log → mark as NOT completed with excuse
        await updateLog({
          ...existingLog,
          completed: false,
          excuseTag,
          reflectionText: reflection,
          loggedAt: Date.now(),
        });
      } else {
        // Create a new skip log
        await addLog({
          id: generateId(),
          habitId: reasonModal.habitId,
          date: selectedDate,
          value: reasonModal.numValue ?? null,
          completed: false,
          excuseTag,
          reflectionText: reflection,
          loggedAt: Date.now(),
        });
      }

      closeReasonModal();
      await loadLogs();
      await onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingReason(false);
    }
  };

  const handleNumericSubmit = async () => {
    if (!numericModal) return;
    const val = parseFloat(numericValue);
    if (isNaN(val) || val < 0) return;
    const target = numericModal.habit.targetValue || 1;
    const completed = val >= target;

    if (!completed) {
      // Didn't meet target → ask for reason
      setNumericModal(null);
      setReasonModal({
        habitId: numericModal.habit.id,
        habitName: numericModal.habit.name,
        habitIcon: numericModal.habit.icon,
        existingLog: numericModal.log,
        numValue: val,
        mode: 'skip',
      });
      setSelectedReason(null);
      setOtherText('');
      return;
    }

    try {
      if (numericModal.log) {
        await updateLog({
          ...numericModal.log,
          value: val,
          completed: true,
          excuseTag: null,
          reflectionText: null,
          loggedAt: Date.now(),
        });
      } else {
        await addLog({
          id: generateId(),
          habitId: numericModal.habit.id,
          date: selectedDate,
          value: val,
          completed: true,
          excuseTag: null,
          reflectionText: null,
          loggedAt: Date.now(),
        });
      }
      setNumericModal(null);
      setNumericValue('');
      await loadLogs();
      await onRefresh();
    } catch (e) { console.error(e); }
  };

  // ===== HABIT MANAGEMENT =====
  const openNewHabit = () => {
    setForm({ ...DEFAULT_FORM });
    setIconSearch('');
    setIconTab('All');
    setSaving(false);
    setShowIconPicker(false);
    setHabitFormModal({});
    setMenuOpen(null);
  };

  const openEditHabit = (h: Habit) => {
    setForm({
      name: h.name,
      icon: h.icon,
      category: h.category,
      targetType: h.targetType,
      targetValue: h.targetValue?.toString() || '',
    });
    setIconSearch('');
    setIconTab('All');
    setSaving(false);
    setShowIconPicker(false);
    setHabitFormModal({ editing: h });
    setMenuOpen(null);
  };

  const closeHabitForm = () => {
    setHabitFormModal(null);
    setSaving(false);
  };

  const handleSaveHabit = async () => {
    const name = form.name.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      const editing = habitFormModal?.editing;
      if (editing) {
        await updateHabit({
          ...editing,
          name,
          icon: form.icon,
          category: form.category,
          targetType: form.targetType,
          targetValue: form.targetType === 'numeric' ? (parseFloat(form.targetValue) || 1) : null,
        });
      } else {
        await addHabit({
          id: generateId(),
          name,
          icon: form.icon,
          category: form.category,
          targetType: form.targetType,
          targetValue: form.targetType === 'numeric' ? (parseFloat(form.targetValue) || 1) : null,
          archived: false,
          order: habits.length,
          createdAt: Date.now(),
        });
      }
      closeHabitForm();
      await onRefresh();
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  const handleDeleteHabit = async (id: string) => {
    await deleteHabit(id);
    setDeleteConfirm(null);
    setMenuOpen(null);
    await onRefresh();
  };

  const handleArchive = async (h: Habit) => {
    await updateHabit({ ...h, archived: !h.archived });
    setMenuOpen(null);
    await onRefresh();
  };

  const filteredIcons = useMemo(() => {
    let icons = iconTab === 'All' ? UNIQUE_HABIT_ICONS : (ICON_CATEGORIES[iconTab] || []);
    if (iconSearch.trim()) {
      const q = iconSearch.toLowerCase();
      icons = icons.filter(i => i.toLowerCase().includes(q));
    }
    return icons;
  }, [iconTab, iconSearch]);

  const activeHabits = habits.filter(h => !h.archived);
  const archivedHabits = habits.filter(h => h.archived);
  const completedToday = Array.from(dayLogs.values()).filter(l => l.completed).length;

  const scoreColor = dailyScore >= 70 ? '#22c55e' : dailyScore >= 40 ? '#f59e0b' : '#ef4444';
  const scoreGlow = dailyScore >= 70 ? 'rgba(34,197,94,0.12)' : dailyScore >= 40 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';

  return (
    <div className="animate-fade-in" onClick={() => setMenuOpen(null)}>

      {/* ===== HEADER ===== */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <Logo size={34} showName />
          <button
            onClick={openNewHabit}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-gold text-bg text-xs font-bold hover:bg-gold-dim transition-colors active:scale-95"
          >
            <Plus size={14} strokeWidth={2.5} />
            New
          </button>
        </div>

        {/* 3 stat tiles */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div
            className="bg-bg-card rounded-2xl border border-border p-3 card-shadow"
            style={{ boxShadow: `0 0 20px ${scoreGlow}` }}
          >
            <div className="text-text-dim text-[9px] tracking-wider uppercase font-medium mb-1 flex items-center gap-1">
              <Target size={9} /> Score
            </div>
            <div className="text-3xl font-bold tabular-nums leading-none" style={{ color: scoreColor }}>
              {dailyScore}
            </div>
            <div className="text-text-dim text-[9px] mt-0.5">today</div>
          </div>

          <div
            className="bg-bg-card rounded-2xl border border-border p-3 card-shadow cursor-pointer hover:border-gold/20 transition-colors"
            onClick={() => navigateTo('history')}
          >
            <div className="text-text-dim text-[9px] tracking-wider uppercase font-medium mb-1 flex items-center gap-1">
              <Flame size={9} /> Streak
            </div>
            <div className="text-3xl font-bold tabular-nums leading-none text-gold">{bestStreak.streak}</div>
            <div className="text-text-dim text-[9px] mt-0.5 truncate">{bestStreak.habit?.name || 'days'}</div>
          </div>

          <div
            className="bg-bg-card rounded-2xl border border-border p-3 card-shadow cursor-pointer hover:border-gold/20 transition-colors"
            onClick={() => navigateTo('insights')}
          >
            <div className="text-text-dim text-[9px] tracking-wider uppercase font-medium mb-1 flex items-center gap-1">
              <X size={9} /> Excuse
            </div>
            {topExcuse ? (
              <div className="text-[11px] font-bold leading-tight mt-1" style={{ color: '#ef4444', opacity: 0.8 }}>
                {topExcuse.length > 12 ? topExcuse.slice(0, 12) + '…' : topExcuse}
              </div>
            ) : (
              <div className="text-[11px] font-bold text-success leading-tight mt-1">None</div>
            )}
          </div>
        </div>

        {/* Date selector */}
        <div className="flex items-center justify-between bg-bg-card rounded-2xl border border-border px-3 py-2.5 card-shadow">
          <button
            onClick={() => changeDate(-1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:text-gold hover:bg-bg-elevated transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <div className="text-sm font-bold">{isToday ? 'Today' : dayName}</div>
            <div className="text-text-dim text-[11px]">{dateDisplay}</div>
          </div>
          <button
            onClick={() => changeDate(1)}
            disabled={isToday}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:text-gold hover:bg-bg-elevated transition-all disabled:opacity-20 disabled:pointer-events-none"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* ===== HABITS LIST ===== */}
      <div className="px-4 pb-4 space-y-2">
        {activeHabits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-bg-card border border-dashed border-border flex items-center justify-center mb-4">
              <Target size={28} className="text-text-dim" />
            </div>
            <div className="text-text-muted text-sm font-semibold mb-1">No habits yet</div>
            <div className="text-text-dim text-xs mb-5 max-w-[200px]">
              Define your first discipline target
            </div>
            <button
              onClick={openNewHabit}
              className="h-10 px-6 rounded-xl bg-gold text-bg text-xs font-bold flex items-center gap-2"
            >
              <Plus size={14} /> Get Started
            </button>
          </div>
        ) : (
          <>
            {activeHabits.length > 0 && (
              <div className="flex items-center justify-between py-1 mb-1">
                <span className="text-text-dim text-[10px] font-medium uppercase tracking-wider">
                  {isToday ? "Today's habits" : `${dayName}, ${dateDisplay}`}
                </span>
                <span className="text-text-dim text-[10px] tabular-nums">
                  {completedToday}/{activeHabits.length}
                </span>
              </div>
            )}

            {activeHabits.map(habit => {
              const log = dayLogs.get(habit.id);
              const isCompleted = log?.completed || false;
              const hasReason = log && !log.completed && log.excuseTag;
              const isProc = processing === habit.id;
              const isMenuOpen = menuOpen === habit.id;

              return (
                <div
                  key={habit.id}
                  className={`relative bg-bg-card rounded-2xl border transition-all duration-200 card-shadow overflow-visible ${
                    isCompleted
                      ? 'border-success/25'
                      : hasReason
                      ? 'border-danger/20'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3 p-3.5">
                    {/* Main tap zone — completes OR opens uncheck reason if already done */}
                    <button
                      onClick={() => handleHabitTap(habit)}
                      disabled={isProc}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90 ${
                        isCompleted
                          ? 'bg-success/12'
                          : hasReason
                          ? 'bg-danger/8'
                          : 'bg-bg-elevated hover:bg-bg-elevated/80'
                      }`}
                    >
                      {isProc ? (
                        <Icon name="Loader2" size={20} className="text-text-dim animate-spin-slow" />
                      ) : isCompleted ? (
                        <CheckCircle2 size={22} className="text-success" strokeWidth={2} />
                      ) : (
                        <Icon name={habit.icon} size={20} className={hasReason ? 'text-danger/40' : 'text-text-muted'} />
                      )}
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold truncate ${
                        isCompleted ? 'text-success' : hasReason ? 'text-text-muted/60 line-through decoration-danger/30' : 'text-text'
                      }`}>
                        {habit.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-text-dim text-[10px] uppercase tracking-wider">{habit.category}</span>
                        {habit.targetType === 'numeric' && log?.value != null && (
                          <span className={`text-[10px] font-medium tabular-nums ${log.completed ? 'text-success' : 'text-warning'}`}>
                            {log.value}/{habit.targetValue}
                          </span>
                        )}
                        {hasReason && (
                          <span className="text-danger/60 text-[10px] font-medium truncate max-w-[100px]">
                            {log.excuseTag}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Context menu */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(isMenuOpen ? null : habit.id);
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-text-dim hover:text-text-muted hover:bg-bg-elevated transition-all flex-shrink-0"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>

                  {/* Skip link — only show if no log at all */}
                  {!log && !isProc && (
                    <div className="px-3.5 pb-3 -mt-1">
                      <button
                        onClick={() => openReasonForSkip(habit)}
                        className="text-[10px] text-text-dim hover:text-danger/70 transition-colors font-medium flex items-center gap-1"
                      >
                        <X size={9} className="text-danger/40" />
                        Didn't do it
                      </button>
                    </div>
                  )}

                  {/* Hint for completed — tap icon to uncheck */}
                  {isCompleted && !isProc && (
                    <div className="px-3.5 pb-3 -mt-1">
                      <p className="text-[9px] text-text-dim">Tap to uncheck</p>
                    </div>
                  )}

                  {/* Hint for skipped — tap icon to redo */}
                  {hasReason && !isProc && (
                    <div className="px-3.5 pb-3 -mt-1">
                      <p className="text-[9px] text-text-dim">Tap to mark done</p>
                    </div>
                  )}

                  {/* Dropdown menu */}
                  {isMenuOpen && (
                    <div
                      className="absolute right-2 top-14 z-20 bg-bg-elevated border border-border rounded-xl shadow-xl overflow-hidden animate-fade-in min-w-[152px]"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => openEditHabit(habit)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-text-muted hover:bg-bg-card hover:text-text transition-colors"
                      >
                        <Pencil size={13} className="text-text-dim" /> Edit
                      </button>
                      {!log && (
                        <button
                          onClick={() => openReasonForSkip(habit)}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-text-muted hover:bg-bg-card hover:text-text transition-colors"
                        >
                          <X size={13} className="text-danger/60" /> Mark skipped
                        </button>
                      )}
                      <button
                        onClick={() => handleArchive(habit)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-text-muted hover:bg-bg-card hover:text-text transition-colors"
                      >
                        <Archive size={13} className="text-text-dim" /> Archive
                      </button>
                      <div className="border-t border-border" />
                      {deleteConfirm === habit.id ? (
                        <div className="px-3 py-2">
                          <p className="text-[10px] text-danger mb-2">Delete all data?</p>
                          <div className="flex gap-1.5">
                            <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-1.5 rounded-lg bg-bg-card text-[10px] text-text-muted">No</button>
                            <button onClick={() => handleDeleteHabit(habit.id)} className="flex-1 py-1.5 rounded-lg bg-danger text-[10px] text-white font-bold">Yes</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(habit.id)}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-danger/70 hover:bg-bg-card hover:text-danger transition-colors"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Archived */}
        {archivedHabits.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowArchived(v => !v)}
              className="flex items-center gap-2 text-text-dim text-[10px] tracking-[0.15em] uppercase font-medium w-full py-2"
            >
              <Archive size={10} /> Archived ({archivedHabits.length})
              <ChevronDown size={10} className={`ml-auto transition-transform ${showArchived ? 'rotate-180' : ''}`} />
            </button>
            {showArchived && (
              <div className="space-y-2 animate-fade-in">
                {archivedHabits.map(h => (
                  <div key={h.id} className="bg-bg-card rounded-2xl border border-border p-3.5 opacity-50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center">
                      <Icon name={h.icon} size={18} className="text-text-dim" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text-muted truncate">{h.name}</div>
                      <div className="text-text-dim text-[10px] uppercase tracking-wider">{h.category}</div>
                    </div>
                    <button
                      onClick={() => handleArchive(h)}
                      className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center text-text-dim hover:text-success transition-colors"
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(h.id)}
                      className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center text-text-dim hover:text-danger transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== SKIP/UNCHECK REASON MODAL ===== */}
      {reasonModal && (
        <div
          className="fixed inset-0 bg-black/92 z-50 flex items-end justify-center"
          onClick={closeReasonModal}
        >
          <div
            className="bg-bg-card w-full max-w-lg rounded-t-3xl animate-slide-up overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-8 h-1 rounded-full bg-border" />
            </div>
            <div className="px-5 pt-2 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center flex-shrink-0">
                  <Icon name={reasonModal.habitIcon} size={18} className="text-text-muted" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">{reasonModal.habitName}</h3>
                  <p className="text-text-dim text-[11px] mt-0.5">
                    {reasonModal.mode === 'uncheck'
                      ? 'Why are you removing this? Pick a reason.'
                      : 'What got in the way?'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 overflow-y-auto" style={{ maxHeight: '65vh' }}>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {EXCUSE_OPTIONS.map(excuse => {
                  const config = REASON_CONFIG[excuse];
                  const isSelected = selectedReason === excuse;
                  return (
                    <button
                      key={excuse}
                      onClick={() => setSelectedReason(excuse)}
                      className={`p-3.5 rounded-xl text-left border transition-all ${
                        isSelected
                          ? 'border-gold/50 bg-gold/8 text-text'
                          : 'border-border text-text-muted bg-bg-elevated hover:border-border-hover'
                      }`}
                    >
                      <div className={`mb-1.5 ${isSelected ? 'text-gold' : 'text-text-dim'}`}>
                        {config.icon}
                      </div>
                      <div className="text-xs font-bold leading-tight">{config.label}</div>
                      <div className={`text-[10px] mt-0.5 leading-tight ${isSelected ? 'text-text-dim' : 'text-text-dim/60'}`}>
                        {config.sub}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedReason === 'Other' && (
                <div className="mb-4 animate-fade-in">
                  <textarea
                    value={otherText}
                    onChange={e => setOtherText(e.target.value)}
                    placeholder="What got in the way?"
                    autoFocus
                    rows={2}
                    className="w-full bg-bg rounded-xl border border-border p-3 text-sm text-text placeholder-text-dim resize-none focus:outline-none focus:border-gold/50 transition-colors"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={closeReasonModal}
                  className="flex-1 py-3.5 rounded-xl border border-border text-text-muted text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReasonSubmit}
                  disabled={!selectedReason || (selectedReason === 'Other' && !otherText.trim()) || submittingReason}
                  className="flex-1 py-3.5 rounded-xl bg-bg-elevated border border-border text-text font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2 hover:border-gold/30 transition-all"
                >
                  {submittingReason
                    ? <Icon name="Loader2" size={14} className="animate-spin-slow" />
                    : <><Check size={14} className="text-gold" strokeWidth={2.5} /> Save</>
                  }
                </button>
              </div>
              <div className="h-2" />
            </div>
          </div>
        </div>
      )}

      {/* ===== NUMERIC MODAL ===== */}
      {numericModal && (
        <div
          className="fixed inset-0 bg-black/92 z-50 flex items-end justify-center"
          onClick={() => { setNumericModal(null); setNumericValue(''); }}
        >
          <div
            className="bg-bg-card w-full max-w-lg rounded-t-3xl p-5 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center mb-4">
              <div className="w-8 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-bg-elevated flex items-center justify-center">
                <Icon name={numericModal.habit.icon} size={22} className="text-gold" />
              </div>
              <div>
                <h3 className="text-sm font-bold">{numericModal.habit.name}</h3>
                <p className="text-text-dim text-[10px] mt-0.5">
                  Target: <span className="text-gold font-bold">{numericModal.habit.targetValue}</span>
                </p>
              </div>
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={numericValue}
              onChange={e => setNumericValue(e.target.value)}
              placeholder={`${numericModal.habit.targetValue}`}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleNumericSubmit()}
              className="w-full bg-bg rounded-xl border border-border p-4 text-3xl text-text placeholder-text-dim focus:outline-none focus:border-gold/50 text-center tabular-nums font-bold transition-colors"
            />
            {numericValue && !isNaN(parseFloat(numericValue)) && (
              <div className={`text-center text-xs mt-2 font-semibold ${
                parseFloat(numericValue) >= (numericModal.habit.targetValue || 1) ? 'text-success' : 'text-warning'
              }`}>
                {parseFloat(numericValue) >= (numericModal.habit.targetValue || 1)
                  ? 'Target reached ✓'
                  : `${((parseFloat(numericValue) / (numericModal.habit.targetValue || 1)) * 100).toFixed(0)}% of target`
                }
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setNumericModal(null); setNumericValue(''); }}
                className="flex-1 py-3.5 rounded-xl border border-border text-text-muted text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleNumericSubmit}
                disabled={!numericValue || isNaN(parseFloat(numericValue)) || parseFloat(numericValue) < 0}
                className="flex-1 py-3.5 rounded-xl bg-gold text-bg font-bold text-sm disabled:opacity-30"
              >
                Log
              </button>
            </div>
            <div className="h-3" />
          </div>
        </div>
      )}

      {/* ===== HABIT FORM MODAL ===== */}
      {habitFormModal !== null && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-end justify-center"
          onClick={closeHabitForm}
        >
          <div
            className="bg-bg-card w-full max-w-lg rounded-t-3xl animate-slide-up overflow-hidden flex flex-col"
            style={{ maxHeight: '94vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
              <h3 className="text-sm font-bold">{habitFormModal.editing ? 'Edit Habit' : 'New Habit'}</h3>
              <button
                onClick={closeHabitForm}
                className="w-8 h-8 rounded-xl bg-bg-elevated flex items-center justify-center text-text-dim hover:text-text transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[10px] text-text-dim uppercase tracking-[0.15em] font-medium mb-2">Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Morning run, Read 30 pages..."
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && !showIconPicker && handleSaveHabit()}
                  className="w-full bg-bg rounded-xl border border-border p-3.5 text-sm text-text placeholder-text-dim focus:outline-none focus:border-gold/60 transition-colors"
                />
              </div>

              {/* Icon picker */}
              <div>
                <label className="block text-[10px] text-text-dim uppercase tracking-[0.15em] font-medium mb-2">Icon</label>
                <button
                  onClick={() => setShowIconPicker(v => !v)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-bg border border-border hover:border-gold/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                    <Icon name={form.icon} size={20} className="text-gold" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-semibold text-text">{form.icon}</div>
                    <div className="text-text-dim text-[10px]">Tap to change</div>
                  </div>
                  <ChevronDown size={14} className={`text-text-dim transition-transform ${showIconPicker ? 'rotate-180' : ''}`} />
                </button>

                {showIconPicker && (
                  <div className="mt-2 animate-fade-in">
                    <div className="relative mb-2">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none" />
                      <input
                        value={iconSearch}
                        onChange={e => setIconSearch(e.target.value)}
                        placeholder="Search icons..."
                        className="w-full bg-bg rounded-xl border border-border pl-8 pr-3 py-2.5 text-xs text-text placeholder-text-dim focus:outline-none focus:border-gold/50 transition-colors"
                      />
                    </div>
                    <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                      {['All', ...Object.keys(ICON_CATEGORIES)].map(tab => (
                        <button
                          key={tab}
                          onClick={() => setIconTab(tab)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] whitespace-nowrap font-bold transition-all flex-shrink-0 ${
                            iconTab === tab
                              ? 'bg-gold/15 text-gold border border-gold/30'
                              : 'text-text-dim bg-bg-elevated border border-transparent'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-9 gap-1.5 max-h-44 overflow-y-auto p-2 rounded-xl bg-bg border border-border">
                      {filteredIcons.map(iconName => (
                        <button
                          key={iconName}
                          onClick={() => { setForm(f => ({ ...f, icon: iconName })); setShowIconPicker(false); }}
                          className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                            form.icon === iconName
                              ? 'bg-gold/15 text-gold ring-1 ring-gold/50 scale-95'
                              : 'text-text-dim hover:bg-bg-elevated hover:text-text-muted'
                          }`}
                          title={iconName}
                        >
                          <Icon name={iconName} size={16} />
                        </button>
                      ))}
                      {filteredIcons.length === 0 && (
                        <div className="col-span-9 py-6 text-center text-text-dim text-xs">No icons match</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-[10px] text-text-dim uppercase tracking-[0.15em] font-medium mb-2">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(f => ({ ...f, category: c }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        form.category === c
                          ? 'border-gold/50 bg-gold/10 text-gold'
                          : 'border-border text-text-dim bg-bg-elevated'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tracking type */}
              <div>
                <label className="block text-[10px] text-text-dim uppercase tracking-[0.15em] font-medium mb-2">Tracking</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setForm(f => ({ ...f, targetType: 'boolean' }))}
                    className={`py-3 rounded-xl text-sm font-bold border transition-all flex items-center justify-center gap-2 ${
                      form.targetType === 'boolean'
                        ? 'border-gold/50 bg-gold/10 text-gold'
                        : 'border-border text-text-muted bg-bg-elevated'
                    }`}
                  >
                    <Check size={15} /> Done / Not
                  </button>
                  <button
                    onClick={() => setForm(f => ({ ...f, targetType: 'numeric' }))}
                    className={`py-3 rounded-xl text-sm font-bold border transition-all flex items-center justify-center gap-2 ${
                      form.targetType === 'numeric'
                        ? 'border-gold/50 bg-gold/10 text-gold'
                        : 'border-border text-text-muted bg-bg-elevated'
                    }`}
                  >
                    <Hash size={15} /> Numeric
                  </button>
                </div>
                {form.targetType === 'numeric' && (
                  <div className="mt-3 animate-fade-in">
                    <label className="block text-[10px] text-text-dim uppercase tracking-[0.1em] font-medium mb-2">Daily Target</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={form.targetValue}
                      onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
                      placeholder="e.g. 30, 10000, 8"
                      className="w-full bg-bg rounded-xl border border-border p-3.5 text-sm text-text placeholder-text-dim focus:outline-none focus:border-gold/50 transition-colors"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={handleSaveHabit}
                disabled={!form.name.trim() || saving}
                className="w-full py-4 rounded-xl bg-gold text-bg font-bold text-sm disabled:opacity-30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><Icon name="Loader2" size={16} className="animate-spin-slow" /> Saving...</>
                ) : (
                  <><Check size={16} strokeWidth={2.5} />{habitFormModal.editing ? 'Save Changes' : 'Create Habit'}</>
                )}
              </button>
              <div className="h-2" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
