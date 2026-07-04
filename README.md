# BLE Privacy Radar & Anomaly Engine

An open-source, hybrid counter-surveillance web application designed to detect and expose physical tracking vectors (such as unauthorized Apple AirTags, Tile trackers, or stalker smartphones) utilizing Bluetooth Low Energy (BLE) emissions. 

By correlating raw RF telemetry data with the user's live physical motion, this application bypasses OS-level MAC address randomization via the "Rotation Test" to confirm if an unknown device is actively tailing you.

---

## 🛠️ System Architecture

Standard web browsers cannot access raw, unfiltered Bluetooth hardware airwaves due to security sandboxing. To bypass this, this system utilizes a **Hybrid Architecture**:

1. **Native Local Backend (Python):** Intercepts raw 2.4 GHz BLE advertisement bursts directly from the network stack (using `bleak`) and pipes them over a real-time local WebSocket connection.
2. **PWA Frontend Web App (Vite/React):** Processes the incoming telemetry stream, calculates distance matrix decay via Log-Distance Path Loss, tracks high-accuracy GPS movement vectors, and triggers system alarms if spatial-temporal anomalies are verified.

---

## 📋 Directory Layout

```text
ble-privacy-radar/
├── backend/                        # Raw Hardware Sniffer (Python)
│   ├── main.py                     # BLE scanner & WebSocket server core
│   └── requirements.txt            # Host machine Python dependencies
│
├── frontend/                       # Web Dashboard Interface (PWA React App)
│   ├── public/
│   │   └── manifest.json           # Progressive Web App configuration
│   ├── src/
│   │   ├── components/
│   │   │   ├── RadarScreen.jsx     # HTML5 Visual canvas tracing spatial nodes
│   │   │   ├── AlertFeed.jsx       # Real-time list of threat alerts
│   │   │   ├── DeviceTable.jsx     # Filtered matrix of ambient targets
│   │   │   └── ControlPanel.jsx    # System settings, permissions, and filters
│   │   ├── core/
│   │   │   ├── AnomalyEngine.js    # Variance calculation & motion tracking loops
│   │   │   └── RotationLinker.js   # Bypasses 15-min RPA transitions via distance delta
│   │   ├── utils/
│   │   │   ├── distance.js         # Path loss formulas (RSSI -> Meters)
│   │   │   ├── macClassifier.js    # Decodes RPA vs STP address structures
│   │   │   └── gpsTracker.js       # Native Geolocation API stream wrapper
│   │   ├── App.jsx                 # App controller & WebSocket connection manager
│   │   └── index.css               # Animations & dark-mode styling
│   └── vite.config.js              # Bundler and local proxy configurations
└── README.md