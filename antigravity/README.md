# Antigravity Scripts

Katalog zawiera skrypty rozszerzające i integrujące się z narzędziem **Google Antigravity CLI (`agy`)**.

---

## statusline.js

> **Cross-platform (Windows / macOS / Linux)** — wymaga środowiska Node.js (v18+).

Własny, responsywny i wysoce konfigurowalny pasek stanu (statusline) dla **Antigravity CLI (`agy`)**. Skrypt odbiera obiekt stanu sesji w formacie JSON ze standardowego wejścia (`stdin`) i generuje jednoliniowy, kolorowy pasek w stopce interfejsu TUI.

### Kluczowe możliwości

- **Dynamiczna adaptacja do szerokości okna (`terminal_width`)** — automatycznie zarządza priorytetami segmentów paska, redukując lub ukrywając mniej istotne elementy przy wąskim oknie terminala, aby zapobiec nieestetycznemu zawijaniu wierszy.
- **Wizualny pasek Context Window** — graficzny pasek postępu zużycia tokenów (np. `[████░░░░] 45.8%`) z adaptacyjnymi kolorami:
  - Zielony: poniżej 60%
  - Żółty: 60% – 85%
  - Czerwony: powyżej 85%
  - Licznik tokenów w zwięzłym formacie (np. `153k/1.0M`).
- **Wskaźnik stanu agenta** — czytelne odznaki informujące o bieżącej operacji:
  - `● IDLE` (oczekiwanie na polecenie)
  - `⚡ WORKING` (generowanie odpowiedzi / myślenie)
  - `⚙ TOOL` (wykonywanie narzędzia / polecenia)
  - `🔍 REVIEW` (przegląd lub inspekcja)
  - `🔑 AUTH` (oczekiwanie na uwierzytelnienie)
  - `⏳ INIT` (inicjalizacja sesji)
  - `✖ ERROR` (błąd)
- **Model i poziom myślenia** — aktywny model (np. `Gemini 3.8 Flash`) oraz poziom intensywności myślenia (`[high]`).
- **Integracja z Git** — wykrywanie bieżącej gałęzi repozytorium (` main`) oraz wskaźnik niezatwierdzonych zmian (`*`).
- **Metadane sesji** — bieżący katalog roboczy, stan piaskownicy (`🛡️ sandbox`), aktywne zadania w tle, wygenerowane artefakty oraz szacowany koszt sesji.
- **Brak zewnętrznych zależności** — czysty Node.js (wyłącznie moduły wbudowane w standardową bibliotekę), czas wykonania poniżej 40 ms.
- **Różne style wizualne** — wsparcie dla stylów `default`, `minimal`, `powerline` oraz trybu ASCII.

---

### Konfiguracja w Antigravity CLI

#### Sposób 1: Bezpośrednio w CLI przez Slash Command
Wewnątrz aktywnej sesji `agy` wpisz:
```text
/statusline node <pełna-ścieżka-do-skryptu>/statusline.js
```

> [!NOTE]
> **Wskazówka dla Windows:** Nie otaczaj ścieżki zewnętrznymi cudzysłowami (np. `"C:\..."`), ponieważ CLI przekaże je dosłownie do procesu Node.js, powodując błąd modułu. Zamiast tego użyj ukośników `/` lub podwójnych `\\`, np.:
> ```text
> /statusline node C:/Users/TwojUzytkownik/Documents/Code/skrypty/antigravity/statusline.js
> ```

#### Sposób 2: Plik konfiguracyjny `settings.json`
Dodaj lub zmodyfikuj sekcję `statusLine` w pliku `~/.gemini/antigravity-cli/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node C:\\Users\\TwojUzytkownik\\Documents\\Code\\skrypty\\antigravity\\statusline.js"
  }
}
```

---

### Opcje wiersza poleceń i tryby pracy

| Opcja | Opis |
|---|---|
| `--demo` | Uruchamia interaktywną demonstrację wszystkich możliwych stanów agenta i wariantów paska. |
| `--test` | Wykonuje pojedynczy test z przykładowym ładunkiem JSON i wypisuje wygenerowany pasek. |
| `--style=<name>` | Wybór stylu renderowania: `default`, `minimal`, `powerline`. |
| `--ascii` | Wymusza użycie wyłącznie podstawowych znaków ASCII (brak symboli Unicode / Nerd Fonts). |
| `--no-color` | Wyłącza sekwencje kolorów ANSI (respektuje także zmienne `NO_COLOR=1` oraz `NODE_DISABLE_COLORS=1`). |
| `--help` | Wyświetla ekran pomocy ze szczegółowym opisem parametrów. |

### Przykłady uruchomienia

```bash
# Szybki test działania
node statusline.js --test

# Podgląd demonstracyjny
node statusline.js --demo

# Test stylu minimalistycznego z obsługą ASCII
node statusline.js --test --style=minimal --ascii
```
