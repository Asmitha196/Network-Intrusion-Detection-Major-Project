import sys
import os
import json
import urllib.request
import urllib.error

def test_threat_intel_validation():
    print("=" * 70)
    print("VERIFYING THREAT INTELLIGENCE IP VALIDATION (BACKEND & FRONTEND LOGIC)")
    print("=" * 70)

    base_url = "http://127.0.0.1:8000/threat-intel/lookup"

    invalid_ips = [
        "5",
        "123",
        "hello",
        "999.999.999.999",
        "192.168.1",
        "192.168.1.999",
    ]

    valid_ips = [
        "8.8.8.8",
        "185.220.101.5",
        "192.168.1.10",
        "2001:db8::1",
    ]

    print("\n[1] Testing Invalid IP Inputs (Expecting HTTP 400 Bad Request)...")
    for bad_ip in invalid_ips:
        url = f"{base_url}/{bad_ip}"
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req) as resp:
                status_code = resp.getcode()
                print(f"  -> Input: '{bad_ip}' => Unexpected 200 OK")
                assert False, f"Expected 400 for '{bad_ip}', got {status_code}"
        except urllib.error.HTTPError as err:
            print(f"  -> Input: '{bad_ip}' => Status Code: {err.code}")
            assert err.code == 400, f"Expected 400 for '{bad_ip}', got {err.code}"
            body = json.loads(err.read().decode())
            assert "Invalid IP address" in body["detail"]
            print(f"     Detail: {body['detail']}")

    print("\n[2] Testing Valid IPv4 & IPv6 Inputs (Expecting HTTP 200 OK)...")
    for good_ip in valid_ips:
        url = f"{base_url}/{good_ip}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            assert resp.getcode() == 200, f"Expected 200 for '{good_ip}', got {resp.getcode()}"
            data = json.loads(resp.read().decode())
            assert "ip" in data
            print(f"  -> Input: '{good_ip}' => Status Code: 200 OK (Resolved IP: {data['ip']}, Country: {data.get('country')})")

    print("\n=" * 70)
    print("THREAT INTELLIGENCE IP VALIDATION VERIFICATION SUCCESSFUL!")
    print("=" * 70)

if __name__ == "__main__":
    test_threat_intel_validation()
