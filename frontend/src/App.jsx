import React, { useState, useEffect, useRef } from 'react';
import RadarScreen from './components/RadarScreen';
import AlertFeed from './components/AlertFeed';
import DeviceTable from './components/DeviceTable';
import ControlPanel from './components/ControlPanel';
import AnomalyEngine from './core/AnomalyEngine';
import { GpsTracker } from './utils/gpsTracker';
import { calculateDistance } from './utils/distance';
import { classifyMacAddress } from './utils/macClassifier';

const App = () => {
  const [devices, setDevices] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [gpsActive, setGpsActive] = useState(true); // Default to true to trigger automatically on load
  const [wsConnected, setWsConnected] = useState(false);
  const [whitelist, setWhitelist] = useState(new Set());
  const [simulatorActive, setSimulatorActive] = useState(true); // Default to true so it functions automatically out of the box
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [currentSpeed, setCurrentSpeed] = useState(0);

  const anomalyEngineRef = useRef(null);
  const gpsTrackerRef = useRef(null);
  const audioContextRef = useRef(null);
  const socketRef = useRef(null);
  const simIntervalRef = useRef(null);
  const simStepRef = useRef(0);
  const simulatorActiveRef = useRef(true);

  // Keep simulator active ref in sync to prevent stale closures in hooks
  useEffect(() => {
    simulatorActiveRef.current = simulatorActive;
  }, [simulatorActive]);

  // Initialize the intelligence core on application mount
  useEffect(() => {
    anomalyEngineRef.current = new AnomalyEngine((newAlert) => {
      setAlerts((prev) => [newAlert, ...prev]);
      triggerAudioSiren();
    });

    gpsTrackerRef.current = new GpsTracker(
      (gpsTelemetry) => {
        if (anomalyEngineRef.current) {
          anomalyEngineRef.current.updateUserMovement(gpsTelemetry);
          setCurrentSpeed(gpsTelemetry.speed);
        }
      },
      (error) => {
        setGpsActive(false);
      }
    );

    // Automatically start spatial tracking on load
    const active = gpsTrackerRef.current.startTracking();
    if (!active) {
      setGpsActive(false);
    }

    // Background Garbage Collection Sweep Loop
    const GC_INTERVAL = setInterval(() => {
      if (anomalyEngineRef.current && !simulatorActiveRef.current) {
        anomalyEngineRef.current.garbageCollectStaleAssets();
        setDevices({ ...anomalyEngineRef.current.deviceRegistry });
      }
    }, 10000);

    return () => {
      clearInterval(GC_INTERVAL);
      if (gpsTrackerRef.current) gpsTrackerRef.current.stopTracking();
      if (socketRef.current) socketRef.current.close();
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  // Manage Real Hardware WebSocket Connection & Reconnection
  useEffect(() => {
    let reconnectTimeout = null;
    let socket = null;

    const connectWebSocket = () => {
      if (socket) {
        try {
          socket.close();
        } catch (e) {}
      }

      socket = new WebSocket('ws://localhost:8765');
      socketRef.current = socket;

      socket.onopen = () => {
        setWsConnected(true);
        if (anomalyEngineRef.current) {
          anomalyEngineRef.current.deviceRegistry = {};
        }
        setDevices({});
        setAlerts([]);
        setCurrentSpeed(0);
        setSimulatorActive(false); // Disable simulator when live hardware connects
        console.log('Telemetry link to native RF antenna established.');
      };

      socket.onmessage = (event) => {
        if (simulatorActiveRef.current) return; // Prevent raw packets from mixing with simulation

        try {
          const rawPacket = JSON.parse(event.data);
          
          if (whitelist.has(rawPacket.address)) return;

          const calculatedMeters = calculateDistance(rawPacket.rssi, rawPacket.tx_power);
          const addressClass = classifyMacAddress(rawPacket.address);

          const refinedDevice = {
            address: rawPacket.address,
            name: rawPacket.name,
            rssi: rawPacket.rssi,
            distance: calculatedMeters,
            type: addressClass,
            manufacturerIds: rawPacket.manufacturer_ids || []
          };

          if (anomalyEngineRef.current) {
            anomalyEngineRef.current.processTelemetry(refinedDevice);
            setDevices({ ...anomalyEngineRef.current.deviceRegistry });
          }
        } catch (err) {
          console.error('Data parsing exception caught:', err);
        }
      };

      socket.onerror = () => {
        // Handled by onclose
      };

      socket.onclose = () => {
        socketRef.current = null;
        setWsConnected((prevConnected) => {
          if (prevConnected) {
            // Automatically fallback to simulator if a live telemetry link is severed
            setSimulatorActive(true);
          }
          return false;
        });

        console.warn('Telemetry link severed. Reconnecting...');
        reconnectTimeout = setTimeout(() => {
          connectWebSocket();
        }, 5000);
      };
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) {
        socket.close();
      }
      socketRef.current = null;
    };
  }, [whitelist]);

  // Manage Simulator Loop State
  useEffect(() => {
    if (!simulatorActive) {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      // Reset engine states only if not transitioning to a live WebSocket connection
      if (!wsConnected && anomalyEngineRef.current) {
        anomalyEngineRef.current.deviceRegistry = {};
        setDevices({});
        setAlerts([]);
        setCurrentSpeed(0);
      }
      return;
    }

    // Spawn Simulator Loop
    simStepRef.current = 0;
    simIntervalRef.current = setInterval(() => {
      const step = simStepRef.current;
      simStepRef.current += 1;

      // 1. Simulate user speed acceleration profile
      let userSpeed = 0.5; // Walking pace (m/s)
      if (step > 5 && step <= 15) {
        userSpeed = 0.5 + (step - 5) * 0.6; // Accelerating to ~6.5 m/s (transit speed)
      } else if (step > 15 && step < 40) {
        userSpeed = 6.5 + Math.sin(step) * 0.3; // Normal cruising speed
      } else if (step >= 40) {
        userSpeed = 6.8;
      }

      // Update movement state
      setCurrentSpeed(userSpeed);
      if (anomalyEngineRef.current) {
        anomalyEngineRef.current.updateUserMovement({
          lat: 37.7749 + (step * 0.0001),
          lon: -122.4194 + (step * 0.0001),
          speed: userSpeed,
          timestamp: Date.now()
        });
      }

      // 2. Generate Simulated BLE Packets
      const packets = [];

      // Packet A: The AirTag Tracker (RPA Target) that moves with us
      // Distance remains flat (~5.2m), causing threat score to spike under transit speed
      // Rotates MAC at step 22
      const trackerMac = step < 22 ? '4b:2a:8f:9c:71:0d' : '6a:d4:1b:2e:5c:8f';
      const mfrs = [76]; // Apple Inc. manufacturer ID
      if (!whitelist.has(trackerMac)) {
        packets.push({
          address: trackerMac,
          name: step < 22 ? 'AirTag (Pending)' : 'AirTag (Linked)',
          rssi: -62 + Math.floor(Math.random() * 3), // stable rssi -> stable distance
          tx_power: -59,
          manufacturer_ids: mfrs
        });
      }

      // Packet B: A static smart TV beacon that we drive past (STP Static)
      // Proximity grows larger quickly
      const staticMac = '00:1a:2b:3c:4d:5e';
      if (!whitelist.has(staticMac) && step < 20) {
        // Distance increases linearly with step
        const mockRssi = -55 - (step * 2.5); // signal gets weaker
        packets.push({
          address: staticMac,
          name: 'LG WebOS Smart TV',
          rssi: Math.max(mockRssi, -100),
          tx_power: -59,
          manufacturer_ids: [224]
        });
      }

      // Packet C: User Galaxy Watch (Safe Wearable)
      // Very close, very flat distance, but marked safe by user
      const wearableMac = '5c:83:d2:e1:a9:b0';
      if (!whitelist.has(wearableMac)) {
        packets.push({
          address: wearableMac,
          name: 'Galaxy Watch 6',
          rssi: -42 + Math.floor(Math.random() * 2), // very close and steady
          tx_power: -59,
          manufacturer_ids: [117]
        });
      }

      // Packet D: An active mobile phone in close proximity (RPA Target)
      // Emulating a nearby powered-on smartphone emitting active BLE radio signals
      const phoneMac = '7b:3c:9d:1e:8f:5a';
      if (!whitelist.has(phoneMac)) {
        packets.push({
          address: phoneMac,
          name: 'iPhone (Active Broadcast)',
          rssi: -58 + Math.floor(Math.random() * 4), // close proximity signal strength
          tx_power: -59,
          manufacturer_ids: [76] // Apple Inc.
        });
      }

      // Process mock packets
      if (anomalyEngineRef.current) {
        packets.forEach(packet => {
          if (whitelist.has(packet.address)) return;

          const calculatedMeters = calculateDistance(packet.rssi, packet.tx_power);
          const addressClass = classifyMacAddress(packet.address);

          const refined = {
            address: packet.address,
            name: packet.name,
            rssi: packet.rssi,
            distance: calculatedMeters,
            type: addressClass,
            manufacturerIds: packet.manufacturer_ids
          };
          anomalyEngineRef.current.processTelemetry(refined);
        });

        // Run garbage collection in simulation context to remove lost beacons (like Device B)
        anomalyEngineRef.current.garbageCollectStaleAssets();
        setDevices({ ...anomalyEngineRef.current.deviceRegistry });
      }

    }, 1000);

    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
    };
  }, [simulatorActive, whitelist, wsConnected]);

  // Audio frequency oscillator configuration
  const triggerAudioSiren = () => {
    if (!audioEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      // Resume context if suspended (browser security constraint)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5 note
      osc.frequency.linearRampToValueAtTime(523.25, ctx.currentTime + 0.35); // C5 note
      
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.warn('Audio contextual initialization requires an explicit user gesture handshake.');
    }
  };

  const handleToggleGps = () => {
    unlockAudioContext();

    if (!gpsActive) {
      const active = gpsTrackerRef.current.startTracking();
      if (active) setGpsActive(true);
    } else {
      gpsTrackerRef.current.stopTracking();
      setGpsActive(false);
      if (anomalyEngineRef.current) {
        anomalyEngineRef.current.updateUserMovement({ speed: 0, lat: 0, lon: 0 });
      }
      setCurrentSpeed(0);
    }
  };

  const unlockAudioContext = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    } catch (e) {
      console.error('AudioContext handshake failed:', e);
    }
  };

  const handleToggleSimulator = () => {
    unlockAudioContext();
    setSimulatorActive(prev => !prev);
  };

  const handleToggleAudio = () => {
    unlockAudioContext();
    setAudioEnabled(prev => !prev);
  };

  const handleAddToWhitelist = (address) => {
    setWhitelist((prev) => {
      const updated = new Set(prev);
      updated.add(address);
      return updated;
    });
    if (anomalyEngineRef.current?.deviceRegistry[address]) {
      delete anomalyEngineRef.current.deviceRegistry[address];
      setDevices({ ...anomalyEngineRef.current.deviceRegistry });
    }
  };

  const handleClearWhitelist = () => setWhitelist(new Set());

  return (
    <div className="min-h-screen w-full bg-[#03060d] text-slate-100 p-4 md:p-8 flex flex-col items-center select-none scan-overlay">
      <header className="w-full max-w-6xl mb-6 flex flex-col md:flex-row md:items-center md:justify-between border-b border-teal-950/60 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-2xl animate-pulse">📡</span>
            <h1 className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400 uppercase font-mono">
              BLE PRIVACY RADAR
            </h1>
          </div>
          <p className="text-[10px] text-teal-600 font-mono tracking-widest mt-1 uppercase">
            Active Spatial-Temporal Threat Correlation Engine
          </p>
        </div>
        
        <div className="mt-3 md:mt-0 flex space-x-3 font-mono text-xs">
          <div className="px-3 py-1 bg-teal-950/20 border border-teal-900/40 rounded flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
            <span className="text-teal-400 font-bold uppercase">Transit: {currentSpeed.toFixed(1)} m/s</span>
          </div>
          <div className="px-3 py-1 bg-slate-900/40 border border-slate-800 rounded text-slate-400 font-bold">
            RF Limit: 200m
          </div>
        </div>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 flex flex-col space-y-4">
          <RadarScreen devices={devices} />
        </div>
        
        <div className="lg:col-span-2 flex flex-col space-y-4">
          <AlertFeed alerts={alerts} />
          
          <ControlPanel 
            gpsActive={gpsActive}
            onToggleGps={handleToggleGps}
            onClearFilters={handleClearWhitelist}
            filterCount={whitelist.size}
            wsConnected={wsConnected}
            simulatorActive={simulatorActive}
            onToggleSimulator={handleToggleSimulator}
            audioEnabled={audioEnabled}
            onToggleAudio={handleToggleAudio}
          />

          <DeviceTable 
            devices={devices} 
            onWhitelist={handleAddToWhitelist} 
          />
        </div>
      </main>
    </div>
  );
};

export default App;