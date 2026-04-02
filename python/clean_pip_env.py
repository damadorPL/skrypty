"""
clean_pip_env.py

Discovers every Python installation on the system, then for each one:
  - Upgrades pip to the latest version
  - Uninstalls every package except pip, setuptools, and wheel

Discovery searches (in order):
  1. `py --list` (Python Launcher for Windows)
  2. Common install directories (Program Files, AppData, Anaconda, etc.)
  3. PATH entries

Run:       python clean_pip_env.py
Dry-run:   python clean_pip_env.py --dry-run
"""

import os
import subprocess
import sys
import argparse
import glob as globmod
from pathlib import Path

PROTECTED = {"pip", "setuptools", "wheel"}

# Candidate root directories to scan for python.exe
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
    """Use `py --list-paths` to get all installs registered with the launcher."""
    exes = []
    try:
        out = subprocess.run(
            ["py", "--list-paths"], capture_output=True, text=True, timeout=10
        )
        for line in out.stdout.splitlines():
            # lines look like:  -3.12-64    C:\...\python.exe
            parts = line.strip().split()
            if len(parts) >= 2:
                candidate = parts[-1]
                if candidate.lower().endswith("python.exe") and os.path.isfile(candidate):
                    exes.append(os.path.normpath(candidate))
    except Exception:
        pass
    return exes


def find_via_glob() -> list[str]:
    """Scan common install directories for python.exe."""
    exes = []
    for pattern in SEARCH_ROOTS:
        for folder in globmod.glob(pattern):
            candidate = os.path.join(folder, "python.exe")
            if os.path.isfile(candidate):
                exes.append(os.path.normpath(candidate))
    return exes


def find_via_path() -> list[str]:
    """Walk PATH entries looking for python.exe files."""
    exes = []
    seen_dirs = set()
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
    """Skip Windows Store stubs and anything that can't run -m pip."""
    # Windows Store shims live under WindowsApps
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
    return (out.stdout.strip() or out.stderr.strip())


def discover_pythons() -> list[str]:
    """Return deduplicated list of real Python executables."""
    candidates: list[str] = []
    candidates += find_via_py_launcher()
    candidates += find_via_glob()
    candidates += find_via_path()

    # Deduplicate by resolved path
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


def get_installed(exe: str) -> list[str]:
    out = subprocess.run(
        [exe, "-m", "pip", "list", "--format=freeze"],
        capture_output=True, text=True
    )
    if out.returncode != 0:
        return []
    return [
        line.split("==")[0].strip().lower()
        for line in out.stdout.splitlines()
        if "==" in line
    ]


def clean_env(exe: str, dry: bool) -> None:
    version = get_version(exe)
    print(f"\n{'='*60}")
    print(f"  {version}")
    print(f"  {exe}")
    print(f"{'='*60}")

    print("  [1/2] Upgrading pip...")
    run([exe, "-m", "pip", "install", "--upgrade", "pip"], dry)

    print("  [2/2] Scanning packages...")
    packages = get_installed(exe)
    to_remove = [p for p in packages if p not in PROTECTED]

    if not to_remove:
        print("    Nothing to remove — already clean.")
    else:
        print(f"    Removing {len(to_remove)} package(s): {', '.join(to_remove)}")
        for pkg in to_remove:
            run([exe, "-m", "pip", "uninstall", "-y", pkg], dry)

    print("  Remaining packages:")
    subprocess.run([exe, "-m", "pip", "list"], check=False)


def main():
    parser = argparse.ArgumentParser(
        description="Clean every Python install down to pip only."
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

    print(f"\nFound {len(pythons)} installation(s). Proceeding...\n")

    for exe in pythons:
        try:
            clean_env(exe, args.dry_run)
        except Exception as e:
            print(f"  ERROR: {e}")

    print(f"\n{'='*60}")
    print("All done.")


if __name__ == "__main__":
    main()
