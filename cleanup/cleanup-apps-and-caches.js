/**
 * Universal Windows App & Cache Cleanup Script
 * Reclaims disk space from obsolete app versions, old Node.js caches, and package managers.
 * Compatible with any Windows machine running Node.js.
 *
 * Usage:
 *   node cleanup-apps-and-caches.js             (Scans, prompts for confirmation, then cleans)
 *   node cleanup-apps-and-caches.js --dry-run   (Scans and reports without deleting)
 *   node cleanup-apps-and-caches.js --force     (Scans and cleans without prompting)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// Environment Paths
const LOCAL_APPDATA = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'AppData', 'Local');
const ROAMING_APPDATA = process.env.APPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'AppData', 'Roaming');
const USER_PROFILE = process.env.USERPROFILE || 'C:\\Users\\Default';
const TEMP_DIR = process.env.TEMP || path.join(LOCAL_APPDATA, 'Temp');

const CURRENT_NODE_VERSION = process.version; // e.g., 'v26.13.0'
const CURRENT_NODE_BASE = CURRENT_NODE_VERSION.replace(/^v/, '');

const ARGS = process.argv.slice(2);
const IS_DRY_RUN = ARGS.includes('--dry-run') || ARGS.includes('-d');
const IS_FORCE = ARGS.includes('--force') || ARGS.includes('-f') || ARGS.includes('-y');

// --- Helper Functions ---

function getDirSize(dir) {
  let size = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      try {
        if (e.isDirectory()) {
          size += getDirSize(full);
        } else if (e.isFile()) {
          size += fs.statSync(full).size;
        }
      } catch (err) {}
    }
  } catch (err) {}
  return size;
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return bytes + ' B';
}

function parseVersion(vStr) {
  const clean = vStr.replace(/^app-/, '').replace(/^v/, '');
  const [main, pre] = clean.split('-');
  const parts = (main || '').split('.').map(n => parseInt(n, 10) || 0);
  return { parts, pre: pre || '', raw: vStr };
}

function compareVersions(aStr, bStr) {
  const a = parseVersion(aStr);
  const b = parseVersion(bStr);
  const len = Math.max(a.parts.length, b.parts.length);
  for (let i = 0; i < len; i++) {
    const pA = a.parts[i] || 0;
    const pB = b.parts[i] || 0;
    if (pA !== pB) return pA - pB;
  }
  if (!a.pre && b.pre) return 1;
  if (a.pre && !b.pre) return -1;
  if (a.pre && b.pre) return a.pre.localeCompare(b.pre);
  return 0;
}

function safeRemove(targetPath) {
  if (!fs.existsSync(targetPath)) return { success: true, freed: 0, note: 'Already absent' };
  const size = fs.statSync(targetPath).isDirectory() ? getDirSize(targetPath) : fs.statSync(targetPath).size;
  try {
    fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    return { success: true, freed: size, note: 'Deleted' };
  } catch (err) {
    try {
      execSync(`attrib -r "${targetPath}\\*.*" /s /d`, { stdio: 'ignore' });
      fs.rmSync(targetPath, { recursive: true, force: true });
      return { success: true, freed: size, note: 'Deleted after clearing attributes' };
    } catch (err2) {
      if (err2.code === 'EBUSY' || err2.code === 'EPERM') {
        return { success: false, freed: 0, note: 'File in use / Application running' };
      }
      return { success: false, freed: 0, note: err2.message };
    }
  }
}

// --- Scanning Modules ---

function scanSquirrelAndElectronApps() {
  const findings = [];
  const searchRoots = [
    LOCAL_APPDATA,
    path.join(LOCAL_APPDATA, 'Programs'),
    ROAMING_APPDATA
  ];

  for (const root of searchRoots) {
    if (!fs.existsSync(root)) continue;
    let apps;
    try {
      apps = fs.readdirSync(root, { withFileTypes: true });
    } catch (e) { continue; }

    for (const app of apps) {
      if (!app.isDirectory()) continue;
      const appPath = path.join(root, app.name);
      let subdirs;
      try {
        subdirs = fs.readdirSync(appPath, { withFileTypes: true }).filter(d => d.isDirectory());
      } catch (e) { continue; }

      // Pattern 1: Squirrel 'app-*' folders (e.g. app-1.2.3)
      const appVersionDirs = subdirs.filter(d => /^app-\d+/.test(d.name));
      if (appVersionDirs.length > 1) {
        appVersionDirs.sort((a, b) => compareVersions(b.name, a.name));
        const active = appVersionDirs[0];
        const obsolete = appVersionDirs.slice(1);

        for (const obs of obsolete) {
          const p = path.join(appPath, obs.name);
          findings.push({
            app: app.name,
            type: 'Squirrel App Version',
            current: active.name,
            obsolete: obs.name,
            path: p,
            size: getDirSize(p)
          });
        }
      }

      // Pattern 2: Pure numeric semver subdirs (e.g. Opera 138.x vs 137.x)
      const semverDirs = subdirs.filter(d => /^\d+(\.\d+){2,}/.test(d.name));
      if (semverDirs.length > 1 && !appPath.includes('node-gyp') && !appPath.includes('node_modules')) {
        semverDirs.sort((a, b) => compareVersions(b.name, a.name));
        const active = semverDirs[0];
        const obsolete = semverDirs.slice(1);

        for (const obs of obsolete) {
          const p = path.join(appPath, obs.name);
          findings.push({
            app: app.name,
            type: 'Application Old Build',
            current: active.name,
            obsolete: obs.name,
            path: p,
            size: getDirSize(p)
          });
        }
      }
    }
  }

  // Known multi-version developer tools in user profile
  const knownVersionRoots = [
    { name: 'Archon Web Dist', root: path.join(USER_PROFILE, '.archon', 'web-dist') },
    { name: 'CUA Driver Releases', root: path.join(USER_PROFILE, '.cua-driver', 'packages', 'releases') },
    { name: 'Copilot CLI Releases', root: path.join(LOCAL_APPDATA, 'copilot', 'pkg', 'win32-x64') },
    { name: 'Claude Code Versions', root: path.join(ROAMING_APPDATA, 'Claude', 'claude-code') },
    { name: 'Vite Plus Versions', root: path.join(LOCAL_APPDATA, 'vite-plus', 'data') }
  ];

  for (const kv of knownVersionRoots) {
    if (!fs.existsSync(kv.root)) continue;
    try {
      const subs = fs.readdirSync(kv.root, { withFileTypes: true }).filter(d => d.isDirectory() && /^\d+/.test(d.name));
      if (subs.length > 1) {
        subs.sort((a, b) => compareVersions(b.name, a.name));
        const active = subs[0];
        const obsolete = subs.slice(1);
        for (const obs of obsolete) {
          const p = path.join(kv.root, obs.name);
          findings.push({
            app: kv.name,
            type: 'Tool Release',
            current: active.name,
            obsolete: obs.name,
            path: p,
            size: getDirSize(p)
          });
        }
      }
    } catch (e) {}
  }

  return findings;
}

function scanOldNodeCaches() {
  const findings = [];

  // 1. node-gyp Cache
  const nodeGypCache = path.join(LOCAL_APPDATA, 'node-gyp', 'Cache');
  if (fs.existsSync(nodeGypCache)) {
    try {
      for (const item of fs.readdirSync(nodeGypCache)) {
        if (!item.startsWith(CURRENT_NODE_BASE)) {
          const p = path.join(nodeGypCache, item);
          findings.push({
            app: 'node-gyp Cache',
            type: 'Obsolete Node C++ Headers',
            current: `Node ${CURRENT_NODE_VERSION}`,
            obsolete: `Node ${item}`,
            path: p,
            size: getDirSize(p)
          });
        }
      }
    } catch (e) {}
  }

  // 2. Temp node-compile-cache
  const ncc = path.join(TEMP_DIR, 'node-compile-cache');
  if (fs.existsSync(ncc)) {
    try {
      for (const item of fs.readdirSync(ncc)) {
        if (!item.startsWith(CURRENT_NODE_VERSION)) {
          const p = path.join(ncc, item);
          findings.push({
            app: 'Node Bytecode Cache',
            type: 'V8 Compile Cache',
            current: CURRENT_NODE_VERSION,
            obsolete: item,
            path: p,
            size: getDirSize(p)
          });
        }
      }
    } catch (e) {}
  }

  // 3. Nested compile caches in Temp (e.g. t3code, etc.)
  if (fs.existsSync(TEMP_DIR)) {
    try {
      const topItems = fs.readdirSync(TEMP_DIR, { withFileTypes: true });
      for (const item of topItems) {
        if (!item.isDirectory()) continue;
        const subCache = path.join(TEMP_DIR, item.name, 'compile-cache');
        if (fs.existsSync(subCache)) {
          for (const sub of fs.readdirSync(subCache)) {
            if (!sub.startsWith(CURRENT_NODE_VERSION)) {
              const p = path.join(subCache, sub);
              findings.push({
                app: `${item.name} Cache`,
                type: 'V8 Compile Cache',
                current: CURRENT_NODE_VERSION,
                obsolete: sub,
                path: p,
                size: getDirSize(p)
              });
            }
          }
        }
      }
    } catch (e) {}
  }

  // 4. v8-compile-cache legacy
  const v8Legacy = path.join(TEMP_DIR, 'v8-compile-cache');
  if (fs.existsSync(v8Legacy)) {
    findings.push({
      app: 'V8 Legacy Cache',
      type: 'V8 Bytecode',
      current: 'Active Node',
      obsolete: 'Legacy cache folder',
      path: v8Legacy,
      size: getDirSize(v8Legacy)
    });
  }

  return findings;
}

function scanPackageManagers() {
  const findings = [];

  // npm cache (_cacache & _npx)
  const npmCache = path.join(LOCAL_APPDATA, 'npm-cache');
  if (fs.existsSync(npmCache)) {
    const cacache = path.join(npmCache, '_cacache');
    if (fs.existsSync(cacache)) {
      const size = getDirSize(cacache);
      if (size > 10 * 1024 * 1024) { // Only flag if > 10 MB
        findings.push({
          app: 'npm Cache (_cacache)',
          type: 'Global Tarballs',
          current: 'Remote Registry',
          obsolete: 'Accumulated tarballs',
          path: cacache,
          size
        });
      }
    }
    const npxCache = path.join(npmCache, '_npx');
    if (fs.existsSync(npxCache)) {
      const size = getDirSize(npxCache);
      if (size > 1024 * 1024) {
        findings.push({
          app: 'npm npx Cache',
          type: 'Temporary Binaries',
          current: 'None',
          obsolete: 'Temporary tool runs',
          path: npxCache,
          size
        });
      }
    }
  }

  return findings;
}

// --- Main Runner ---

async function main() {
  console.log('\n======================================================');
  console.log('   Universal Windows App & Cache Cleanup Utility');
  console.log('======================================================');
  console.log(`• Operating System: Windows`);
  console.log(`• Current Node.js:  ${CURRENT_NODE_VERSION}`);
  console.log(`• User Profile:     ${USER_PROFILE}`);
  console.log(`• Mode:             ${IS_DRY_RUN ? 'DRY RUN (Scan only)' : IS_FORCE ? 'FORCE (Auto-clean)' : 'INTERACTIVE'}`);
  console.log('------------------------------------------------------\n');

  console.log('🔍 Scanning for obsolete application versions and old Node caches...\n');

  const appFindings = scanSquirrelAndElectronApps();
  const nodeFindings = scanOldNodeCaches();
  const pkgFindings = scanPackageManagers();

  const allFindings = [...appFindings, ...nodeFindings, ...pkgFindings];

  if (allFindings.length === 0) {
    console.log('✨ System is already clean! No obsolete app versions or old Node caches found.');
    await prunePnpmIfAvailable(IS_DRY_RUN);
    return;
  }

  let totalReclaimable = 0;
  console.log('Identified Reclaimable Items:');
  console.log('--------------------------------------------------------------------------------');
  for (const item of allFindings) {
    totalReclaimable += item.size;
    console.log(`• [${item.app}] (${item.type})`);
    console.log(`    Current:  ${item.current}`);
    console.log(`    Obsolete: ${item.obsolete} -> ${formatSize(item.size)}`);
    console.log(`    Path:     ${item.path}\n`);
  }
  console.log('--------------------------------------------------------------------------------');
  console.log(`Estimated Total Space Reclaimable: ${formatSize(totalReclaimable)}\n`);

  if (IS_DRY_RUN) {
    console.log('ℹ️  Dry run finished. No files were modified or deleted.');
    return;
  }

  let proceed = IS_FORCE;
  if (!proceed) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => {
      rl.question(`Proceed with deleting these ${allFindings.length} obsolete items? (y/N): `, resolve);
    });
    rl.close();
    proceed = answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
  }

  if (!proceed) {
    console.log('❌ Cleanup aborted by user.');
    return;
  }

  console.log('\n🧹 Deleting obsolete files and caches...\n');

  let totalFreed = 0;
  let successCount = 0;
  let skippedCount = 0;

  for (const item of allFindings) {
    const res = safeRemove(item.path);
    if (res.success) {
      totalFreed += res.freed;
      successCount++;
      console.log(`✓ [Cleaned] ${item.app} (${formatSize(res.freed)})`);
    } else {
      skippedCount++;
      console.log(`⚠️ [Skipped] ${item.app}: ${res.note}`);
    }
  }

  // Prune pnpm store
  await prunePnpmIfAvailable(false);

  console.log('\n======================================================');
  console.log(`🎉 Cleanup Completed!`);
  console.log(`• Successfully cleaned items: ${successCount}`);
  if (skippedCount > 0) console.log(`• Skipped items (in use):    ${skippedCount}`);
  console.log(`• Total Disk Space Reclaimed: ${formatSize(totalFreed)}`);
  console.log('======================================================\n');
}

async function prunePnpmIfAvailable(isDryRun) {
  try {
    execSync('where.exe pnpm', { stdio: 'ignore' });
    console.log('\n📦 Checking pnpm store...');
    if (isDryRun) {
      console.log('  pnpm is installed. Running in live mode will execute `pnpm store prune`.');
    } else {
      console.log('  Running `pnpm store prune` to remove unreferenced packages...');
      const out = execSync('pnpm store prune', { encoding: 'utf8' });
      console.log('  ' + out.trim().replace(/\n/g, '\n  '));
    }
  } catch (e) {
    // pnpm not in PATH or not installed; skip cleanly
  }
}

main().catch(err => {
  console.error('\n❌ Unexpected error during cleanup:', err);
});
