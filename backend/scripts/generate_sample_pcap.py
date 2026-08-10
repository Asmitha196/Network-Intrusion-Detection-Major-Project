import os
import sys
from pathlib import Path

# Ensure backend root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scapy.all import Ether, IP, TCP, UDP, DNS, DNSQR, Raw, wrpcap

def generate_sample_pcap():
    project_root = Path(__file__).resolve().parent.parent.parent
    target_dirs = [
        project_root / "data",
        project_root / "data" / "uploads",
        project_root / "backend" / "data" / "uploads",
    ]

    packets = []

    # 1. Normal HTTP Flow (TCP 3-way handshake + GET request + response)
    client_ip = "192.168.1.100"
    server_ip = "192.168.1.1"
    sport = 49152
    dport = 80

    # SYN
    syn = Ether()/IP(src=client_ip, dst=server_ip)/TCP(sport=sport, dport=dport, flags="S", seq=1000)
    # SYN-ACK
    synack = Ether()/IP(src=server_ip, dst=client_ip)/TCP(sport=dport, dport=sport, flags="SA", seq=2000, ack=1001)
    # ACK
    ack = Ether()/IP(src=client_ip, dst=server_ip)/TCP(sport=sport, dport=dport, flags="A", seq=1001, ack=2001)
    # HTTP GET Request
    http_req = Ether()/IP(src=client_ip, dst=server_ip)/TCP(sport=sport, dport=dport, flags="PA", seq=1001, ack=2001)/Raw(load="GET /index.html HTTP/1.1\r\nHost: example.com\r\n\r\n")
    # HTTP Response
    http_resp = Ether()/IP(src=server_ip, dst=client_ip)/TCP(sport=dport, dport=sport, flags="PA", seq=2001, ack=1050)/Raw(load="HTTP/1.1 200 OK\r\nContent-Length: 13\r\n\r\nHello World!!")
    # FIN-ACK
    fin1 = Ether()/IP(src=client_ip, dst=server_ip)/TCP(sport=sport, dport=dport, flags="FA", seq=1050, ack=2064)
    fin2 = Ether()/IP(src=server_ip, dst=client_ip)/TCP(sport=dport, dport=sport, flags="FA", seq=2064, ack=1051)

    packets.extend([syn, synack, ack, http_req, http_resp, fin1, fin2])

    # 2. DNS Query Flow (UDP)
    dns_req = Ether()/IP(src="192.168.1.105", dst="8.8.8.8")/UDP(sport=5353, dport=53)/DNS(rd=1, qd=DNSQR(qname="google.com"))
    packets.append(dns_req)

    # 3. Port Scan Probe (TCP SYN to closed ports)
    for target_port in [21, 22, 23, 445, 3389]:
        scan_pkt = Ether()/IP(src="10.0.0.50", dst="192.168.1.1")/TCP(sport=54321, dport=target_port, flags="S")
        packets.append(scan_pkt)

    print(f"Generated {len(packets)} synthetic packets for PCAP replay testing.")

    for tdir in target_dirs:
        os.makedirs(tdir, exist_ok=True)
        pcap_path = tdir / "sample.pcap"
        wrpcap(str(pcap_path), packets)
        print(f"  Saved PCAP sample -> {pcap_path}")

    print("\nSample PCAP generation complete!")

if __name__ == "__main__":
    generate_sample_pcap()
