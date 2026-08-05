import os
import shutil

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

files_to_remove = [
    os.path.join(root, "docker-compose.yml"),
    os.path.join(root, ".dockerignore"),
]

dirs_to_remove = [
    os.path.join(root, "docker"),
]

for f in files_to_remove:
    if os.path.exists(f):
        try:
            os.remove(f)
            print(f"Removed file: {f}")
        except Exception as e:
            print(f"Error removing {f}: {e}")

for d in dirs_to_remove:
    if os.path.exists(d):
        try:
            shutil.rmtree(d)
            print(f"Removed directory: {d}")
        except Exception as e:
            print(f"Error removing {d}: {e}")
