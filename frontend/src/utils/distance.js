/**
 * Log-Distance Path Loss model calculator.
 * Estimates proximity distance in meters from raw radio signal attenuation.
 */
export function calculateDistance(rssi, txPower = -59) {
  const rawRssi = parseInt(rssi, 10);
  if (isNaN(rawRssi) || rawRssi === 0) return 'N/A';

  // Environmental path loss exponent (n)
  // 2.0 = Free space path, 2.5 - 3.0 = Obstructed indoor/suburban vehicle tracking perimeters
  const n = 2.7; 

  // Path Loss Formula: Distance = 10^((Measured Power at 1m - Current RSSI) / (10 * n))
  const distanceMeters = Math.pow(10, (txPower - rawRssi) / (10 * n));

  // Round off variance cleanly to two decimal places
  return parseFloat(distanceMeters.toFixed(2));
}