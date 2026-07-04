/**
 * Classifies the IEEE structural layout of an incoming address space.
 * Separates fixed commercial targets from randomized private addresses.
 */
export function classifyMacAddress(address) {
  if (!address || typeof address !== 'string') return 'Unknown';

  try {
    // Isolate the first hexadecimal byte of the hardware string
    const firstByteStr = address.split(':')[0];
    const firstByte = parseInt(firstByteStr, 16);

    if (isNaN(firstByte)) return 'Unknown';

    // BLE Random Address classification via 2 MSBs of the first byte:
    // RPA: 01xxxxxx (binary) -> (firstByte & 0xC0) === 0x40
    const isRpa = (firstByte & 0xC0) === 0x40;

    return isRpa ? 'RPA (Target)' : 'STP (Static)'; // Shifting asset vs static node
  } catch (error) {
    return 'Unknown';
  }
}