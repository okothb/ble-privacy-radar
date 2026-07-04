/**
 * RotationLinker Handles the "Rotation Test" mapping logic.
 * Defeats software-level MAC randomization by clustering targets 
 * that swap identifiers but maintain structural telemetry.
 */
class RotationLinker {
  constructor() {
    this.deadIdentities = new Map(); // Store dropped MAC signatures
    this.ROTATION_WINDOW_MS = 45000;  // 45 seconds tolerance window
    this.DISTANCE_DELTA_TOLERANCE_M = 1.2; // Distance proximity variance tolerance
  }

  /**
   * Logs a device address that has dropped out or stopped emitting.
   */
  logDroppedIdentity(address, finalRecord) {
    if (!finalRecord || finalRecord.type !== 'RPA (Target)' || !finalRecord.distanceHistory?.length) return;
    
    const lastDistance = finalRecord.distanceHistory[finalRecord.distanceHistory.length - 1].distance;
    
    this.deadIdentities.set(address, {
      timestamp: Date.now(),
      lastKnownDistance: parseFloat(lastDistance),
      history: finalRecord.distanceHistory,
      firstSeen: finalRecord.firstSeen,
      manufacturerIds: finalRecord.manufacturerIds || []
    });
  }

  /**
   * Clears old dead signatures to prevent memory leaks.
   */
  flushExpiredIdentities() {
    const now = Date.now();
    for (const [address, record] of this.deadIdentities.entries()) {
      if (now - record.timestamp > this.ROTATION_WINDOW_MS) {
        this.deadIdentities.delete(address);
      }
    }
  }

  /**
   * Scans active registry entries to see if a device rotated its MAC address.
   * Matches if the old device became silent recently and its last known distance 
   * is within range of the new device.
   */
  detectActiveLinkage(newAddress, currentDistance, deviceRegistry, newMfrIds = []) {
    const targetDistance = parseFloat(currentDistance);
    if (isNaN(targetDistance)) return null;

    const now = Date.now();
    const MIN_SILENCE_MS = 500; // Time needed to differentiate between concurrent devices
    const MAX_SILENCE_MS = this.ROTATION_WINDOW_MS;

    for (const [oldAddress, record] of Object.entries(deviceRegistry)) {
      if (oldAddress === newAddress) continue;
      if (record.type !== 'RPA (Target)') continue;

      // Filter by manufacturer ID match if both devices have defined manufacturer data
      const oldMfrs = record.manufacturerIds || [];
      const hasDifferentMfrs = oldMfrs.length > 0 && newMfrIds.length > 0 &&
        (oldMfrs.length !== newMfrIds.length || !oldMfrs.every(id => newMfrIds.includes(id)));
      if (hasDifferentMfrs) continue;

      const silenceDuration = now - record.lastSeen;
      if (silenceDuration >= MIN_SILENCE_MS && silenceDuration <= MAX_SILENCE_MS) {
        if (!record.distanceHistory || record.distanceHistory.length === 0) continue;
        const lastKnownDistance = record.distanceHistory[record.distanceHistory.length - 1].distance;
        const distanceDelta = Math.abs(lastKnownDistance - targetDistance);

        if (distanceDelta <= this.DISTANCE_DELTA_TOLERANCE_M) {
          const structuralData = {
            firstSeen: record.firstSeen,
            distanceHistory: [...record.distanceHistory]
          };

          // Remove linked signature from active registry since it rotated
          delete deviceRegistry[oldAddress];
          return { linkedFrom: oldAddress, data: structuralData };
        }
      }
    }

    return null;
  }

  /**
   * Tests a new incoming asset to see if it's a rotated identity of a recent target.
   */
  detectLinkage(newAddress, currentDistance, newMfrIds = []) {
    this.flushExpiredIdentities();
    const targetDistance = parseFloat(currentDistance);
    
    if (isNaN(targetDistance)) return null;

    for (const [oldAddress, deadRecord] of this.deadIdentities.entries()) {
      // Filter by manufacturer ID match if both devices have defined manufacturer data
      const oldMfrs = deadRecord.manufacturerIds || [];
      const hasDifferentMfrs = oldMfrs.length > 0 && newMfrIds.length > 0 &&
        (oldMfrs.length !== newMfrIds.length || !oldMfrs.every(id => newMfrIds.includes(id)));
      if (hasDifferentMfrs) continue;

      const distanceDelta = Math.abs(deadRecord.lastKnownDistance - targetDistance);

      // Correlation Check: If the distance variance falls within our precise tolerance bounds
      if (distanceDelta <= this.DISTANCE_DELTA_TOLERANCE_M) {
        const structuralData = {
          firstSeen: deadRecord.firstSeen,
          distanceHistory: [...deadRecord.history]
        };
        
        // Remove linked signature from the dead buffer
        this.deadIdentities.delete(oldAddress);
        return { linkedFrom: oldAddress, data: structuralData };
      }
    }

    return null; // Unique asset signature confirmed
  }
}

export default RotationLinker;