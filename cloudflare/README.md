# Universal Cloudflare Settings for WordPress

This folder contains a universal configuration template and an automated importer script to apply recommended Cloudflare settings for any WordPress website.

## Files

* **[`./cloudflare-wordpress-template.json`](./cloudflare-wordpress-template.json)**: The reusable JSON template containing all universal WordPress rules and settings.
* **[`./apply-wp-settings.js`](./apply-wp-settings.js)**: A lightweight Node.js script (zero npm dependencies) that applies the template to any Cloudflare zone using the Cloudflare REST API.

---

## Included Settings in Template

### 1. Zone & Performance Settings
* `browser_cache_ttl`: `0` (*Respect Existing Headers* from origin)
* `always_use_https`: `on`
* `automatic_https_rewrites`: `on`
* `min_tls_version`: `1.2`
* `tls_1_3`: `zrt` (with 0-RTT)
* `brotli`: `on`
* `early_hints`: `on`
* `rocket_loader`: `off` (prevents breaking WordPress/jQuery plugins)
* `cache_level`: `aggressive` (Standard)
* `browser_check`: `on` (Browser Integrity Check)
* `security_level`: `medium`
* `challenge_ttl`: `1800` (30 minutes)
* `ipv6`, `websockets`, `ip_geolocation`, `email_obfuscation`: `on`

### 2. Bot Protection
* Free **Bot Fight Mode** enabled (`fight_mode: true`, `enable_js: true`)

### 3. Managed Header Transforms
* **Remove X-Powered-By Header** enabled (strips PHP and web server versions from responses)

### 4. Custom Cache Rules (`http_request_cache_settings`)
* **Bypass WP-Admin & Login:** Bypasses cache when path contains `/wp-admin/`, `wp-login.php`, or user cookie has `wordpress_logged_in`.
* **Cache wp-content Static Assets:** Caches static files (`jpg`, `png`, `webp`, `css`, `js`, `woff2`, etc.) in `/wp-content/` with an Edge TTL of 7 days and Browser TTL of 1 month.

### 5. Custom WAF Rules (`http_request_firewall_custom`)
1. **Block `/xmlrpc.php`:** Hard block against XML-RPC multicall brute-force and DDoS.
2. **Block `/wp-cron.php` over HTTP:** Prevents public HTTP requests from spawning cron processes.
3. **Managed challenge on `wp-login.php` & `/wp-admin/`:** Issues a Managed Challenge to logins and admin dashboard, excluding `admin-ajax.php` and `admin-post.php`.
4. **Block sensitive file types:** Blocks `.sql`, `.bak`, `.log`, `.env`, `.old`, `.tar`, except inside `/wp-content/uploads/`.
5. **Block `.php` files outside WordPress entry points + empty UA:** Restricts execution to core entry points (`index.php`, `wp-login.php`, `wp-admin`, etc.) and blocks direct requests to plugin PHP files, `wp-config.php`, and clients with an empty User-Agent header.

### 6. Rate Limiting (`http_ratelimit`)
* **POST `/wp-login.php`:** Maximum **5 requests per 10 seconds per IP**, then blocks the offending IP for **10 seconds** to thwart brute-force password stuffing.

---

## Usage

### 1. Dry Run (Preview without applying changes)
```bash
node apply-wp-settings.js --zone example.com --dry-run
```

### 2. Apply to a Site
```bash
node apply-wp-settings.js --zone example.com
```

### 3. Supplying an API Token
The script automatically checks:
1. `--token <TOKEN>` command line option
2. `CLOUDFLARE_API_TOKEN` environment variable
3. Local `cf` CLI login credentials (if already authenticated via `cf auth login`)

Example with custom token:
```bash
node apply-wp-settings.js --zone example.com --token your_cf_api_token_here
```

### 4. Custom Template
```bash
node apply-wp-settings.js --zone example.com --template ./custom-template.json
```
