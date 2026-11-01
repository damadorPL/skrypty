# Python Scripts

Katalog zawiera narzędzia do automatycznego wykrywania, aktualizacji i konserwacji instalacji interpretera Python oraz środowisk pakietów `pip` w systemie Windows.

---

## clean_pip_env.py

> **Windows only** — wymaga interpretera `python.exe` (opcjonalnie Python Launcher `py`).

Skrypt automatycznie identyfikuje wszystkie środowiska Pythona w systemie operacyjnym, aktualizuje menedżer pakietów `pip`, a następnie usuwa wszystkie zainstalowane pakiety poza niezbędnymi narzędziami bazowymi (`pip`, `setuptools`, `wheel`).

### Kluczowe właściwości:
- **Wykrywanie instalacji (wielopoziomowe):**
  1. Python Launcher dla Windows (`py --list-paths`)
  2. Wyszukiwanie w standardowych katalogach instalacyjnych:
     - `C:\Python*`
     - `C:\Program Files\Python*`, `C:\Program Files (x86)\Python*`
     - `%LOCALAPPDATA%\Programs\Python\Python*`, `%APPDATA%\Python\Python*`
     - `C:\Anaconda*`, `C:\ProgramData\Anaconda*`, `C:\Miniconda*`
     - `%USERPROFILE%\Anaconda*`, `%USERPROFILE%\Miniconda*`
     - `%USERPROFILE%\AppData\Local\conda\conda\envs`
  3. Przeszukiwanie ścieżek zdefiniowanych w zmiennej środowiskowej `PATH`
- **Filtrowanie i bezpieczeństwo:**
  - Ignoruje atrapy i przekierowania Windows Store (`WindowsApps`).
  - Pomija uszkodzone środowiska niemające działającego modułu `pip`.
  - Przeprowadza pełną deduplikację wykrytych ścieżek.
  - Ostrzega w przypadku braku uprawnień Administratora.
- **Szybkie masowe usuwanie:**
  - Zbiera listę wszystkich pakietów i odinstalowuje je jednym wywołaniem `pip uninstall -y`, co radykalnie skraca czas wykonania.

### Użycie:
```powershell
# Standardowe czyszczenie wszystkich środowisk
python clean_pip_env.py

# Podgląd symulacji (Dry-run) bez dokonywania modyfikacji
python clean_pip_env.py --dry-run
```

---

## update_pip.py

> **Windows only** — wymaga interpretera `python.exe` (opcjonalnie Python Launcher `py`).

Skrypt dedykowany do masowej aktualizacji samego menedżera pakietów `pip` we wszystkich wykrytych w systemie instalacjach Pythona, bez ingerencji w zainstalowane biblioteki zewnętrzne.

### Kluczowe właściwości:
- Wykorzystuje ten sam zaawansowany silnik skanowania i deduplikacji środowisk Python co `clean_pip_env.py`.
- Aktualizuje `pip` do najnowszego wydania za pomocą polecenia `python -m pip install --upgrade pip`.
- Weryfikuje uprawnienia administratora na maszynie Windows.

### Użycie:
```powershell
# Standardowa aktualizacja pip we wszystkich instalacjach
python update_pip.py

# Podgląd symulacji (Dry-run) bez pobierania i instalowania aktualizacji
python update_pip.py --dry-run
```
