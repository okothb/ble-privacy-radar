import RotationLinker from './RotationLinker.js';

/**
 * AnomalyEngine runs variance filters across a device profile history
 * to cross-reference target tracking changes with your movement states.
 */
class AnomalyEngine {
  constructor(alertCallback) {
    this.deviceRegistry = {};       // Operational target history cache
    this.userMovementState = { speed: 0, lat: 0, lon: 0 };
    this.alertCallback = alertCallback; // Alert system bubble handler
    this.rotationLinker = new RotationLinker();

    // Calibration Configuration Thresholds
    this.SPEED_MINIMUM_MS = 2.0;    // User transit speed trigger (~7.2 km/h or walking/driving pace)
    this.TIMELINE_WINDOW_MS = 300000; // 5-minute tracking tracking frame
    this.VARIANCE_MAX_ALERT = 1.5;   // Relative distance variance threshold for locking a tail
    this.DATA_MIN_THRESHOLD = 8;    // Minimum asset signals required before triggering checks
  }

  updateUserMovement(gpsData) {
    this.userMovementState = gpsData;
  }

  processTelemetry(rawPacket) {
    const now = Date.now();
    let address = rawPacket.address;
    const distance = parseFloat(rawPacket.distance);

    if (isNaN(distance)) return; // Ignore dormant elements lacking active distances

    let record = this.deviceRegistry[address];

    if (!record) {
      const mfrs = rawPacket.manufacturerIds || [];
      // Step 1: Execute active identity check first (instant check)
      let rotationMatch = this.rotationLinker.detectActiveLinkage(address, distance, this.deviceRegistry, mfrs);
      
      // Step 2: Fall back to checking the dead identities cache
      if (!rotationMatch) {
        rotationMatch = this.rotationLinker.detectLinkage(address, distance, mfrs);
      }
      
      if (rotationMatch) {
        // Restore telemetry data metrics across the randomized shift boundary
        this.deviceRegistry[address] = {
          address: address,
          name: rawPacket.name,
          type: rawPacket.type,
          firstSeen: rotationMatch.data.firstSeen,
          lastSeen: now,
          distanceHistory: rotationMatch.data.distanceHistory,
          threatScore: 40,
          alertTriggered: false,
          manufacturerIds: rawPacket.manufacturerIds || []
        };
      } else {
        // Initialize telemetry object structure if it's a completely unique MAC profile
        this.deviceRegistry[address] = {
          address: address,
          name: rawPacket.name,
          type: rawPacket.type,
          firstSeen: now,
          lastSeen: now,
          distanceHistory: [],
          threatScore: 0,
          alertTriggered: false,
          manufacturerIds: rawPacket.manufacturerIds || []
        };
      }
      record = this.deviceRegistry[address];
    }
    record.lastSeen = now;
    record.distanceHistory.push({
      time: now,
      distance: distance,
      userSpeed: this.userMovementState.speed
    });

    // Cleanup data segments extending out of the active 5-minute tracking window
    record.distanceHistory = record.distanceHistory.filter(pt => now - pt.time < this.TIMELINE_WINDOW_MS);

    this.evaluateAnomalyRisk(address, record);
  }

  evaluateAnomalyRisk(address, record) {
    const points = record.distanceHistory;
    if (points.length < this.DATA_MIN_THRESHOLD) return;

    // Filter points captured purely while you are moving in transit
    const activeTransitPoints = points.filter(pt => pt.userSpeed >= this.SPEED_MINIMUM_MS);
    if (activeTransitPoints.length < 5) return;

    // Map calculated raw distance properties
    const distances = activeTransitPoints.map(pt => pt.distance);
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;

    // Calculate statistical variance: measures how much relative distance fluctuates
    const distanceVariance = distances.reduce((sqSum, d) => sqSum + Math.pow(d - avgDistance, 2), 0) / distances.length;

    let calculatedScore = 0;
    const trackingDuration = Date.now() - record.firstSeen;

    // Condition A: Time persistence duration scales severity scores
    if (trackingDuration > 120000) calculatedScore += 20; // Seen for over 2 minutes
    if (trackingDuration > 300000) calculatedScore += 35; // Survived a full 5-minute window

    // Condition B: Anomaly Check. If variance remains extremely flat while you are moving,
    // it confirms that the device is moving in uniform synchronization with your location.
    if (distanceVariance <= this.VARIANCE_MAX_ALERT) {
      calculatedScore += 45; // High alert modifier for uniform physical tailing
    }

    record.threatScore = Math.min(calculatedScore, 100);

    // Fire system alarms if target hits high-risk thresholds
    if (record.threatScore >= 75 && !record.alertTriggered) {
      record.alertTriggered = true;
      this.alertCallback({
        address: address,
        message: `Unknown asset maintaining identical uniform proximity (~${avgDistance.toFixed(1)}m) while you are in transit. Potential surveillance tail verified.`,
        avgDistance: avgDistance
      });
    }
  }

  /**
   * System garbage collector loop. Triggered via interface interval loops 
   * to manage target entries dropping off the RF airwaves.
   */
  garbageCollectStaleAssets() {
    const now = Date.now();
    const TIMEOUT_CLEANUP = 60000; // 60 seconds of complete silence clears active tracking rows

    Object.keys(this.deviceRegistry).forEach(address => {
      const record = this.deviceRegistry[address];
      if (now - record.lastSeen > TIMEOUT_CLEANUP) {
        // Log to our Rotation Linker database cache before deletion 
        // in case it's executing a randomized address scramble mid-route
        this.rotationLinker.logDroppedIdentity(address, record);
        delete this.deviceRegistry[address];
      }
    });
  }
}

export default AnomalyEngine;