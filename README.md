# SKRYPTY

Zbiór pomocniczych skryptów Python \ PowerShell \ Bash.

---

## python/clean_pip_env.py

> **Windows only** — wymaga `python.exe` i opcjonalnie Python Launcher (`py`).

Wykrwywa wszystkie instalacje Pythona w systemie i dla każdej z nich:
- ostrzega o braku uprawnień Administratora na Windows
- aktualizuje `pip` do najnowszej wersji
- odinstalowuje wszystkie pakiety poza `pip`, `setuptools` i `wheel` masowo w jednej komendzie (znaczące przyspieszenie)

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

Wykrywa wszystkie instalacje Pythona w systemie, ostrzega o braku uprawnień Administratora i aktualizuje `pip` do najnowszej wersji w każdej z nich.

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

Definiuje funkcję `Get-UpdateTools`, która sprawdza i aktualizuje narzędzia deweloperskie:

- **Automatyczna instalacja brakujących narzędzi** — przed rozpoczęciem aktualizacji sprawdza obecność narzędzi (`uv`, `pnpm`, `bun`, `deno`, `claude`, `agy`, `grok`) i automatycznie instaluje brakujące z oficjalnych źródeł.
- **uv** — sprawdza instalację w `%USERPROFILE%\.local\bin\uv.exe`, aktualizuje przez `uv self update` lub pobiera wersję standalone.
- **pnpm** — porównuje wersję lokalną z rejestrem npm, aktualizuje przez oficjalny skrypt oraz czyści stare wersje w `.tools\pnpm-exe`.
- **Bun** — wyświetla zainstalowaną wersję i aktualizuje za pomocą `bun upgrade`.
- **Deno** — wyświetla zainstalowaną wersję i aktualizuje za pomocą `deno upgrade`.
- **Claude Code** — wykrywa zainstalowaną wersję i aktualizuje za pomocą `claude update`.
- **Antigravity CLI (agy)** — wykrywa zainstalowaną wersję i aktualizuje za pomocą `agy update`.
- **Grok CLI (grok)** — wykrywa zainstalowaną wersję i aktualizuje za pomocą `grok update`.
- **npm global packages** — sprawdza zainstalowane pakiety globalne npm, pobiera informacje o najnowszych wersjach i dacie publikacji z rejestru, aktualizuje przestarzałe paczki do `@latest` oraz prezentuje podsumowanie w czytelnej tabeli.

**Użycie:**
```powershell
. .\powershell\update.ps1   # załaduj funkcję do sesji
Get-UpdateTools             # uruchom aktualizację
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

Wykrywa i usuwa stare jądra systemowe (obrazy, nagłówki, moduły), zachowując aktualnie używane i chroniąc metapakiety przed usunięciem.

**Działanie:**
1. Pobiera wersję aktywnego jądra przez `uname -r`
2. Listuje pakiety `linux-image`, `linux-headers`, `linux-modules` itp. dopasowując tylko wersjonowane paczki (ignoruje np. `linux-image-generic`)
3. Bez argumentu — tryb podglądu (wypisuje pakiety do usunięcia)
4. Z argumentem `exec` — usuwa stare jądra masowo w jednym wywołaniu `apt-get purge` (zapobiega wielokrotnemu odświeżaniu GRUB)

**Użycie:**
```bash
bash linux/remove_old_kernels.sh           # podgląd — lista pakietów do usunięcia
sudo bash linux/remove_old_kernels.sh exec # usuń stare jądra
```
