# PowerShell Scripts

Katalog zawiera zaawansowane skrypty automatyzacji i konserwacji środowiska deweloperskiego dla systemu Windows w środowisku PowerShell.

---

## update.ps1

> **Windows only** — wymaga programu PowerShell 5.1+ lub PowerShell 7+ oraz połączenia z internetem.

Skrypt definiuje funkcję `Get-UpdateTools`, która automatyzuje proces weryfikacji, instalacji oraz aktualizacji zestawu nowoczesnych narzędzi programistycznych i menedżerów środowisk.

### Kluczowe funkcjonalności

1. **Automatyczna instalacja brakujących narzędzi**
   - Przed przystąpieniem do aktualizacji funkcja weryfikuje dostępność w systemie narzędzi:
     - `uv` (szybki instalator i resolver pakietów Python)
     - `pnpm` (szybki, oszczędny dyskowo menedżer pakietów Node.js)
     - `bun` (kompleksowy runtime JavaScript / TypeScript)
     - `claude` (Claude Code CLI)
     - `agy` (Google Antigravity CLI)
   - W przypadku wykrycia braku któregokolwiek z narzędzi, skrypt automatycznie pobiera je i instaluje z oficjalnych skryptów instalacyjnych dostawców.

2. **Inteligentna weryfikacja i aktualizacja narzędzi**
   - **uv** — sprawdza instalację lokalną, pobiera status wersji przez `uv self update --dry-run` i dokonuje aktualizacji z wizualizacją paska postępu (`Write-Progress`).
   - **pnpm** — weryfikuje wersję lokalną względem najnowszej wersji w rejestrze npm, uruchamia natywne `pnpm self-update`, a w razie potrzeby stosuje automatyczny mechanizm awaryjny (fallback) pobierający oficjalny instalator `install.ps1`.
   - **Bun** — porównuje zainstalowaną wersję z rejestrem i wykonuje `bun upgrade` ze wskaźnikiem postępu.
   - **Claude Code (`@anthropic-ai/claude-code`)** — sprawdza rejestr npm i aktualizuje narzędzie komendą `claude update`.
   - **Antigravity CLI (`agy`)** — sprawdza i aktualizuje CLI za pomocą natywnego mechanizmu `agy update`.

3. **Globalne pakiety npm**
   - Skanuje pakiety zainstalowane globalnie (`npm list -g --depth=0`).
   - Dla każdego pakietu odpytuje rejestr npm o najnowszą wersję oraz czas publikacji ostatniego wydania (`time.modified`).
   - Automatycznie aktualizuje przestarzałe pakiety do wersji `@latest`.
   - Prezentuje czytelną tabelę podsumowującą: nazwę pakietu, wersję zainstalowaną, najnowszą wersję, datę ostatniej publikacji oraz relatywny czas od aktualizacji.

4. **Deduplikacja zmiennej środowiskowej PATH**
   - Po zakończeniu sprawdzania narzędzi skrypt automatycznie bada zmienną środowiskową `Path` w gałęzi użytkownika.
   - Wykrywa i usuwa zduplikowane wpisy, zachowując czystość i optymalną kolejność przeszukiwania ścieżek binariów.

---

### Sposób użycia

Otwórz terminal PowerShell i załaduj funkcję do bieżącej sesji (tzw. dot-sourcing), a następnie ją wywołaj:

```powershell
# Załadowanie funkcji do sesji
. .\update.ps1

# Uruchomienie procedury aktualizacji narzędzi
Get-UpdateTools
```

> [!TIP]
> Możesz dodać wywołanie `. <ścieżka>\update.ps1` do swojego profilu PowerShell (`$PROFILE`), aby funkcja `Get-UpdateTools` była zawsze dostępna w każdej nowej sesji terminala.
