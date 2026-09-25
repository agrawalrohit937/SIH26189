import os
import sys
import subprocess

# Determine path to backend/scripts/reset_demo.py
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_script = os.path.join(root_dir, "backend", "scripts", "reset_demo.py")
python_exe = os.path.join(root_dir, "backend", "venv", "Scripts", "python.exe")

if not os.path.exists(python_exe):
    python_exe = sys.executable

cmd = [python_exe, backend_script]
sys.exit(subprocess.call(cmd))
