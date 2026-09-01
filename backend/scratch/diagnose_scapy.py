import scapy
from scapy.all import conf, get_working_ifaces, sniff, IFACES
import psutil
import socket

print("Scapy version:", scapy.__version__)
print("conf.use_pcap:", getattr(conf, 'use_pcap', None))
print("conf.iface:", conf.iface)

print("\n--- Scapy conf.ifaces ---")
try:
    for k, v in conf.ifaces.items():
        print(f"Key: {repr(k)}")
        print(f"  name: {repr(getattr(v, 'name', None))}")
        print(f"  description: {repr(getattr(v, 'description', None))}")
        print(f"  win_name: {repr(getattr(v, 'win_name', None))}")
        print(f"  pcap_name: {repr(getattr(v, 'pcap_name', None))}")
        print(f"  ip: {repr(getattr(v, 'ip', None))}")
        print(f"  ips: {repr(getattr(v, 'ips', None))}")
        print(f"  mac: {repr(getattr(v, 'mac', None))}")
except Exception as e:
    print("Error listing conf.ifaces:", e)

print("\n--- psutil net_if_addrs ---")
for k, v in psutil.net_if_addrs().items():
    print(f"psutil iface: {repr(k)}")
    for a in v:
        print(f"  addr: {a.address} (family: {a.family})")
