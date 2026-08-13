import redis

print("--- TESTING REDIS DIRECT CONNECT WITH 127.0.0.1 ---")
try:
    r = redis.Redis(host='127.0.0.1', port=6379, socket_timeout=2)
    pong = r.ping()
    print("[PASS] 127.0.0.1 Ping:", pong)
except Exception as e:
    print("[FAIL] 127.0.0.1 error:", e)

print("--- TESTING REDIS DIRECT CONNECT WITH localhost ---")
try:
    r2 = redis.Redis(host='localhost', port=6379, socket_timeout=2)
    pong2 = r2.ping()
    print("[PASS] localhost Ping:", pong2)
except Exception as e:
    print("[FAIL] localhost error:", e)
