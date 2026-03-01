import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { LayoutGrid, CalendarDays, Lightbulb, Settings, Loader2 } from 'lucide-react';
import { useHabits, useLogs, useOnline } from './hooks';
import { todayStr } from './db';
import Logo from './components/Logo';

const HomeView = lazy(() => import('./pages/HomeView'));
const HeatmapView = lazy(() => import('./pages/HeatmapView'));
const InsightsView = lazy(() => import('./pages/InsightsView'));
const SettingsView = lazy(() => import('./pages/SettingsView'));

export type Page = 'home' | 'history' | 'insights' | 'settings';

const NAV_ITEMS: { page: Page; icon: React.ElementType; label: string }[] = [
  { page: 'home', icon: LayoutGrid, label: 'Today' },
  { page: 'history', icon: CalendarDays, label: 'History' },
  { page: 'insights', icon: Lightbulb, label: 'Insights' },
  { page: 'settings', icon: Settings, label: 'Settings' },
];

export function App() {
  const [page, setPage] = useState<Page>('home');
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const { habits, loading: habitsLoading, refresh: refreshHabits } = useHabits();
  const { logs: allLogs, loading: logsLoading, refresh: refreshLogs } = useLogs();
  const online = useOnline();

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshHabits(), refreshLogs()]);
  }, [refreshHabits, refreshLogs]);

  useEffect(() => { refreshAll(); }, []);

  const navigateTo = useCallback((p: string, date?: string) => {
    setPage(p as Page);
    if (date) setSelectedDate(date);
  }, []);

  if (habitsLoading || logsLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-bg">
        <div className="text-center">
          <div
            className="w-20 h-20 rounded-3xl bg-bg-card border border-gold/20 flex items-center justify-center mx-auto mb-5"
            style={{ boxShadow: '0 0 60px rgba(212,175,55,0.08)' }}
          >
            <Logo size={44} />
          </div>
          <div className="text-text text-base font-bold tracking-[0.35em] uppercase">Mugen</div>
          <div className="text-text-dim text-[9px] tracking-[0.5em] uppercase mt-1">無限</div>
          <div className="mt-5">
            <Loader2 size={16} className="text-text-dim animate-spin-slow mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col max-w-lg mx-auto">
      {!online && (
        <div className="bg-warning/8 border-b border-warning/15 px-4 py-2 text-center text-[11px] text-warning flex items-center justify-center gap-2 flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
          Offline — AI unavailable
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-20">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <Loader2 size={18} className="text-text-dim animate-spin-slow" />
            </div>
          }
        >
          {page === 'home' && (
            <HomeView
              habits={habits}
              logs={allLogs}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onRefresh={refreshAll}
              navigateTo={navigateTo}
            />
          )}
          {page === 'history' && (
            <HeatmapView
              habits={habits}
              logs={allLogs}
              onDateSelect={(d) => {
                setSelectedDate(d);
                setPage('home');
              }}
            />
          )}
          {page === 'insights' && (
            <InsightsView habits={habits} logs={allLogs} online={online} />
          )}
          {page === 'settings' && (
            <SettingsView onRefresh={refreshAll} />
          )}
        </Suspense>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-bg/97 backdrop-blur-2xl border-t border-border z-50">
        <div
          className="grid grid-cols-4"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 10px)', paddingTop: '6px' }}
        >
          {NAV_ITEMS.map((item) => {
            const IconComp = item.icon;
            const active = page === item.page;
            return (
              <button
                key={item.page}
                onClick={() => setPage(item.page)}
                className={`flex flex-col items-center py-2 px-2 relative transition-all duration-200 ${
                  active ? 'text-gold' : 'text-text-dim'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-5 right-5 h-[2px] rounded-full bg-gold" />
                )}
                <IconComp size={21} strokeWidth={active ? 2.2 : 1.6} />
                <span
                  className={`text-[9px] mt-1 tracking-widest uppercase font-semibold transition-colors ${
                    active ? 'text-gold' : 'text-text-dim'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
