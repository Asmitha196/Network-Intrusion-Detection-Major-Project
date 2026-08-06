import sys
import time
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("scapy_test")

print("=== SCAPY / NPCAP DIAGNOSTIC TEST ===")
print("Python Version:", sys.version)

try:
    from scapy.all import conf, get_working_ifaces, AsyncSniffer, sniff, IP
    print("Scapy imported successfully.")
except Exception as e:
    print("ERROR importing Scapy:", e)
    sys.exit(1)

print("\n--- Inspecting conf.ifaces ---")
try:
    print(conf.ifaces)
    for dev_id, dev in conf.ifaces.items():
        win_name = getattr(dev, 'win_name', 'N/A')
        desc = getattr(dev, 'description', 'N/A')
        name = getattr(dev, 'name', 'N/A')
        ip = getattr(dev, 'ip', 'N/A')
        print(f"ID: {dev_id} | Name: {name} | WinName: {win_name} | IP: {ip} | Desc: {desc}")
except Exception as e:
    print("Error listing conf.ifaces:", e)

print("\n--- Testing get_working_ifaces() ---")
t0 = time.time()
try:
    ifaces = get_working_ifaces()
    dt = time.time() - t0
    print(f"get_working_ifaces() completed in {dt:.3f}s. Discovered {len(ifaces)} working interfaces.")
    for iface in ifaces:
        print("  Working iface:", iface.name, "|", getattr(iface, 'description', ''))
except Exception as e:
    dt = time.time() - t0
    print(f"get_working_ifaces() failed after {dt:.3f}s:", e)

print("\n--- Testing minimal packet capture (5 seconds) ---")
pkt_count = 0

def pkt_callback(pkt):
    global pkt_count
    pkt_count += 1
    if pkt_count <= 3:
        print(f"Captured Packet #{pkt_count}: {pkt.summary()}")

try:
    # Attempt AsyncSniffer on default interface
    print("Starting AsyncSniffer on default interface (conf.iface)...", conf.iface)
    sniffer = AsyncSniffer(prn=pkt_callback, store=False)
    sniffer.start()
    print("Sniffer started. Waiting 3 seconds...")
    time.sleep(3)
    sniffer.stop()
    print(f"Sniffer stopped. Total packets captured: {pkt_count}")
except Exception as e:
    print("AsyncSniffer test failed:", e)

print("=== DIAGNOSTIC COMPLETE ===")
