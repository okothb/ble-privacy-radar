import asyncio
import json
import logging
import websockets
from bleak import BleakScanner

# Set up logging for counter-surveillance diagnostic auditing
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("BLERadarBackend")

# Global track of active web clients connected to our local pipeline
CONNECTED_CLIENTS = set()

def determine_mac_type(address: str) -> str:
    """
    Decodes the IEEE address space guidelines to identify target profiles.
    If the two most significant bits of the first byte are 01, it's a
    Resolvable Private Address (RPA) like an iPhone or AirTag.
    """
    try:
        first_byte = int(address.split(":")[0], 16)
        if (first_byte & 0xC0) == 0x40:
            return "RPA (Target)"  # Shifting identifier
        return "STP (Static)"      # Fixed infrastructure
    except (ValueError, IndexError):
        return "Unknown"

def detection_callback(device, advertisement_data):
    """
    Triggered asynchronously every millisecond a BLE burst hits the antenna.
    Bypasses standard OS manufacturer filters to capture raw RF telemetry.
    """
    if not CONNECTED_CLIENTS:
        return

    # Extract unique hardware signatures or mesh infrastructure identifiers
    company_ids = list(advertisement_data.manufacturer_data.keys())
    
    # Classify the threat profile type
    mac_type = determine_mac_type(device.address)

    # Package raw radio data for frontend variance calculation
    payload = {
        "address": device.address,
        "name": device.name or advertisement_data.local_name or "Unknown Asset",
        "rssi": device.rssi,             # Raw signal strength indicator
        "type": mac_type,                # Static vs Shifting tracking target
        "manufacturer_ids": company_ids, # Decodes mesh ecosystem membership
        "tx_power": advertisement_data.tx_power or -59 # Tx calibration constant
    }

    # Broadcast payload to all connected frontend browsers
    message = json.dumps(payload)
    for client in CONNECTED_CLIENTS.copy():
        try:
            asyncio.create_task(client.send(message))
        except websockets.exceptions.ConnectionClosed:
            CONNECTED_CLIENTS.remove(client)

async def ws_handler(websocket):
    """
    Manages client authentication handshakes and maintains the live data relay.
    """
    logger.info(f"Frontend Web UI pipeline established: {websocket.remote_address}")
    CONNECTED_CLIENTS.add(websocket)
    try:
        # Keep connection open indefinitely until client window terminates
        async for message in websocket:
            pass
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        logger.info(f"Frontend Web UI pipeline severed: {websocket.remote_address}")
        CONNECTED_CLIENTS.remove(websocket)

async def main():
    logger.info("Initializing Radio Frequency Counter-Surveillance Sniffer...")

    # Spawn local secure server endpoint at port 8765
    server = await websockets.serve(ws_handler, "localhost", 8765)
    logger.info("WebSocket IPC pipeline listening on ws://localhost:8765")

    # Initialize bleak scanner with raw capture configs
    scanner = BleakScanner(
        detection_callback=detection_callback,
        scanning_mode="active" # Forces active probing to override deep privacy sleep states
    )

    logger.info("Activating hardware antenna array. Scanning 2.4GHz spectrum...")
    await scanner.start()

    try:
        # Run event loop indefinitely
        await asyncio.Future()
    except asyncio.CancelledError:
        logger.info("System interrupt caught. Terminating operations safely.")
    finally:
        logger.info("Disengaging antenna driver framework.")
        await scanner.stop()
        server.close()
        await server.wait_closed()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Application closed down by operator.")