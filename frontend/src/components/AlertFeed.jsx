import React from 'react';

const AlertFeed = ({ alerts = [] }) => {
  return (
    <div className="w-full space-y-2">
      {alerts.length === 0 ? (
        <div className="p-3.5 text-xs text-center border border-teal-950/20 bg-teal-950/5 rounded-lg text-teal-500 font-mono flex items-center justify-center space-x-2 shadow-inner shadow-teal-950/10">
          <span className="text-sm">🛡️</span>
          <span className="font-bold tracking-wider uppercase">Status: SECURE — No active spatial anomalies verified.</span>
        </div>
      ) : (
        alerts.map((alert, index) => (
          <div 
            key={index} 
            className="flex items-start justify-between p-4 border border-rose-900/50 bg-rose-950/20 rounded-lg animate-alert-pulse text-xs font-mono"
          >
            <div className="flex space-x-3">
              <span className="text-xl animate-bounce">🚨</span>
              <div>
                <h4 className="text-xs font-extrabold text-rose-400 uppercase tracking-widest">
                  PROXIMITY WARNING: ACTIVE PHYSICAL TAIL VERIFIED
                </h4>
                <p className="mt-1 text-[11px] text-slate-300 leading-relaxed uppercase tracking-wider font-semibold">
                  {alert.message}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-rose-400/80 font-bold">
                  <span className="bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/30">Target: {alert.address}</span>
                  <span className="bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/30">Distance: ~{alert.avgDistance?.toFixed(1)}m</span>
                </div>
              </div>
            </div>
            <span className="text-[9px] font-mono bg-rose-500 text-black px-2 py-0.5 rounded uppercase font-extrabold tracking-widest animate-pulse border border-rose-400">
              Critical
            </span>
          </div>
        ))
      )}
    </div>
  );
};

export default AlertFeed;