import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time
import random
import threading
from scapy.layers.inet import IP, TCP, UDP
from feature_extraction.flow_builder import FlowBuilder

def make_dummy_pkt(src_ip, dst_ip, sport, dport, proto_cls, payload_str="test"):
    p = IP(src=src_ip, dst=dst_ip) / proto_cls(sport=sport, dport=dport) / payload_str
    return p

def test_concurrency():
    print("=== STARTING FLOWBUILDER CONCURRENCY STRESS TEST ===")
    builder = FlowBuilder()
    stop_flag = threading.Event()
    errors = []
    flushed_total = [0]
    
    # Harvest thread simulating _harvest_loop
    def harvest_worker():
        while not stop_flag.is_set():
            try:
                flows = builder.flush_expired_flows(force_all=False)
                flushed_total[0] += len(flows)
                time.sleep(0.01)
            except Exception as e:
                errors.append(f"Harvest error: {e}")
                print(f"HARVEST EXCEPTION: {e}")

    # 4 concurrent packet feeder threads simulating heavy AsyncSniffer traffic
    def packet_feeder(thread_id):
        for i in range(1000):
            src_ip = f"192.168.1.{random.randint(1, 50)}"
            dst_ip = f"10.0.0.{random.randint(1, 50)}"
            sport = random.randint(1024, 65535)
            dport = 80 if i % 2 == 0 else 443
            proto_cls = TCP if i % 2 == 0 else UDP
            
            pkt = make_dummy_pkt(src_ip, dst_ip, sport, dport, proto_cls)
            try:
                builder.add_packet(pkt)
            except Exception as e:
                errors.append(f"Add packet error: {e}")
                print(f"ADD PACKET EXCEPTION: {e}")
            if i % 100 == 0:
                time.sleep(0.005)

    harvest_t = threading.Thread(target=harvest_worker)
    feeders = [threading.Thread(target=packet_feeder, args=(i,)) for i in range(4)]

    harvest_t.start()
    for f in feeders:
        f.start()

    for f in feeders:
        f.join()

    print("All packet feeder threads completed 4,000 packets.")
    time.sleep(0.1)
    stop_flag.set()
    harvest_t.join()

    # Final flush
    final_flows = builder.flush_expired_flows(force_all=True)
    flushed_total[0] += len(final_flows)

    print(f"Total flows flushed: {flushed_total[0]}")
    print(f"Total errors encountered: {len(errors)}")
    if errors:
        for err in errors[:5]:
            print(" - Error:", err)
        assert len(errors) == 0, "Concurrency errors detected!"
    else:
        print("SUCCESS: 0 concurrency errors! Dictionary changed size during iteration is completely resolved.")

if __name__ == "__main__":
    test_concurrency()
