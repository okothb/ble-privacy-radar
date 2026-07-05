/**
 * System Geolocation telemetry event listener loop wrapper.
 * Streams vehicle or pedestrian movement pace vectors to the tracking loops.
 */
export class GpsTracker {
  constructor(onMovementUpdate, onError) {
    this.watchId = null;
    this.onMovementUpdate = onMovementUpdate;
    this.onError = onError;
    this.lastPosition = null;
  }

  /**
   * Haversine formula to compute distance in meters between two coordinates.
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Initializes high-accuracy satellite coordinate tracking loops.
   */
  startTracking() {
    if (!('geolocation' in navigator)) {
      console.warn("Geolocation services unsupported by this browser platform sandbox.");
      return false;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        let calculatedSpeed = position.coords.speed;

        // Fallback: Calculate speed manually if GPS speed is null or zero but we have a previous point
        if ((calculatedSpeed === null || calculatedSpeed === 0) && this.lastPosition) {
          const timeDelta = (position.timestamp - this.lastPosition.timestamp) / 1000; // in seconds
          if (timeDelta > 0.5) {
            const dist = this.calculateDistance(
              this.lastPosition.lat,
              this.lastPosition.lon,
              position.coords.latitude,
              position.coords.longitude
            );
            calculatedSpeed = dist / timeDelta;
          }
        }

        const velocityProfile = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          speed: calculatedSpeed || 0, 
          timestamp: position.timestamp
        };
        
        this.lastPosition = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          timestamp: position.timestamp
        };

        // Push coordinate array back up to the Anomaly Engine loop
        this.onMovementUpdate(velocityProfile);
      },
      (error) => {
        console.error("GPS hardware access exception caught:", error.message);
        if (this.onError) this.onError(error);
      },
      {
        enableHighAccuracy: true, // Force raw GPS hardware antenna use instead of cellular mapping
        timeout: 4000,            // Flush loop if position calculations freeze for over 4 seconds
        maximumAge: 0             // Strictly bypass cached tracking history pools
      }
    );

    return true;
  }

  /**
   * Disengages browser position hooks to save hardware battery metrics.
   */
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}