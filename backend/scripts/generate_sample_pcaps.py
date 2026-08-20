"""
scripts/generate_sample_pcaps.py — Script to generate realistic sample PCAP files for NIDS testing.
"""
import os
import sys
from pathlib import Path

# Add backend root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scapy.all import wrpcap, Ether, IP, TCP, UDP, DNS, DNSQR, Raw

def create_sample_pcaps():
    output_dir = Path("../data")
    output_dir.mkdir(parents=True, exist_ok=True)

    pkts_normal = []
    
    # 1. Normal HTTP traffic (GET /index.html)
    pkts_normal.append(Ether()/IP(src="192.168.1.105", dst="172.217.14.206")/TCP(sport=49152, dport=80, flags="S"))
    pkts_normal.append(Ether()/IP(src="172.217.14.206", dst="192.168.1.105")/TCP(sport=80, dport=49152, flags="SA"))
    pkts_normal.append(Ether()/IP(src="192.168.1.105", dst="172.217.14.206")/TCP(sport=49152, dport=80, flags="A"))
    pkts_normal.append(Ether()/IP(src="192.168.1.105", dst="172.217.14.206")/TCP(sport=49152, dport=80, flags="PA")/Raw(load=b"GET /index.html HTTP/1.1\r\nHost: google.com\r\nUser-Agent: Mozilla/5.0\r\n\r\n"))
    pkts_normal.append(Ether()/IP(src="172.217.14.206", dst="192.168.1.105")/TCP(sport=80, dport=49152, flags="PA")/Raw(load=b"HTTP/1.1 200 OK\r\nContent-Length: 13\r\n\r\nHello World!!"))

    # 2. DNS Query / Response
    pkts_normal.append(Ether()/IP(src="192.168.1.105", dst="8.8.8.8")/UDP(sport=53531, dport=53)/DNS(rd=1, qd=DNSQR(qname="api.github.com")))
    pkts_normal.append(Ether()/IP(src="8.8.8.8", dst="192.168.1.105")/UDP(sport=53, dport=53531)/DNS(qr=1, rd=1, ra=1, qd=DNSQR(qname="api.github.com")))

    # 3. Port Scan attack packets
    pkts_portscan = []
    attacker_ip = "10.0.0.88"
    target_ip = "192.168.1.1"
    for port in [21, 22, 23, 25, 53, 80, 110, 139, 443, 445, 1433, 3306, 3389, 5432, 8080]:
        pkts_portscan.append(Ether()/IP(src=attacker_ip, dst=target_ip)/TCP(sport=55000+port, dport=port, flags="S"))
        pkts_portscan.append(Ether()/IP(src=target_ip, dst=attacker_ip)/TCP(sport=port, dport=55000+port, flags="R"))

    # 4. SYN Flood / DDoS packets
    pkts_ddos = []
    target_web = "192.168.1.10"
    for i in range(100):
        fake_src = f"172.16.10.{i % 250 + 1}"
        pkts_ddos.append(Ether()/IP(src=fake_src, dst=target_web)/TCP(sport=10000+i, dport=80, flags="S"))

    # Combined full capture
    pkts_combined = pkts_normal + pkts_portscan + pkts_ddos

    # Write files
    p1 = output_dir / "sample.pcap"
    p2 = output_dir / "sample_network_traffic.pcap"
    p3 = output_dir / "sample_portscan_attack.pcap"
    p4 = output_dir / "sample_ddos_attack.pcap"

    wrpcap(str(p1), pkts_combined)
    wrpcap(str(p2), pkts_normal)
    wrpcap(str(p3), pkts_portscan)
    wrpcap(str(p4), pkts_ddos)

    print(f"Generated {p1} ({len(pkts_combined)} packets)")
    print(f"Generated {p2} ({len(pkts_normal)} packets)")
    print(f"Generated {p3} ({len(pkts_portscan)} packets)")
    print(f"Generated {p4} ({len(pkts_ddos)} packets)")

if __name__ == "__main__":
    create_sample_pcaps()
