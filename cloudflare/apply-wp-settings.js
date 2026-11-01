#!/usr/bin/env node

/**
 * apply-wp-settings.js
 * 
 * Applies universal Cloudflare settings optimized for WordPress sites
 * from a JSON template file using the Cloudflare REST API.
 * 
 * Requirements: Node.js 18+ (zero external dependencies)
 * 
 * Usage:
 *   node apply-wp-settings.js --zone example.com
 *   node apply-wp-settings.js --zone example.com --dry-run
 *   node apply-wp-settings.js --zone example.com --template ./custom-template.json
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Parse CLI arguments
const args = process.argv.slice(2);
function getArg(flag, defaultValue = null) {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return defaultValue;
}
const isDryRun = args.includes('--dry-run');
const showHelp = args.includes('--help') || args.includes('-h');
const targetZone = getArg('--zone');
const templatePath = getArg('--template', path.join(__dirname, 'cloudflare-wordpress-template.json'));
let apiToken = getArg('--token', process.env.CLOUDFLARE_API_TOKEN);

if (showHelp || !targetZone) {
  console.log(`
Cloudflare WordPress Settings Applier
-------------------------------------
Usage:
  node apply-wp-settings.js --zone <domain-or-zone-id> [options]

Options:
  --zone <domain|id>   (Required) Domain name (e.g. example.com) or Zone ID
  --token <token>      Cloudflare API Token (or set CLOUDFLARE_API_TOKEN env var)
  --template <file>    Path to JSON template (default: cloudflare-wordpress-template.json)
  --dry-run            Simulate operations without writing changes
  --help, -h           Show this help message

Examples:
  node apply-wp-settings.js --zone mysite.com --dry-run
  node apply-wp-settings.js --zone mysite.com
`);
  process.exit(showHelp ? 0 : 1);
}

// Attempt to read token from local cf CLI config if not in env
if (!apiToken) {
  const localConfigPaths = [
    path.join(process.env.APPDATA || '', 'xdg.config', 'cloudflare', 'config', 'default.json'),
    path.join(os.homedir(), '.config', 'cloudflare', 'config', 'default.json')
  ];
  for (const cfgPath of localConfigPaths) {
    if (fs.existsSync(cfgPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        if (parsed.tokens && parsed.tokens.access_token) {
          apiToken = parsed.tokens.access_token;
          break;
        }
      } catch (_) {}
    }
  }
}

if (!apiToken) {
  console.error("❌ Error: No Cloudflare API Token found.");
  console.error("   Provide it via --token <token> or set the CLOUDFLARE_API_TOKEN environment variable.");
  process.exit(1);
}

// Load template file
if (!fs.existsSync(templatePath)) {
  console.error(`❌ Error: Template file not found: ${templatePath}`);
  process.exit(1);
}
let template;
try {
  template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
} catch (e) {
  console.error(`❌ Error parsing template JSON: ${e.message}`);
  process.exit(1);
}

// Cloudflare API helper
async function cfRequest(endpoint, method = 'GET', body = null) {
  const url = `https://api.cloudflare.com/client/v4${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json'
  };

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok || !data.success) {
    const errorMsg = (data.errors && data.errors.map(e => `${e.message} (code ${e.code})`).join(', ')) || res.statusText;
    throw new Error(`API ${method} ${endpoint} failed: ${errorMsg}`);
  }
  return data.result;
}

async function run() {
  console.log(`\n==================================================`);
  console.log(` Cloudflare Universal WordPress Settings Applier `);
  console.log(`==================================================`);
  if (isDryRun) {
    console.log(` Mode: 🔍 DRY RUN (No changes will be applied)\n`);
  }

  // 1. Resolve Zone ID
  let zoneId = targetZone;
  let zoneName = targetZone;
  if (targetZone.includes('.')) {
    console.log(`🔍 Looking up zone ID for domain: "${targetZone}"...`);
    const zones = await cfRequest(`/zones?name=${encodeURIComponent(targetZone)}`);
    if (!zones || zones.length === 0) {
      throw new Error(`Zone "${targetZone}" not found in your Cloudflare account.`);
    }
    zoneId = zones[0].id;
    zoneName = zones[0].name;
  }
  console.log(`✅ Target Zone: ${zoneName} (${zoneId})\n`);

  // 2. Apply Zone Settings
  if (template.zone_settings) {
    console.log(`⚙️  Applying Zone Settings...`);
    for (const [settingId, desiredValue] of Object.entries(template.zone_settings)) {
      try {
        if (isDryRun) {
          console.log(`   [DRY-RUN] Would set setting "${settingId}" => ${JSON.stringify(desiredValue)}`);
        } else {
          await cfRequest(`/zones/${zoneId}/settings/${settingId}`, 'PATCH', { value: desiredValue });
          console.log(`   ✓ ${settingId} set to: ${JSON.stringify(desiredValue)}`);
        }
      } catch (err) {
        console.warn(`   ⚠️  Failed to set ${settingId}: ${err.message}`);
      }
    }
    console.log('');
  }

  // 3. Apply Bot Management
  if (template.bot_management) {
    console.log(`🤖 Applying Bot Management (Bot Fight Mode)...`);
    if (isDryRun) {
      console.log(`   [DRY-RUN] Would set bot_management => ${JSON.stringify(template.bot_management)}`);
    } else {
      try {
        await cfRequest(`/zones/${zoneId}/bot_management`, 'PUT', template.bot_management);
        console.log(`   ✓ Bot Fight Mode enabled successfully.`);
      } catch (err) {
        console.warn(`   ⚠️  Bot Management update failed: ${err.message}`);
      }
    }
    console.log('');
  }

  // 4. Apply Managed Response Headers (e.g. remove X-Powered-By)
  if (template.managed_headers) {
    console.log(`🛡️  Applying Managed Response Headers...`);
    if (isDryRun) {
      console.log(`   [DRY-RUN] Would update managed_headers => ${JSON.stringify(template.managed_headers)}`);
    } else {
      try {
        await cfRequest(`/zones/${zoneId}/managed_headers`, 'PATCH', template.managed_headers);
        console.log(`   ✓ Managed Headers updated (Remove X-Powered-By enabled).`);
      } catch (err) {
        console.warn(`   ⚠️  Managed Headers update failed: ${err.message}`);
      }
    }
    console.log('');
  }

  // 5. Apply Custom Cache Rules
  if (template.cache_rules && template.cache_rules.length > 0) {
    console.log(`⚡ Applying Custom Cache Rules...`);
    const phase = 'http_request_cache_settings';
    let existingRuleset = null;
    try {
      existingRuleset = await cfRequest(`/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`);
    } catch (_) {}

    if (isDryRun) {
      console.log(`   [DRY-RUN] Would deploy ${template.cache_rules.length} Cache Rules to phase "${phase}":`);
      template.cache_rules.forEach(r => console.log(`     - ${r.description}`));
    } else {
      try {
        const rules = [...template.cache_rules];
        if (existingRuleset && existingRuleset.id) {
          await cfRequest(`/zones/${zoneId}/rulesets/${existingRuleset.id}`, 'PUT', { rules });
          console.log(`   ✓ Updated cache ruleset with ${rules.length} rules.`);
        } else {
          await cfRequest(`/zones/${zoneId}/rulesets`, 'POST', {
            name: "default",
            kind: "zone",
            phase: phase,
            rules: rules
          });
          console.log(`   ✓ Created new cache ruleset with ${rules.length} rules.`);
        }
      } catch (err) {
        console.warn(`   ⚠️  Failed to deploy Cache Rules: ${err.message}`);
      }
    }
    console.log('');
  }

  // 6. Apply Custom WAF Rules
  if (template.waf_rules && template.waf_rules.length > 0) {
    console.log(`🔒 Applying Custom WAF Rules...`);
    const phase = 'http_request_firewall_custom';
    let existingRuleset = null;
    try {
      existingRuleset = await cfRequest(`/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`);
    } catch (_) {}

    if (isDryRun) {
      console.log(`   [DRY-RUN] Would deploy ${template.waf_rules.length} WAF Rules to phase "${phase}":`);
      template.waf_rules.forEach(r => console.log(`     - [${r.action}] ${r.description}`));
    } else {
      try {
        const rules = [...template.waf_rules];
        if (existingRuleset && existingRuleset.id) {
          await cfRequest(`/zones/${zoneId}/rulesets/${existingRuleset.id}`, 'PUT', { rules });
          console.log(`   ✓ Updated custom WAF ruleset with ${rules.length} rules.`);
        } else {
          await cfRequest(`/zones/${zoneId}/rulesets`, 'POST', {
            name: "default",
            kind: "zone",
            phase: phase,
            rules: rules
          });
          console.log(`   ✓ Created new custom WAF ruleset with ${rules.length} rules.`);
        }
      } catch (err) {
        console.warn(`   ⚠️  Failed to deploy Custom WAF Rules: ${err.message}`);
      }
    }
    console.log('');
  }

  // 7. Apply Rate Limiting Rules
  if (template.rate_limiting_rules && template.rate_limiting_rules.length > 0) {
    console.log(`⏱️  Applying Rate Limiting Rules...`);
    const phase = 'http_ratelimit';
    let existingRuleset = null;
    try {
      existingRuleset = await cfRequest(`/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`);
    } catch (_) {}

    if (isDryRun) {
      console.log(`   [DRY-RUN] Would deploy ${template.rate_limiting_rules.length} Rate Limiting Rules to phase "${phase}":`);
      template.rate_limiting_rules.forEach(r => console.log(`     - [${r.action}] ${r.description}`));
    } else {
      try {
        const rules = [...template.rate_limiting_rules];
        if (existingRuleset && existingRuleset.id) {
          await cfRequest(`/zones/${zoneId}/rulesets/${existingRuleset.id}`, 'PUT', { rules });
          console.log(`   ✓ Updated rate limiting ruleset with ${rules.length} rules.`);
        } else {
          await cfRequest(`/zones/${zoneId}/rulesets`, 'POST', {
            name: "default",
            kind: "zone",
            phase: phase,
            rules: rules
          });
          console.log(`   ✓ Created new rate limiting ruleset with ${rules.length} rules.`);
        }
      } catch (err) {
        console.warn(`   ⚠️  Failed to deploy Rate Limiting Rules: ${err.message}`);
      }
    }
    console.log('');
  }

  console.log(`🎉 Completed successfully! Universal WordPress settings are in place.`);
}

run().catch(err => {
  console.error(`\n❌ Execution error: ${err.message}`);
  process.exit(1);
});
