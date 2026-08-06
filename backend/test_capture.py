from scapy.all import sniff, conf

print("=== SCAPY NPCAP VERIFICATION ===")
print("\nDiscovered Network Interfaces:")
print(conf.ifaces)

print("\nStarting live packet capture test (capturing 3 packets)...")
try:
    pkts = sniff(count=3, timeout=10)
    print(f"\nSUCCESS! Captured {len(pkts)} packets:")
    for i, p in enumerate(pkts, 1):
        print(f"  Packet #{i}: {p.summary()}")
except Exception as e:
    print(f"\nCapture failed: {e}")