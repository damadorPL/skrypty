# Cleanup Scripts

Katalog zawiera narzędzia do konserwacji systemu Windows, optymalizacji przestrzeni dyskowej oraz usuwania pozostałości po aktualizacjach aplikacji i menedżerach pakietów.

---

## cleanup-apps-and-caches.js

> **Windows only** — wymaga środowiska Node.js (v18+).

Uniwersalny skrypt sprzątający dla systemu Windows, który bezpiecznie odzyskuje gigabajty przestrzeni dyskowej z archiwalnych wersji aplikacji desktopowych, pamięci podręcznej środowiska Node.js oraz menedżerów pakietów deweloperskich.

### Zakres skanowania i czyszczenia

1. **Aplikacje Squirrel i Electron**
   - Przeszukuje lokalizacje `%LOCALAPPDATA%`, `%LOCALAPPDATA%\Programs` oraz `%APPDATA%`.
   - Identyfikuje wersjonowane katalogi wydań (np. foldery o strukturze `app-X.Y.Z` w programach takich jak Slack, Discord, Teams, VS Code, Postman itp.).
   - Parsuje numery wersji za pomocą reguł SemVer, bezwzględnie zachowując wersję najnowszą, a kwalifikując do usunięcia wszystkie starsze, nieużywane wydania pozostawione przez mechanizmy auto-update.

2. **Narzędzia deweloperskie i CLI w profilu użytkownika**
   - Skanuje archiwalne wydania narzędzi CLI (m.in. Archon Web Dist, CUA Driver, Copilot CLI, Claude Code, Vite Plus).
   - Usuwa stare kompilacje i pliki tymczasowe pozostawione po aktualizacjach narzędzi.

3. **Pamięć podręczna Node.js / V8**
   - Usuwa nieużywane nagłówki C++ w katalogu `node-gyp\Cache` (pozostawia wyłącznie te powiązane z aktualnie zainstalowaną wersją Node.js).
   - Czyści tymczasowe pamięci podręczne kompilacji kodu bajtowego V8 (`node-compile-cache`, katalogi `compile-cache` w folderze Temp, `v8-compile-cache`).

4. **Menedżery pakietów npm i pnpm**
   - Usuwa pamięć podręczną npm (`_cacache`, `_npx`).
   - Uruchamia polecenie `pnpm store prune` (jeśli `pnpm` jest zainstalowany w systemie) w celu usunięcia zduplikowanych i nieużywanych pakietów ze wspólnego magazynu content-addressable.

---

### Bezpieczeństwo

- **Weryfikacja wersji (SemVer):** Gwarantuje, że bieżąca (najwyższa) wersja aplikacji nigdy nie zostanie skasowana.
- **Odblokowywanie uprawnień:** Automatycznie zdejmuje atrybut *Tylko do odczytu* (read-only) przed próbą usunięcia zablokowanych plików.
- **Pomijanie otwartych procesów:** Pliki aktualnie otwarte przez uruchomione programy są bezpiecznie pomijane bez przerywania działania skryptu.
- **Podsumowanie przed usunięciem:** Domyślnie skrypt najpierw prezentuje czytelne podsumowanie ze znalezionymi katalogami oraz szacowanym rozmiarem do odzyskania i czeka na potwierdzenie użytkownika.

---

### Użycie

```powershell
# Domyślny tryb interaktywny (skanuje, wyświetla podsumowanie i prosi o potwierdzenie [y/N])
node cleanup-apps-and-caches.js

# Tryb symulacji (Dry-run) — bezpieczny podgląd bez modyfikowania jakichkolwiek plików
node cleanup-apps-and-caches.js --dry-run
# lub skrótowo:
node cleanup-apps-and-caches.js -d

# Tryb wymuszony (Force) — automatyczne czyszczenie bez pytania o potwierdzenie
node cleanup-apps-and-caches.js --force
# lub skrótowo:
node cleanup-apps-and-caches.js -f
```
