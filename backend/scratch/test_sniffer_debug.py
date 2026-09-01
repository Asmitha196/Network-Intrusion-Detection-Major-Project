import time
import sys
from scapy.all import AsyncSniffer, conf
import logging

logging.basicConfig(level=logging.DEBUG)

def cb(pkt):
    print("GOT PKT:", pkt.summary())

print("conf.use_pcap:", conf.use_pcap)
print("conf.iface:", conf.iface)
print("conf.ifaces:", list(conf.ifaces.keys()))

try:
    print("Initializing AsyncSniffer...")
    s = AsyncSniffer(prn=cb, store=False)
    print("Starting AsyncSniffer...")
    s.start()
    print("AsyncSniffer running:", s.running)
    print("AsyncSniffer thread alive:", getattr(s, 'thread', None) and s.thread.is_alive())
    print("Waiting 3s...")
    time.sleep(3)
    print("AsyncSniffer running after 3s:", s.running)
    print("AsyncSniffer thread alive after 3s:", getattr(s, 'thread', None) and s.thread.is_alive())
    if s.running:
        s.stop()
        print("AsyncSniffer stopped")
except Exception as e:
    print("Sniffer exception:", e)
