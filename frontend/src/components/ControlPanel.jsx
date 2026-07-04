import React from 'react';

const ControlPanel = ({ 
  gpsActive, 
  onToggleGps, 
  onClearFilters, 
  filterCount = 0, 
  wsConnected,
  simulatorActive,
  onToggleSimulator,
  audioEnabled,
  onToggleAudio
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 cyber-card rounded-xl font-mono text-xs">
      
      {/* 1. Hardware & Pipeline Link Status */}
      <div className="flex flex-col justify-between p-3 bg-black/35 border border-teal-950/20 rounded-lg">
        <span className="text-teal-600 font-bold uppercase tracking-widest text-[9px]">Pipeline Link</span>
        <div className="mt-3 flex flex-col space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">WebSocket</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight border ${
              wsConnected 
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60' 
                : 'bg-rose-950/40 text-rose-400 border-rose-900/60'
            }`}>
              {wsConnected ? 'Linked' : 'Offline'}
            </span>
          </div>
          {simulatorActive && (
            <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider animate-pulse">
              ⚠️ Emulated Stream
            </span>
          )}
        </div>
      </div>

      {/* 2. High-Accuracy GPS Tracking */}
      <div className="flex flex-col justify-between p-3 bg-black/35 border border-teal-950/20 rounded-lg">
        <span className="text-teal-600 font-bold uppercase tracking-widest text-[9px]">Spatial Profile</span>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-slate-400 font-semibold">{gpsActive ? 'GPS (Raw)' : 'Fused'}</span>
          <button
            onClick={onToggleGps}
            className={`px-2.5 py-1 text-[9px] font-bold uppercase rounded border transition-all ${
              gpsActive 
                ? 'bg-teal-900/40 text-teal-400 border-teal-800 hover:bg-teal-900/60' 
                : 'bg-slate-800/40 text-slate-400 border-slate-700 hover:bg-slate-700/60'
            }`}
          >
            {gpsActive ? 'Active' : 'Enable'}
          </button>
        </div>
      </div>

      {/* 3. Whitelist / Tag Safe Baseline Filters */}
      <div className="flex flex-col justify-between p-3 bg-black/35 border border-teal-950/20 rounded-lg">
        <span className="text-teal-600 font-bold uppercase tracking-widest text-[9px]">Safe Filters</span>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-slate-400">Safe: <b className="text-cyan-400 font-bold font-mono">{filterCount}</b></span>
          <button
            onClick={onClearFilters}
            disabled={filterCount === 0}
            className="px-2 py-1 text-[9px] font-bold text-rose-400 uppercase tracking-tight border border-rose-950/60 bg-rose-950/10 rounded hover:bg-rose-900/20 disabled:opacity-20 disabled:pointer-events-none transition-all"
          >
            Reset
          </button>
        </div>
      </div>

      {/* 4. Audio Alert Mutes & Simulator Mode */}
      <div className="flex flex-col justify-between p-3 bg-black/35 border border-teal-950/20 rounded-lg">
        <span className="text-teal-600 font-bold uppercase tracking-widest text-[9px]">Sys Toggles</span>
        <div className="mt-3 flex space-x-2">
          {/* Audio siren toggle */}
          <button
            onClick={onToggleAudio}
            title={audioEnabled ? 'Siren Audio Alerts Enabled' : 'Siren Audio Alerts Silenced'}
            className={`flex-1 py-1 rounded border text-[9px] font-bold uppercase transition-all ${
              audioEnabled
                ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/30'
                : 'bg-rose-950/20 text-rose-400 border-rose-950/50 hover:bg-rose-900/10'
            }`}
          >
            {audioEnabled ? '🔔 Sound' : '🔕 Mute'}
          </button>
          
          {/* Simulator Mode toggle */}
          <button
            onClick={onToggleSimulator}
            title="Toggle Local GPS & BLE Telemetry Simulator"
            className={`flex-1 py-1 rounded border text-[9px] font-bold uppercase transition-all ${
              simulatorActive
                ? 'bg-amber-950/30 text-amber-400 border-amber-900/50 hover:bg-amber-900/30'
                : 'bg-slate-800/40 text-slate-400 border-slate-700 hover:bg-slate-700/60'
            }`}
          >
            {simulatorActive ? 'Sim ON' : 'Sim Mode'}
          </button>
        </div>
      </div>

    </div>
  );
};

export default ControlPanel;