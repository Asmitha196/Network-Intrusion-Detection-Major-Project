import time
from scapy.all import AsyncSniffer, conf
import logging

logging.basicConfig(level=logging.DEBUG)

def cb(pkt):
    print("GOT PKT:", pkt.summary())

print("Testing with conf.L3socket...")
try:
    s = AsyncSniffer(L2socket=conf.L3socket, prn=cb, store=False)
    s.start()
    print("AsyncSniffer running:", s.running)
    print("Thread alive:", getattr(s, 'thread', None) and s.thread.is_alive())
    time.sleep(2)
    print("Thread alive after 2s:", getattr(s, 'thread', None) and s.thread.is_alive())
    if s.running:
        s.stop()
except Exception as e:
    print("Exception:", e)
