import { useState, useEffect, useRef } from 'react';
import { Key, Download, Upload, Trash2, Shield, Vibrate, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { getSetting, setSetting, exportAllData, importAllData, resetAllData } from '../db';
import Logo from '../components/Logo';

interface Props {
  onRefresh: () => Promise<void>;
}

export default function SettingsView({ onRefresh }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [haptic, setHaptic] = useState(true);
  const [strictExcuse, setStrictExcuse] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSetting('geminiApiKey').then(v => { if (v) setApiKey(v); });
    getSetting('hapticFeedback').then(v => { if (v !== undefined) setHaptic(v); });
    getSetting('strictExcuseEnforcement').then(v => { if (v !== undefined) setStrictExcuse(v); });
  }, []);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const saveApiKey = async () => {
    const trimmed = apiKey.trim();
    await setSetting('geminiApiKey', trimmed);
    showMsg(trimmed ? 'API key saved' : 'API key cleared');
  };

  const toggleHaptic = async () => {
    const v = !haptic;
    setHaptic(v);
    await setSetting('hapticFeedback', v);
  };

  const toggleStrict = async () => {
    const v = !strictExcuse;
    setStrictExcuse(v);
    await setSetting('strictExcuseEnforcement', v);
  };

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mugen-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showMsg('Exported successfully');
    } catch {
      showMsg('Export failed', 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importAllData(text);
      await onRefresh();
      showMsg('Data restored successfully');
    } catch {
      showMsg('Import failed — invalid file', 'error');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReset = async () => {
    await resetAllData();
    setShowResetConfirm(false);
    await onRefresh();
    showMsg('All data reset');
  };

  return (
    <div className="p-4 max-w-lg mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 mt-3">
        <div>
          <h1 className="text-lg font-bold">Settings</h1>
          <p className="text-text-dim text-[10px] tracking-wider uppercase">Configuration</p>
        </div>
        <Logo size={30} />
      </div>

      {/* Toast */}
      {message && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] rounded-xl px-4 py-2.5 text-xs font-medium animate-slide-down flex items-center gap-2 shadow-lg ${
          message.type === 'success'
            ? 'bg-bg-card border border-gold/30 text-gold'
            : 'bg-bg-card border border-danger/30 text-danger'
        }`}>
          {message.type === 'success' ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
          {message.text}
        </div>
      )}

      {/* Gemini API Key */}
      <div className="bg-bg-card rounded-2xl border border-border p-4 mb-2.5 card-shadow">
        <div className="flex items-center gap-1.5 mb-1">
          <Key size={12} className="text-gold" />
          <span className="text-text text-sm font-bold">Gemini API Key</span>
        </div>
        <p className="text-text-dim text-[10px] mb-3 leading-relaxed">
          Used by AI Coach in Insights. Get a free key at{' '}
          <span className="text-gold font-semibold">aistudio.google.com</span>
        </p>
        <div className="relative mb-3">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full bg-bg rounded-xl border border-border p-3 pr-10 text-sm text-text placeholder-text-dim focus:outline-none focus:border-gold/50 transition-colors font-mono"
          />
          <button
            onClick={() => setShowKey(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text transition-colors"
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button
          onClick={saveApiKey}
          className="w-full py-2.5 rounded-xl bg-gold text-bg text-sm font-bold hover:bg-gold-dim transition-colors"
        >
          Save Key
        </button>
      </div>

      {/* Toggles */}
      <div className="bg-bg-card rounded-2xl border border-border p-4 mb-2.5 card-shadow space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Vibrate size={15} className="text-text-dim mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium">Haptic Feedback</div>
              <div className="text-text-dim text-[10px]">Vibrate on tap</div>
            </div>
          </div>
          <button
            onClick={toggleHaptic}
            className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${haptic ? 'bg-gold' : 'bg-border'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-200 ${haptic ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <div className="border-t border-border" />

        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Shield size={15} className="text-text-dim mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium">Strict Mode</div>
              <div className="text-text-dim text-[10px]">Require reason for every skip</div>
            </div>
          </div>
          <button
            onClick={toggleStrict}
            className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${strictExcuse ? 'bg-gold' : 'bg-border'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-200 ${strictExcuse ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {/* Data */}
      <div className="bg-bg-card rounded-2xl border border-border p-4 mb-2.5 card-shadow">
        <div className="flex items-center gap-1.5 mb-3">
          <Download size={12} className="text-text-dim" />
          <span className="text-text-dim text-[10px] tracking-[0.15em] uppercase font-medium">Data</span>
        </div>
        <div className="space-y-2">
          <button
            onClick={handleExport}
            className="w-full py-3 rounded-xl border border-border text-text-muted text-sm font-medium hover:border-gold/30 hover:text-gold transition-all flex items-center justify-center gap-2"
          >
            <Download size={14} /> Export as JSON
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 rounded-xl border border-border text-text-muted text-sm font-medium hover:border-gold/30 hover:text-gold transition-all flex items-center justify-center gap-2"
          >
            <Upload size={14} /> Restore from JSON
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </div>
      </div>

      {/* Danger */}
      <div className="bg-bg-card rounded-2xl border border-danger/20 p-4 card-shadow">
        <div className="flex items-center gap-1.5 mb-3">
          <Trash2 size={12} className="text-danger" />
          <span className="text-danger/80 text-[10px] tracking-[0.15em] uppercase font-medium">Danger Zone</span>
        </div>
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="w-full py-3 rounded-xl border border-danger/30 text-danger text-sm font-medium hover:bg-danger/8 transition-all flex items-center justify-center gap-2"
          >
            <Trash2 size={14} /> Reset All Data
          </button>
        ) : (
          <div className="animate-fade-in">
            <div className="flex items-start gap-2 mb-3 p-3 rounded-xl bg-danger/5 border border-danger/10">
              <AlertTriangle size={13} className="text-danger mt-0.5 flex-shrink-0" />
              <p className="text-danger text-xs leading-relaxed">
                Permanently deletes all habits, logs, and AI analyses. Cannot be undone.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-text-muted text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 rounded-xl bg-danger text-white text-sm font-semibold"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* App info */}
      <div className="mt-8 mb-4 text-center">
        <Logo size={28} showName className="justify-center mb-2" />
        <div className="text-text-dim text-[9px] mt-2 leading-relaxed tracking-wider">
          Offline-first · No tracking · No cloud · No excuses
        </div>
        <div className="text-text-dim/40 text-[9px] mt-1">v1.0.0</div>
      </div>
    </div>
  );
}
