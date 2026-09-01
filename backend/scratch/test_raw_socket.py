import socket
import sys
import time
from scapy.layers.inet import IP

def test_raw_socket(host_ip):
    print(f"Testing raw socket on {host_ip}...")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_IP)
        s.bind((host_ip, 0))
        s.setsockopt(socket.IPPROTO_IP, socket.IP_HDRINCL, 1)
        if hasattr(socket, "SIO_RCVALL"):
            s.ioctl(socket.SIO_RCVALL, socket.RCVALL_ON)
            print("SIO_RCVALL enabled successfully!")
        
        s.settimeout(3.0)
        print("Listening for 3 seconds...")
        start = time.time()
        pkt_count = 0
        while time.time() - start < 3.0:
            try:
                data, addr = s.recvfrom(65535)
                pkt = IP(data)
                pkt_count += 1
                if pkt_count <= 5:
                    print(f"  [Packet {pkt_count}] {pkt.src} -> {pkt.dst} (len: {len(data)}, proto: {pkt.proto})")
            except socket.timeout:
                break
        
        if hasattr(socket, "SIO_RCVALL"):
            try:
                s.ioctl(socket.SIO_RCVALL, socket.RCVALL_OFF)
            except Exception:
                pass
        s.close()
        print(f"Total raw packets captured: {pkt_count}")
        return True, pkt_count
    except Exception as e:
        print(f"Raw socket error on {host_ip}: {e}")
        return False, str(e)

if __name__ == "__main__":
    test_raw_socket("10.10.10.73")
    test_raw_socket("127.0.0.1")
