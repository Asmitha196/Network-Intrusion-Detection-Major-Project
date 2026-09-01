import sys
import os
sys.path.insert(0, os.path.abspath("backend"))
sys.path.insert(0, os.path.abspath("."))

import time
import threading
import requests
from scapy.all import AsyncSniffer, conf
from ingestion.capture import resolve_scapy_interface

print("conf.use_pcap:", conf.use_pcap)
iface = resolve_scapy_interface("Wi-Fi")
print("Resolved Wi-Fi interface:", getattr(iface, 'name', iface), "| Description:", getattr(iface, 'description', ''))

packets_captured = []

def callback(pkt):
    packets_captured.append(pkt)
    if len(packets_captured) <= 5:
        print(f"  [Packet #{len(packets_captured)}] {pkt.summary()}")

sniffer = AsyncSniffer(iface=iface, prn=callback, store=False, filter="ip or ip6")
print("Starting AsyncSniffer on Wi-Fi...")
sniffer.start()

print("Making a web request to generate real network traffic...")
def make_traffic():
    time.sleep(0.5)
    try:
        r = requests.get("https://1.1.1.1", timeout=3, verify=False)
        print("HTTP request finished with status:", r.status_code)
    except Exception as e:
        print("Traffic request note:", e)

t = threading.Thread(target=make_traffic)
t.start()

time.sleep(3.0)
sniffer.stop()
t.join()

print(f"\nSUCCESS! Total real packets captured on Wi-Fi: {len(packets_captured)}")
