"""
update_pip.py

Discovers every Python installation on the system and upgrades pip in each one.

Discovery searches (in order):
  1. `py --list-paths` (Python Launcher for Windows)
  2. Common install directories (Program Files, AppData, Anaconda, etc.)
  3. PATH entries

Run:       python update_pip.py
Dry-run:   python update_pip.py --dry-run
"""

import os
import subprocess
import sys
import argparse
import glob as globmod

SEARCH_ROOTS = [
    r"C:\Python*",
    r"C:\Program Files\Python*",
    r"C:\Program Files (x86)\Python*",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\Python\Python*"),
    os.path.expandvars(r"%APPDATA%\Python\Python*"),
    r"C:\Anaconda*",
    r"C:\ProgramData\Anaconda*",
    r"C:\Miniconda*",
    os.path.expandvars(r"%USERPROFILE%\Anaconda*"),
    os.path.expandvars(r"%USERPROFILE%\Miniconda*"),
    os.path.expandvars(r"%USERPROFILE%\AppData\Local\conda\conda\envs"),
]


def find_via_py_launcher() -> list[str]:
    exes = []
    try:
        out = subprocess.run(
            ["py", "--list-paths"], capture_output=True, text=True, timeout=10
        )
        for line in out.stdout.splitlines():
            parts = line.strip().split()
            if len(parts) >= 2:
                candidate = parts[-1]
                if candidate.lower().endswith("python.exe") and os.path.isfile(candidate):
                    exes.append(os.path.normpath(candidate))
    except Exception:
        pass
    return exes


def find_via_glob() -> list[str]:
    exes = []
    for pattern in SEARCH_ROOTS:
        for folder in globmod.glob(pattern):
            candidate = os.path.join(folder, "python.exe")
            if os.path.isfile(candidate):
                exes.append(os.path.normpath(candidate))
    return exes


def find_via_path() -> list[str]:
    exes = []
    seen_dirs: set[str] = set()
    for entry in os.environ.get("PATH", "").split(os.pathsep):
        entry = os.path.normpath(entry)
        if entry in seen_dirs:
            continue
        seen_dirs.add(entry)
        candidate = os.path.join(entry, "python.exe")
        if os.path.isfile(candidate):
            exes.append(candidate)
    return exes


def is_real_python(exe: str) -> bool:
    if "WindowsApps" in exe:
        return False
    try:
        out = subprocess.run(
            [exe, "-m", "pip", "--version"],
            capture_output=True, text=True, timeout=10
        )
        return out.returncode == 0
    except Exception:
        return False


def get_version(exe: str) -> str:
    out = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=10)
    return out.stdout.strip() or out.stderr.strip()


def discover_pythons() -> list[str]:
    candidates: list[str] = []
    candidates += find_via_py_launcher()
    candidates += find_via_glob()
    candidates += find_via_path()

    seen: set[str] = set()
    unique: list[str] = []
    for exe in candidates:
        key = os.path.normcase(os.path.realpath(exe))
        if key not in seen:
            seen.add(key)
            unique.append(exe)

    print("Scanning for Python installations...")
    valid: list[str] = []
    for exe in unique:
        ver = get_version(exe) if is_real_python(exe) else None
        status = f"  OK  — {ver}" if ver else "  SKIP (no pip / stub)"
        print(f"  {exe}\n        {status}")
        if ver:
            valid.append(exe)

    return valid


def run(cmd: list[str], dry: bool = False) -> None:
    print(f"    {'[DRY] ' if dry else ''}> {' '.join(cmd)}")
    if dry:
        return
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stdout.strip():
        for line in result.stdout.strip().splitlines():
            print(f"    {line}")
    if result.returncode != 0 and result.stderr.strip():
        print(f"    WARNING: {result.stderr.strip()}")


def upgrade_pip(exe: str, dry: bool) -> None:
    version = get_version(exe)
    print(f"\n{'='*60}")
    print(f"  {version}")
    print(f"  {exe}")
    print(f"{'='*60}")
    run([exe, "-m", "pip", "install", "--upgrade", "pip"], dry)


def main():
    parser = argparse.ArgumentParser(
        description="Upgrade pip in every Python installation on the system."
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would happen without making changes.")
    args = parser.parse_args()

    if args.dry_run:
        print("=== DRY RUN — no changes will be made ===\n")

    pythons = discover_pythons()

    if not pythons:
        print("\nNo Python installations found.")
        sys.exit(1)

    print(f"\nFound {len(pythons)} installation(s). Upgrading pip...\n")

    for exe in pythons:
        try:
            upgrade_pip(exe, args.dry_run)
        except Exception as e:
            print(f"  ERROR: {e}")

    print(f"\n{'='*60}")
    print("All done.")


if __name__ == "__main__":
    main()
