# Cloudflare Scripts

Katalog zawiera uniwersalny szablon konfiguracyjny oraz skrypt automatyzujący wdrażanie optymalnych, rekomendowanych ustawień Cloudflare dla stron opartych na silniku WordPress.

---

## apply-wp-settings.js

> **Cross-platform (Windows / macOS / Linux)** — wymaga środowiska Node.js (v18+, zero zewnętrznych zależności npm).

Lekki skrypt Node.js korzystający z Cloudflare REST API w celu automatycznej konfiguracji strefy domenowej zgodnie z predefiniowanym szablonem [`cloudflare-wordpress-template.json`](./cloudflare-wordpress-template.json).

### Zawartość szablonu konfiguracyjnego

#### 1. Ustawienia strefy i wydajności (Zone & Performance Settings)
- `always_use_https`: `on` — automatyczne wymuszenie szyfrowania HTTPS
- `automatic_https_rewrites`: `on` — automatyczna naprawa mixed-content
- `min_tls_version`: `1.2` — minimalna bezpieczna wersja protokołu TLS
- `tls_1_3`: `zrt` — TLS 1.3 z obsługą 0-RTT dla przyspieszonego handshake'u
- `brotli`: `on` — zaawansowana kompresja danych
- `early_hints`: `on` — wstępne ładowanie zasobów w standardzie 103 Early Hints
- `rocket_loader`: `off` — wyłączony, aby zapobiec konfliktom z bibliotekami jQuery oraz wtyczkami WordPress
- `cache_level`: `aggressive` — standardowe buforowanie Cloudflare
- `browser_cache_ttl`: `0` — respektowanie nagłówków Cache-Control z serwera źródłowego (*Respect Existing Headers*)
- `browser_check`: `on` — weryfikacja integralności przeglądarki (Browser Integrity Check)
- `security_level`: `medium`
- `challenge_ttl`: `1800` — ważność rozwiązania testu zabezpieczeń przez 30 minut
- `ipv6`, `websockets`, `ip_geolocation`, `email_obfuscation`: `on`

#### 2. Ochrona przed botami (Bot Protection)
- Włączenie bezpłatnego mechanizmu **Bot Fight Mode** (`fight_mode: true`, `enable_js: true`).

#### 3. Nagłówki odpowiedzi (Managed Response Headers)
- **Remove X-Powered-By Header** (`enabled: true`) — usuwanie nagłówka ujawniającego wersję PHP i serwera WWW z odpowiedzi HTTP.

#### 4. Niestandardowe reguły pamięci podręcznej (Cache Rules)
- **WP - Bypass WP-Admin & Login:** omijanie pamięci podręcznej przy żądaniach do ścieżek `/wp-admin/`, `/wp-login.php` oraz dla zalogowanych użytkowników (wykrywanie ciasteczka `wordpress_logged_in`).
- **WP - Cache wp-content Assets:** buforowanie plików statycznych (`jpg`, `jpeg`, `png`, `webp`, `avif`, `gif`, `svg`, `ico`, `css`, `js`, `woff`, `woff2`, `ttf`, `eot`, `pdf`, `mp4`) w katalogu `/wp-content/` z czasem życia na krawędzi (Edge TTL) wynoszącym 7 dni oraz w przeglądarce (Browser TTL) wynoszącym 1 miesiąc.

#### 5. Reguły zapory WAF (Custom WAF Rules)
- **Block sensitive WP files:** natychmiastowe blokowanie dostępu do wrażliwych plików `/wp-config.php` oraz `/xmlrpc.php`.
- **WAF Wp-login:** ochrona formularza `/wp-login.php` za pomocą testu Cloudflare Managed Challenge (skuteczna ochrona przed atakami brute-force).
- **Block common automated bots and scrapers:** blokada znanych botów i scraperów (`Go-http-client`, `python-requests`, `scrapy`, `Barkrowler`, `leakix.net` itp.) oraz żądań z pustym nagłówkiem User-Agent.

---

### Uwierzytelnianie (API Token)

Skrypt automatycznie poszukuje tokena API Cloudflare w następującej kolejności:
1. Parametr wiersza poleceń: `--token <TOKEN>`
2. Zmienna środowiskowa: `CLOUDFLARE_API_TOKEN`
3. Plik konfiguracyjny lokalnego narzędzia `cf` CLI (np. `%APPDATA%\xdg.config\cloudflare\config\default.json` lub `~/.config/cloudflare/config/default.json`)

Wymagane uprawnienia tokena Cloudflare (Zone Permissions):
- `Zone - Zone Settings - Edit`
- `Zone - Zone - Read`
- `Zone - Cache Rules - Edit`
- `Zone - WAF - Edit`
- `Zone - Bot Management - Edit` (jeśli dostępne na danym typie konta)
- `Zone - Transform Rules - Edit` (dla Managed Headers)

---

### Użycie

#### 1. Podgląd symulacji (Dry Run)
Bezpieczny test bez wprowadzania jakichkolwiek modyfikacji:
```bash
node apply-wp-settings.js --zone example.com --dry-run
```

#### 2. Wdrożenie na domenę
```bash
node apply-wp-settings.js --zone example.com
```

#### 3. Podanie tokena w wierszu poleceń
```bash
node apply-wp-settings.js --zone example.com --token your_cf_api_token_here
```

#### 4. Użycie własnego szablonu
```bash
node apply-wp-settings.js --zone example.com --template ./custom-template.json
```
