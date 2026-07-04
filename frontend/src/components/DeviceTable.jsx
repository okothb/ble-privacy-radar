import React, { useState } from 'react';

const DeviceTable = ({ devices = {}, onWhitelist }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const deviceList = Object.values(devices);

  // Helper to determine RSSI signal bar counts (0 to 4 bars)
  const getSignalStrengthBars = (rssi) => {
    const val = parseInt(rssi, 10);
    if (isNaN(val) || val === 0) return 0;
    if (val > -55) return 4;
    if (val > -70) return 3;
    if (val > -85) return 2;
    if (val > -95) return 1;
    return 0;
  };

  // Filter device list based on selected Tab and search queries
  const filteredDevices = deviceList.filter((device) => {
    // 1. Search Query Filter
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const matchMac = device.address.toLowerCase().includes(query);
      const matchName = (device.name || '').toLowerCase().includes(query);
      if (!matchMac && !matchName) return false;
    }

    // 2. Tab Category Filter
    if (activeTab === 'rpa') return device.type === 'RPA (Target)';
    if (activeTab === 'static') return device.type === 'STP (Static)';
    if (activeTab === 'threat') return device.threatScore >= 40;

    return true;
  });

  return (
    <div className="w-full overflow-hidden cyber-card rounded-xl">
      
      {/* Table Header and Toolbar Actions */}
      <div className="p-4 border-b border-teal-950/40 bg-teal-950/5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold tracking-widest text-teal-400 uppercase font-mono">Live Intercept Metrics</h3>
          <p className="text-[9px] text-slate-500 font-mono mt-0.5">Telemetry stream matching intercepted BLE identifiers</p>
        </div>
        
        {/* Search input field */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search MAC or Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-48 bg-black/40 border border-teal-950/60 rounded px-2 py-1 text-[10px] text-teal-400 font-mono focus:outline-none focus:border-teal-400 transition-colors"
          />
        </div>
      </div>

      {/* Tabs Menu navigation */}
      <div className="flex border-b border-teal-950/40 bg-black/25 font-mono text-[10px]">
        {['all', 'rpa', 'static', 'threat'].map((tab) => {
          const labels = {
            all: `All (${deviceList.length})`,
            rpa: `RPAs (${deviceList.filter(d => d.type === 'RPA (Target)').length})`,
            static: `Static (${deviceList.filter(d => d.type === 'STP (Static)').length})`,
            threat: `Threats (${deviceList.filter(d => d.threatScore >= 40).length})`
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 uppercase tracking-wider font-bold border-b-2 transition-all ${
                activeTab === tab 
                  ? 'border-teal-500 text-teal-400 bg-teal-950/10' 
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-mono text-xs">
          <thead>
            <tr className="border-b border-teal-950/40 bg-black/35 text-slate-500 uppercase tracking-widest text-[9px]">
              <th className="p-3">Profile Type</th>
              <th className="p-3">MAC / Signature</th>
              <th className="p-3">Estimated Proximity</th>
              <th className="p-3">Signal RSSI</th>
              <th className="p-3">Threat Rating</th>
              <th className="p-3 text-right">Countermeasure</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-teal-950/20 text-slate-300 bg-black/5">
            {filteredDevices.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-8 text-center text-slate-600 italic">
                  {deviceList.length === 0 
                    ? 'Awaiting raw BLE telemetry signals...' 
                    : 'No devices match active filters.'
                  }
                </td>
              </tr>
            ) : (
              filteredDevices.map((device) => {
                const isRPA = device.type === 'RPA (Target)';
                const bars = getSignalStrengthBars(device.rssi);
                
                // Threat rating configuration style
                let threatLabel = 'Clean';
                let threatColor = 'text-emerald-400 bg-emerald-950/20 border-emerald-900/40';
                if (isRPA) {
                  if (device.threatScore >= 75) {
                    threatLabel = `ALERT: ${device.threatScore}%`;
                    threatColor = 'text-rose-400 bg-rose-950/30 border-rose-900/50 animate-pulse font-bold';
                  } else if (device.threatScore >= 40) {
                    threatLabel = `Warning: ${device.threatScore}%`;
                    threatColor = 'text-amber-400 bg-amber-950/20 border-amber-900/40';
                  } else {
                    threatLabel = `Low: ${device.threatScore}%`;
                    threatColor = 'text-sky-400 bg-sky-950/20 border-sky-900/40';
                  }
                }

                return (
                  <tr key={device.address} className="hover:bg-teal-950/5 transition-colors">
                    {/* 1. Profile Type */}
                    <td className="p-3">
                      <div className="flex items-center">
                        <span className={`inline-block w-1.5 h-1.5 mr-2 rounded-full ${
                          isRPA ? 'bg-amber-400 shadow shadow-amber-400/50' : 'bg-sky-400'
                        }`} />
                        <span className={`font-bold ${isRPA ? 'text-amber-400' : 'text-sky-400'}`}>
                          {isRPA ? 'Random (RPA)' : 'Static (STP)'}
                        </span>
                      </div>
                    </td>

                    {/* 2. MAC Address & Name */}
                    <td className="p-3">
                      <div className="font-semibold text-slate-200">{device.address}</div>
                      <div className="text-[9px] text-slate-500 uppercase tracking-tight">{device.name}</div>
                    </td>

                    {/* 3. Proximity */}
                    <td className="p-3 font-bold text-slate-100">
                      {device.distance !== 'N/A' ? `${device.distance} meters` : 'Dormant'}
                    </td>

                    {/* 4. RSSI and Signal Bars */}
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400">{device.rssi} dBm</span>
                        <div className="flex items-end space-x-0.5 h-3" title={`${bars} of 4 bars`}>
                          {[1, 2, 3, 4].map((i) => (
                            <span 
                              key={i} 
                              className={`w-0.5 rounded-t-sm transition-all ${
                                i <= bars 
                                  ? 'bg-teal-400 shadow-sm shadow-teal-400/50' 
                                  : 'bg-slate-800'
                              }`} 
                              style={{ height: `${i * 25}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    </td>

                    {/* 5. Threat Rating */}
                    <td className="p-3">
                      {isRPA ? (
                        <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider border ${threatColor}`}>
                          {threatLabel}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider bg-slate-900/60 text-slate-500 border border-slate-800/40">
                          Infrastructure
                        </span>
                      )}
                    </td>

                    {/* 6. Tag Safe button Countermeasure */}
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onWhitelist(device.address)}
                        className="px-2 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-tight border border-slate-800 bg-slate-900 rounded hover:bg-teal-950/20 hover:text-teal-400 hover:border-teal-900 transition-all"
                      >
                        Exclude Target
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DeviceTable;