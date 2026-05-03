import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

export default function Settings() {
  const [backendUrl, setBackendUrl] = useState(() => localStorage.getItem('backendUrl') || 'http://localhost:3001');
  const [groqKey, setGroqKey] = useState(() => localStorage.getItem('groqKey') || '');
  const [autoRefresh, setAutoRefresh] = useState(() => localStorage.getItem('autoRefresh') || '10');
  const [testResult, setTestResult] = useState(null);
  const [apiTestResult, setApiTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem('backendUrl', backendUrl);
    localStorage.setItem('groqKey', groqKey);
    localStorage.setItem('autoRefresh', autoRefresh);
    setTimeout(() => {
      setSaving(false);
      setTestResult({ success: true, message: 'Settings saved successfully!' });
      setTimeout(() => setTestResult(null), 3000);
    }, 300);
  };

  const testConnection = async () => {
    try {
      const response = await fetch(`${backendUrl}/health`, { method: 'GET' });
      if (response.ok) {
        setTestResult({ success: true, message: 'Connected successfully!' });
      } else {
        setTestResult({ success: false, message: `Server responded with ${response.status}` });
      }
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    }
    setTimeout(() => setTestResult(null), 3000);
  };

  const testApiKey = async () => {
    if (!groqKey.trim()) {
      setApiTestResult({ success: false, message: 'API key is required' });
      setTimeout(() => setApiTestResult(null), 3000);
      return;
    }
    try {
      // Simulate API key validation - in production you'd call an actual endpoint
      if (groqKey.startsWith('gsk_') && groqKey.length > 10) {
        setApiTestResult({ success: true, message: 'API key format is valid!' });
      } else {
        setApiTestResult({ success: false, message: 'Invalid API key format' });
      }
    } catch (err) {
      setApiTestResult({ success: false, message: err.message });
    }
    setTimeout(() => setApiTestResult(null), 3000);
  };

  const clearAllData = () => {
    if (window.confirm('⚠️ This will delete all data including brain dumps, sessions, and events. This cannot be undone. Are you sure?')) {
      if (window.confirm('Last chance — are you REALLY sure? Type "DELETE" in your console and run this again if you meant it.')) {
        // In a real app, this would call the backend to clear data
        localStorage.clear();
        alert('All local data has been cleared. Refresh the page to reset.');
      }
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl text-on-surface mb-2" style={{ fontFamily: 'Space Grotesk', fontWeight: 700 }}>Settings</h1>
        <p className="text-sm text-tertiary font-mono">Configure your ContextSwitch experience</p>
      </div>

      {/* Connection Settings */}
      <div className="bg-surface-dim border border-outline p-6 mb-6">
        <h2 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-4 flex items-center gap-2">
          <span>🔌 Connection Settings</span>
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-on-surface-variant uppercase mb-2">Backend URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={backendUrl}
                onChange={e => setBackendUrl(e.target.value)}
                className="flex-1 bg-surface border border-outline p-2.5 text-sm font-mono text-on-surface focus:border-primary-container focus:outline-none"
                placeholder="http://localhost:3001"
              />
              <button
                onClick={testConnection}
                className="px-4 py-2.5 bg-surface border border-outline text-tertiary hover:text-on-surface font-mono text-xs uppercase transition-colors"
              >
                Test
              </button>
            </div>
            {testResult && (
              <div className={`mt-2 flex items-center gap-2 text-xs font-mono ${testResult.success ? 'text-[#4de082]' : 'text-error'}`}>
                {testResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {testResult.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* API Configuration */}
      <div className="bg-surface-dim border border-outline p-6 mb-6">
        <h2 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-4 flex items-center gap-2">
          <span>🔑 API Configuration</span>
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-on-surface-variant uppercase mb-2">GROQ API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={groqKey}
                onChange={e => setGroqKey(e.target.value)}
                className="flex-1 bg-surface border border-outline p-2.5 text-sm font-mono text-on-surface focus:border-primary-container focus:outline-none"
                placeholder="gsk_..."
              />
              <button
                onClick={testApiKey}
                className="px-4 py-2.5 bg-surface border border-outline text-tertiary hover:text-on-surface font-mono text-xs uppercase transition-colors"
              >
                Test
              </button>
            </div>
            {apiTestResult && (
              <div className={`mt-2 flex items-center gap-2 text-xs font-mono ${apiTestResult.success ? 'text-[#4de082]' : 'text-error'}`}>
                {apiTestResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {apiTestResult.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-surface-dim border border-outline p-6 mb-6">
        <h2 className="font-label-mono-xs text-tertiary uppercase tracking-widest mb-4 flex items-center gap-2">
          <span>⚙️ Preferences</span>
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-on-surface-variant uppercase mb-2">Auto-Refresh Interval</label>
            <select
              value={autoRefresh}
              onChange={e => setAutoRefresh(e.target.value)}
              className="w-full bg-surface border border-outline p-2.5 text-sm font-mono text-on-surface focus:border-primary-container focus:outline-none cursor-pointer"
            >
              <option value="5">Every 5 seconds (fast)</option>
              <option value="10">Every 10 seconds (default)</option>
              <option value="30">Every 30 seconds (slow)</option>
            </select>
            <p className="mt-2 text-xs text-tertiary font-mono">Controls how often dashboards fetch new data</p>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-surface-dim border border-error/40 p-6">
        <h2 className="font-label-mono-xs text-error uppercase tracking-widest mb-4 flex items-center gap-2">
          <AlertTriangle size={14} />
          Danger Zone
        </h2>
        <div className="space-y-4">
          <p className="text-xs text-tertiary font-mono">Irreversible actions below. Use with caution.</p>
          <button
            onClick={clearAllData}
            className="w-full px-4 py-3 bg-error/10 border border-error text-error hover:bg-error/20 font-mono text-xs uppercase transition-colors"
          >
            Clear All Data
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3 mt-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-primary-container text-background font-mono text-xs uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
