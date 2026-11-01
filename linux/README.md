# Linux Scripts

Katalog zawiera skrypty powłoki Bash oraz konfiguracje aliasów dla systemów operacyjnych opartych na dystrybucjach Debian / Ubuntu.

---

## .bash_aliases

> **Linux only** — plik z konfiguracją aliasów powłoki Bash.

Plik definiuje podręczny alias `update`, który kompleksowo aktualizuje system i czyści zbędne pakiety za pomocą menedżera APT.

### Wykonywane kroki:
1. `sudo apt update -y` — odświeżenie indeksów pakietów ze skonfigurowanych repozytoriów.
2. `sudo apt full-upgrade -y` — pełna aktualizacja zainstalowanych pakietów (w tym inteligentne rozwiązywanie zależności).
3. `sudo apt autoremove -y` — usunięcie osieroconych pakietów i zależności, które nie są już wymagane.
4. `sudo apt clean -y` / `autoclean -y` — wyczyszczenie lokalnego archiwum pobranych plików instalacyjnych `.deb`.

### Instalacja i użycie:
```bash
# Dołączenie aliasu do lokalnego pliku konfiguracyjnego
cat .bash_aliases >> ~/.bash_aliases

# Przeładowanie konfiguracji w bieżącej sesji powłoki
source ~/.bash_aliases

# Uruchomienie kompleksowej aktualizacji
update
```

---

## remove_old_kernels.sh

> **Linux (Debian / Ubuntu)** — wymaga `dpkg`, `apt` oraz uprawnień administratora (`sudo`).

Skrypt do bezpiecznego wyszukiwania i usuwania archiwalnych obrazów oraz nagłówków jądra Linux (obrazy, nagłówki, moduły), które po kolejnych aktualizacjach systemu zapełniają partycję `/boot`.

### Zasada działania:
1. Odczytuje wersję aktualnie używanego jądra za pomocą polecenia `uname -r`.
2. Skanuje zainstalowane pakiety przez `dpkg --list`, dopasowując paczki `linux-image-*`, `linux-headers-*`, `linux-modules-*`, `linux-image-extra-*` oraz `linux-modules-extra-*` posiadające konkretne wersje numeryczne.
3. Bezwzględnie wyklucza z listy aktualnie uruchomiony kernel oraz nienumerowane metapakiety (takie jak `linux-image-generic`), co chroni system przed uszkodzeniem przyszłych aktualizacji.
4. W trybie wykonania uruchamia jedno zbiorcze wywołanie `apt-get purge`, co eliminuje wielokrotne, czasochłonne przebudowywanie konfiguracji bootloadera GRUB dla każdego pakietu z osobna.

### Użycie:

```bash
# 1. Tryb podglądu (Dry-run) — weryfikacja aktywnego kernela i listy pakietów do usunięcia
bash remove_old_kernels.sh

# 2. Wykonanie usunięcia — przekazanie argumentu 'exec' z uprawnieniami roota
sudo bash remove_old_kernels.sh exec
```
