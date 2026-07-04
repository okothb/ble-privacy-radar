import AnomalyEngine from './src/core/AnomalyEngine.js';
import { calculateDistance } from './src/utils/distance.js';
import { classifyMacAddress } from './src/utils/macClassifier.js';

console.log("Starting AnomalyEngine simulation test...");

const alerts = [];
const anomalyEngine = new AnomalyEngine((newAlert) => {
  console.log("🚨 ALERT TRIGGERED:", newAlert);
  alerts.push(newAlert);
});

// Setup whitelist (empty)
const whitelist = new Set();

// Simulate 350 steps (each step represents 1 second)
for (let step = 0; step < 350; step++) {
  // 1. Simulate user speed acceleration profile
  let userSpeed = 0.5; // Walking pace (m/s)
  if (step > 5 && step <= 15) {
    userSpeed = 0.5 + (step - 5) * 0.6; // Accelerating to ~6.5 m/s (transit speed)
  } else if (step > 15 && step < 40) {
    userSpeed = 6.5 + Math.sin(step) * 0.3; // Normal cruising speed
  } else if (step >= 40) {
    userSpeed = 6.8;
  }

  // Update user movement
  anomalyEngine.updateUserMovement({
    lat: 37.7749 + (step * 0.0001),
    lon: -122.4194 + (step * 0.0001),
    speed: userSpeed,
    timestamp: Date.now() + step * 1000
  });

  // Generate simulated BLE packets
  const packets = [];

  // Packet A: The AirTag Tracker (RPA Target) that moves with us
  // Distance remains flat (~5.2m), causing threat score to spike under transit speed
  // Rotates MAC at step 22
  const trackerMac = step < 22 ? '4b:2a:8f:9c:71:0d' : '6a:d4:1b:2e:5c:8f';
  const mfrs = [76]; // Apple Inc. manufacturer ID
  
  // To test the exact time difference, we mock the Date.now() in the engine if needed,
  // but since we are running in a loop in milliseconds, let's override Date.now
  // to return simulated time.
  const simTime = Date.now() + step * 1000;
  
  packets.push({
    address: trackerMac,
    name: step < 22 ? 'AirTag (Pending)' : 'AirTag (Linked)',
    rssi: -62, // stable RSSI -> stable distance
    tx_power: -59,
    manufacturer_ids: mfrs,
    time: simTime
  });

  // Process packets
  packets.forEach(packet => {
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

    // Temporarily override Date.now during processing to use simulated time
    const realDateNow = Date.now;
    Date.now = () => simTime;
    
    anomalyEngine.processTelemetry(refined);
    
    Date.now = realDateNow;
  });

  // Print state at step 21, 22, 44, 130, 310
  if (step === 21 || step === 22 || step === 44 || step === 130 || step === 310) {
    console.log(`\n--- Step ${step} ---`);
    console.log("Current Speed:", userSpeed.toFixed(2), "m/s");
    console.log("Active Registry Devices:");
    Object.entries(anomalyEngine.deviceRegistry).forEach(([addr, dev]) => {
      console.log(` - MAC: ${addr}, Name: ${dev.name}, FirstSeenOffset: ${((simTime - dev.firstSeen)/1000).toFixed(0)}s, Threat: ${dev.threatScore}, Alerted: ${dev.alertTriggered}`);
    });
  }
}

console.log("\nSimulation test complete.");
console.log("Total Alerts Triggered:", alerts.length);
if (alerts.length > 0) {
  console.log("Alert messages:", alerts.map(a => a.message));
} else {
  console.log("❌ ERROR: Expected alert was NOT triggered!");
}
