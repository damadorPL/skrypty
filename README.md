# SKRYPTY

Zbiór pomocniczych skryptów Python \ PowerShell \ Bash.

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

## python/update_pip.py

> **Windows only** — wymaga `python.exe` i opcjonalnie Python Launcher (`py`).

Wykrywa wszystkie instalacje Pythona w systemie i aktualizuje `pip` do najnowszej wersji w każdej z nich.

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
python python/update_pip.py           # normalne działanie
python python/update_pip.py --dry-run # podgląd bez wprowadzania zmian
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

---

## linux/.bash_aliases

> **Linux only** — plik z aliasami do dołączenia do `~/.bashrc` lub `~/.bash_aliases`.

Definiuje alias `update`, który kolejno uruchamia:
- `sudo apt update -y` — odświeża listę pakietów
- `sudo apt full-upgrade -y` — aktualizuje wszystkie pakiety
- `sudo apt autoremove -y` — usuwa niepotrzebne zależności
- `sudo apt clean -y` / `autoclean -y` — czyści lokalną pamięć podręczną pakietów

**Użycie:**
```bash
cat linux/.bash_aliases >> ~/.bash_aliases   # dołącz do istniejącego pliku
source ~/.bash_aliases                        # załaduj do bieżącej sesji
update                                        # uruchom aktualizację systemu
```

---

## linux/remove_old_kernels.sh

> **Linux (Debian/Ubuntu)** — wymaga `dpkg` i `apt`.

Wykrywa i usuwa stare jądra systemowe (obrazy, nagłówki, moduły), zachowując aktualnie używane.

**Działanie:**
1. Pobiera wersję aktywnego jądra przez `uname -a`
2. Listuje pakiety `linux-image`, `linux-headers`, `linux-modules` inne niż bieżące
3. Bez argumentu — tryb podglądu (wypisuje pakiety do usunięcia)
4. Z argumentem `exec` — faktycznie usuwa pakiety przez `apt purge`

**Użycie:**
```bash
bash linux/remove_old_kernels.sh           # podgląd — lista pakietów do usunięcia
sudo bash linux/remove_old_kernels.sh exec # usuń stare jądra
```
