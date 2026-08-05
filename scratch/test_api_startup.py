import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

print("=== FASTAPI API STARTUP TEST ===")
try:
    from api.main import app
    print("FastAPI app imported successfully!")
    print("Routes registered:", len(app.routes))
    for r in app.routes:
        print("  Route:", getattr(r, 'path', r))
except Exception as e:
    print("FastAPI app startup failed:", e)
    import traceback
    traceback.print_exc()

print("=== FASTAPI TEST COMPLETE ===")
