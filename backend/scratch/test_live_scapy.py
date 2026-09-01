import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time
import urllib.request
import threading
from scapy.all import AsyncSniffer, conf, get_working_ifaces
from ingestion.capture import resolve_scapy_interface, enumerate_interfaces

print("=== ENUMERATE INTERFACES ===")
ifaces = enumerate_interfaces()
for iface in ifaces:
    print(f"Name: {iface['name']} | IP: {iface['ip_address']} | Status: {iface['status']} | Desc: {iface['description']}")

print("\n=== RESOLVE SCAPY INTERFACE ===")
resolved = resolve_scapy_interface("Wi-Fi")
print("Resolved 'Wi-Fi' ->", repr(resolved))

pkts_captured = []
def pkt_cb(p):
    pkts_captured.append(p)

print("\n=== TESTING ASYNCSNIFFER CAPTURE ON 'Wi-Fi' (5 seconds) ===")
sniffer = AsyncSniffer(
    iface=resolved,
    prn=pkt_cb,
    store=False,
    filter="ip or ip6",
)
sniffer.start()
print("Sniffer started. Thread alive:", getattr(sniffer, 'thread', None) and sniffer.thread.is_alive())

def make_web_request():
    try:
        urllib.request.urlopen("https://www.google.com", timeout=3)
        print("Web request succeeded")
    except Exception as e:
        print("Web request note:", e)

t = threading.Thread(target=make_web_request)
t.start()
t.join()

time.sleep(3)

print("Sniffer still alive:", getattr(sniffer, 'thread', None) and sniffer.thread.is_alive())
sniffer.stop()
print(f"Total REAL Packets captured on Wi-Fi: {len(pkts_captured)}")
if pkts_captured:
    print("Sample packet summary:", pkts_captured[0].summary())
