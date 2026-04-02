# SKRYPTY

Zbiór pomocniczych skryptów Python i PowerShell.

---

## python/clean_pip_env.py

> **Windows only** — wymaga `python.exe` i opcjonalnie Python Launcher (`py`).

Wykrywa wszystkie instalacje Pythona w systemie i dla każdej z nich:
- aktualizuje `pip` do najnowszej wersji
- odinstalowuje wszystkie pakiety poza `pip`, `setuptools` i `wheel`

**Wykrywanie instalacji (kolejno):**
1. `py --list-paths` (Python Launcher for Windows)
2. Typowe katalogi instalacyjne (glob po wzorcach):
   - `C:\Python*`, `C:\Program Files\Python*`, `C:\Program Files (x86)\Python*`
   - `%LOCALAPPDATA%\Programs\Python\Python*`, `%APPDATA%\Python\Python*`
   - `C:\Anaconda*`, `C:\ProgramData\Anaconda*`, `C:\Miniconda*`
   - `%USERPROFILE%\Anaconda*`, `%USERPROFILE%\Miniconda*`
   - `%USERPROFILE%\AppData\Local\conda\conda\envs`
3. Wpisy w zmiennej PATH

**Filtrowanie:**
- Pomija stuby Windows Store (`WindowsApps`)
- Pomija instalacje bez działającego `pip`
- Deduplikuje wyniki (ta sama ścieżka z różnych źródeł liczy się raz)

**Użycie:**
```
python python/clean_pip_env.py           # normalne działanie
python python/clean_pip_env.py --dry-run # podgląd bez wprowadzania zmian
```

---

## powershell/update.ps1

> **Windows only** — wymaga PowerShell z dostępem do internetu.

Definiuje funkcję `update`, która sprawdza i aktualizuje narzędzia deweloperskie:

- **uv** — sprawdza wersję przez GitHub API, aktualizuje przez oficjalny skrypt instalacyjny
- **pnpm** — sprawdza wersję przez `npm view`, aktualizuje przez oficjalny skrypt; usuwa stare wersje z katalogu `.tools`
- **Bun** — sprawdza wersję przez GitHub API, aktualizuje przez oficjalny skrypt instalacyjny
- **Deno** — sprawdza wersję przez GitHub API, aktualizuje przez `deno upgrade`
- **npm global packages** — wykrywa przestarzałe pakiety globalne i aktualizuje każdy do `@latest`

Jeśli narzędzie nie jest zainstalowane, skrypt próbuje je automatycznie zainstalować przed aktualizacją.

**Użycie:**
```powershell
. .\powershell\update.ps1   # załaduj funkcję do sesji
update                       # uruchom aktualizację
```
