# SKRYPTY

Zbiór pomocniczych skryptów Python.

---

## clean_pip_env.py

Wykrywa wszystkie instalacje Pythona w systemie i dla każdej z nich:
- aktualizuje `pip` do najnowszej wersji
- odinstalowuje wszystkie pakiety poza `pip`, `setuptools` i `wheel`

**Wykrywanie instalacji (kolejno):**
1. `py --list-paths` (Python Launcher for Windows)
2. Typowe katalogi instalacyjne (Program Files, AppData, Anaconda itp.)
3. Wpisy w zmiennej PATH

**Użycie:**
```
python clean_pip_env.py           # normalne działanie
python clean_pip_env.py --dry-run # podgląd bez wprowadzania zmian
```
