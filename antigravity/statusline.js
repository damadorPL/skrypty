#!/usr/bin/env node
/**
 * Antigravity CLI Custom Statusline Script
 * 
 * Generates an adaptive, color-coded, informative status bar for Google Antigravity CLI (agy)
 * and Claude Code. Receives session state JSON via stdin and prints rendered statusline to stdout.
 * 
 * Features:
 *  - Responsive priority-based layout: dynamically fits segments to terminal width without wrapping.
 *  - Token & Cache Metrics: Breakdown of total tokens, in, out, and cache tokens.
 *  - Cache Hit / Miss: Hit percentage and hit/miss token counts.
 *  - Tool Usage: Total tool invocations, active tool, and top tools breakdown.
 *  - Subagents: Active and total subagents tracking.
 *  - Layout Modes:
 *      * 'stacked' (multi-line Claude Code style with 5 distinct tiers).
 *      * 'inline' (adaptive responsive priority-based single-line layout).
 *  - MCP & Context Files: Live count of configured MCP servers and context files (CLAUDE.md, GEMINI.md, Rules).
 *  - Visual progress bar & token metrics for LLM Context Window usage.
 *  - Real-time agent status indicators (idle, working, tool_use, reviewing, authenticating, error).
 *  - Model display name and thinking effort level.
 *  - Git repository branch and dirty status.
 *  - Working directory, sandbox status, active tasks, artifacts, and estimated cost.
 *  - Multiple aesthetic styles: default (modern unicode), minimal, ascii (compatibility), powerline, claude (stacked).
 *  - Zero external dependencies (uses native Node.js standard library).
 *  - Built-in --test, --demo, and --help modes for standalone verification.
 * 
 * Configuration in Antigravity CLI:
 *  - Slash command inside CLI:
 *      /statusline node <full-path-to-statusline.js> --layout=stacked
 *    or for adaptive single-line bar:
 *      /statusline node <full-path-to-statusline.js>
 *  - Or via settings.json (~/.gemini/antigravity-cli/settings.json):
 *      {
 *        "statusLine": {
 *          "type": "command",
 *          "command": "node <full-path-to-statusline.js> --layout=stacked"
 *        }
 *      }
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Parse CLI options
const ARGS = process.argv.slice(2);
const USE_ASCII = ARGS.includes('--ascii') || process.env.STATUSLINE_ASCII === '1';
const STYLE_ARG = (ARGS.find(a => a.startsWith('--style=')) || '').replace('--style=', '').toLowerCase() || process.env.STATUSLINE_STYLE || '';
const LAYOUT_ARG = (ARGS.find(a => a.startsWith('--layout=')) || '').replace('--layout=', '').toLowerCase() || process.env.STATUSLINE_LAYOUT || '';
const IS_STACKED = ARGS.includes('--stacked') || ARGS.includes('--claude') || LAYOUT_ARG === 'stacked' || STYLE_ARG === 'claude';
const NO_COLOR = Boolean(
  process.env.NO_COLOR || 
  process.env.NODE_DISABLE_COLORS || 
  ARGS.includes('--no-color')
);

// --- ANSI Escape Codes & Formatting Helpers ---

const C = {
  reset: NO_COLOR ? '' : '\x1b[0m',
  bold: NO_COLOR ? '' : '\x1b[1m',
  dim: NO_COLOR ? '' : '\x1b[2m',
  italic: NO_COLOR ? '' : '\x1b[3m',
  
  // Foreground Colors
  black: NO_COLOR ? '' : '\x1b[30m',
  red: NO_COLOR ? '' : '\x1b[31m',
  green: NO_COLOR ? '' : '\x1b[32m',
  yellow: NO_COLOR ? '' : '\x1b[33m',
  blue: NO_COLOR ? '' : '\x1b[34m',
  magenta: NO_COLOR ? '' : '\x1b[35m',
  cyan: NO_COLOR ? '' : '\x1b[36m',
  white: NO_COLOR ? '' : '\x1b[37m',
  gray: NO_COLOR ? '' : '\x1b[90m',
  
  // Bright Colors
  brightRed: NO_COLOR ? '' : '\x1b[91m',
  brightGreen: NO_COLOR ? '' : '\x1b[92m',
  brightYellow: NO_COLOR ? '' : '\x1b[93m',
  brightBlue: NO_COLOR ? '' : '\x1b[94m',
  brightMagenta: NO_COLOR ? '' : '\x1b[95m',
  brightCyan: NO_COLOR ? '' : '\x1b[96m',
  brightWhite: NO_COLOR ? '' : '\x1b[97m',
  
  // Background Colors
  bgRed: NO_COLOR ? '' : '\x1b[41m',
  bgGreen: NO_COLOR ? '' : '\x1b[42m',
  bgYellow: NO_COLOR ? '' : '\x1b[43m',
  bgBlue: NO_COLOR ? '' : '\x1b[44m',
  bgMagenta: NO_COLOR ? '' : '\x1b[45m',
  bgCyan: NO_COLOR ? '' : '\x1b[46m',
  bgDarkGray: NO_COLOR ? '' : '\x1b[100m'
};

/**
 * Strips ANSI color/escape sequences to measure visible character length.
 */
function stripAnsi(str) {
  if (!str) return '';
  return str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

function visibleLength(str) {
  return stripAnsi(str).length;
}

/**
 * Formats token counts into human-readable compact strings (e.g. 2, 15, 37k, 1.2M).
 */
function formatTokens(count) {
  if (typeof count !== 'number' || isNaN(count)) return '0';
  if (count >= 1_000_000) {
    const val = count / 1_000_000;
    const rounded = Math.round(val * 10) / 10;
    return (rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)) + 'M';
  }
  if (count >= 1_000) {
    const val = count / 1_000;
    const rounded = Math.round(val * 10) / 10;
    return (rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)) + 'k';
  }
  return String(Math.round(count));
}

/**
 * Formats duration in milliseconds into human readable string (e.g. <1m, 14m, 1h 19m).
 */
function formatDuration(ms) {
  if (typeof ms !== 'number' || isNaN(ms) || ms < 0) return '<1m';
  const totalMins = Math.floor(ms / 60000);
  if (totalMins < 1) return '<1m';
  if (totalMins < 60) return `${totalMins}m`;
  const hours = Math.floor(totalMins / 60);
  const remMins = totalMins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

/**
 * Formats visual progress bar for context window and usage metrics.
 */
function renderProgressBar(percentage, length = 10, isAscii = false, filledChar = '█', emptyChar = '░', customColor = null) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const filled = Math.round((clamped / 100) * length);
  const empty = length - filled;
  
  let color = customColor || C.brightGreen;
  if (!customColor) {
    if (clamped >= 85) {
      color = C.brightRed;
    } else if (clamped >= 60) {
      color = C.brightYellow;
    }
  }
  
  let bar = '';
  if (length > 0) {
    if (isAscii) {
      bar = `[${color}${'#'.repeat(filled)}${C.gray}${'-'.repeat(empty)}${C.reset}]`;
    } else {
      bar = `${color}${filledChar.repeat(filled)}${C.gray}${emptyChar.repeat(empty)}${C.reset}`;
    }
  }
  
  const pctStr = clamped % 1 === 0 ? clamped.toFixed(0) + '%' : clamped.toFixed(1) + '%';
  return { bar, color, pct: pctStr };
}

/**
 * Formats agent state with badge and color.
 */
function formatAgentState(state, isAscii = false) {
  const normState = (state || 'idle').toLowerCase();
  
  if (isAscii) {
    switch (normState) {
      case 'idle':
        return `${C.brightGreen}[IDLE]${C.reset}`;
      case 'working':
        return `${C.brightYellow}${C.bold}[WORKING]${C.reset}`;
      case 'tool_use':
        return `${C.brightCyan}${C.bold}[TOOL]${C.reset}`;
      case 'reviewing':
        return `${C.brightMagenta}${C.bold}[REVIEW]${C.reset}`;
      case 'authenticating':
        return `${C.brightYellow}${C.bold}[AUTH]${C.reset}`;
      case 'initializing':
        return `${C.gray}[INIT]${C.reset}`;
      case 'error':
        return `${C.bgRed}${C.brightWhite}${C.bold} [ERROR] ${C.reset}`;
      default:
        return `${C.cyan}[${normState.toUpperCase()}]${C.reset}`;
    }
  }

  switch (normState) {
    case 'idle':
      return `${C.brightGreen}● IDLE${C.reset}`;
    case 'working':
      return `${C.brightYellow}${C.bold}⚡ WORKING${C.reset}`;
    case 'tool_use':
      return `${C.brightCyan}${C.bold}⚙ TOOL${C.reset}`;
    case 'reviewing':
      return `${C.brightMagenta}${C.bold}🔍 REVIEW${C.reset}`;
    case 'authenticating':
      return `${C.brightYellow}${C.bold}🔑 AUTH${C.reset}`;
    case 'initializing':
      return `${C.gray}⏳ INIT${C.reset}`;
    case 'error':
      return `${C.bgRed}${C.brightWhite}${C.bold} ✖ ERROR ${C.reset}`;
    default:
      return `${C.cyan}● ${normState.toUpperCase()}${C.reset}`;
  }
}

/**
 * Searches for active conversation transcript.
 */
function findTranscriptPath(payload) {
  if (payload.transcript_path && fs.existsSync(payload.transcript_path)) {
    return payload.transcript_path;
  }

  const userHome = process.env.USERPROFILE || process.env.HOME || '';

  // Antigravity conversation_id from payload or env
  const convId = payload.conversation_id || process.env.CONVERSATION_ID;
  if (convId) {
    const candidate = path.join(userHome, '.gemini', 'antigravity-cli', 'brain', convId, '.system_generated', 'logs', 'transcript.jsonl');
    if (fs.existsSync(candidate)) return candidate;
  }

  // Check most recent conversation transcript in ~/.gemini/antigravity-cli/brain/*/
  try {
    const brainDir = path.join(userHome, '.gemini', 'antigravity-cli', 'brain');
    if (fs.existsSync(brainDir)) {
      const dirs = fs.readdirSync(brainDir);
      let latestFile = null;
      let latestMtime = 0;
      for (const d of dirs) {
        if (d === 'scratch' || d.startsWith('.')) continue;
        const candidate = path.join(brainDir, d, '.system_generated', 'logs', 'transcript.jsonl');
        try {
          const stat = fs.statSync(candidate);
          if (stat.mtimeMs > latestMtime) {
            latestMtime = stat.mtimeMs;
            latestFile = candidate;
          }
        } catch {}
      }
      if (latestFile) return latestFile;
    }
  } catch {}

  return null;
}

/**
 * Parses transcript with incremental file caching for sub-millisecond lookups.
 */
function getTranscriptStats(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;

  try {
    const stat = fs.statSync(filePath);
    const cacheFile = path.join(os.tmpdir(), 'agy_statusline_trans_cache.json');
    let cache = null;

    try {
      if (fs.existsSync(cacheFile)) {
        cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      }
    } catch {}

    if (cache && cache.filePath === filePath && cache.mtimeMs === stat.mtimeMs && cache.size === stat.size) {
      return cache.stats;
    }

    let stats = {
      totalIn: 0,
      totalOut: 0,
      totalCacheRead: 0,
      totalCacheCreation: 0,
      toolCounts: {},
      totalTools: 0,
      subagentsCount: 0,
      lastTool: null,
      startTime: null,
      endTime: null
    };

    let startByte = 0;
    if (cache && cache.filePath === filePath && cache.size < stat.size && cache.stats) {
      stats = cache.stats;
      startByte = cache.size;
    }

    const fd = fs.openSync(filePath, 'r');
    const bufSize = stat.size - startByte;
    const buf = Buffer.alloc(bufSize);
    fs.readSync(fd, buf, 0, bufSize, startByte);
    fs.closeSync(fd);

    const lines = buf.toString('utf8').split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line);
        if (item.created_at) {
          if (!stats.startTime) stats.startTime = item.created_at;
          stats.endTime = item.created_at;
        }

        // Antigravity format
        if (typeof item.input_tokens === 'number') stats.totalIn += item.input_tokens;
        if (typeof item.output_tokens === 'number') stats.totalOut += item.output_tokens;
        if (typeof item.cache_read_tokens === 'number') stats.totalCacheRead += item.cache_read_tokens;
        if (typeof item.cache_creation_tokens === 'number') stats.totalCacheCreation += item.cache_creation_tokens;

        // Claude Code usage format
        if (item.message && item.message.usage) {
          const u = item.message.usage;
          if (typeof u.input_tokens === 'number') stats.totalIn += u.input_tokens;
          if (typeof u.output_tokens === 'number') stats.totalOut += u.output_tokens;
          if (typeof u.cache_read_input_tokens === 'number') stats.totalCacheRead += u.cache_read_input_tokens;
          if (typeof u.cache_creation_input_tokens === 'number') stats.totalCacheCreation += u.cache_creation_input_tokens;
        }

        // Antigravity tool calls
        if (Array.isArray(item.tool_calls)) {
          for (const tc of item.tool_calls) {
            const name = tc.name || 'tool';
            stats.toolCounts[name] = (stats.toolCounts[name] || 0) + 1;
            stats.totalTools++;
            stats.lastTool = name;
            if (name === 'invoke_subagent') {
              stats.subagentsCount++;
            }
          }
        } else if (item.message && Array.isArray(item.message.content)) {
          // Claude Code tool calls
          for (const c of item.message.content) {
            if (c.type === 'tool_use') {
              const name = c.name || 'tool';
              stats.toolCounts[name] = (stats.toolCounts[name] || 0) + 1;
              stats.totalTools++;
              stats.lastTool = name;
              if (name === 'Agent' || name === 'Task' || name === 'invoke_subagent') {
                stats.subagentsCount++;
              }
            }
          }
        }
      } catch {}
    }

    try {
      fs.writeFileSync(cacheFile, JSON.stringify({
        filePath,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        stats
      }), 'utf8');
    } catch {}

    return stats;
  } catch (err) {
    return null;
  }
}

/**
 * Counts configured MCP servers in Antigravity and Claude Code.
 */
function getMcpCount() {
  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  
  // 1. Antigravity MCP directory
  const agyMcpDir = path.join(userHome, '.gemini', 'antigravity-cli', 'mcp');
  if (fs.existsSync(agyMcpDir)) {
    try {
      const dirs = fs.readdirSync(agyMcpDir, { withFileTypes: true }).filter(d => d.isDirectory());
      if (dirs.length > 0) return dirs.length;
    } catch {}
  }

  // 2. Claude ~/.claude.json
  const claudeCfg = path.join(userHome, '.claude.json');
  if (fs.existsSync(claudeCfg)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(claudeCfg, 'utf8'));
      const s = Object.keys(cfg.mcpServers || {});
      if (s.length > 0) return s.length;
    } catch {}
  }

  return 0;
}

/**
 * Discovers instruction/rules files in cwd or project root (e.g. CLAUDE.md, GEMINI.md).
 */
function getContextFiles(cwd) {
  const targetDir = cwd || process.cwd();
  const candidates = ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md', '.gemini/rules', '.claude/rules'];
  const found = [];
  for (const c of candidates) {
    try {
      if (fs.existsSync(path.join(targetDir, c))) {
        found.push(path.basename(c));
      }
    } catch {}
  }
  return found;
}

/**
 * Aggregates all metrics from payload and transcripts.
 */
function extractMetrics(payload) {
  const transPath = findTranscriptPath(payload);
  const trans = transPath ? getTranscriptStats(transPath) : null;

  const ctx = payload.context_window || {};
  const cwd = payload.cwd || payload.workspace?.current_dir || process.cwd();

  // Tokens
  const inTokens = typeof ctx.total_input_tokens === 'number'
    ? ctx.total_input_tokens
    : (payload.tokens?.in ?? trans?.totalIn ?? 0);

  const outTokens = typeof ctx.total_output_tokens === 'number'
    ? ctx.total_output_tokens
    : (payload.tokens?.out ?? trans?.totalOut ?? 0);

  const cacheReadTokens = typeof ctx.cache_read_tokens === 'number'
    ? ctx.cache_read_tokens
    : (typeof ctx.cache_read_input_tokens === 'number'
        ? ctx.cache_read_input_tokens
        : (payload.tokens?.cache ?? payload.cache?.read_tokens ?? trans?.totalCacheRead ?? 0));

  const cacheCreationTokens = typeof ctx.cache_creation_tokens === 'number'
    ? ctx.cache_creation_tokens
    : (payload.tokens?.cache_creation ?? payload.cache?.creation_tokens ?? trans?.totalCacheCreation ?? 0);

  const totalTokens = (typeof payload.tokens?.total === 'number')
    ? payload.tokens.total
    : (inTokens + outTokens + cacheReadTokens);

  // Cache hit / miss calculation
  const promptTotal = cacheReadTokens + inTokens;
  let cacheHitRate = null;
  let cacheMissRate = null;
  if (promptTotal > 0) {
    cacheHitRate = (cacheReadTokens / promptTotal) * 100;
    cacheMissRate = 100 - cacheHitRate;
  } else if (typeof payload.cache?.hit_rate === 'number') {
    cacheHitRate = payload.cache.hit_rate;
    cacheMissRate = 100 - cacheHitRate;
  }

  // Tools
  const toolCount = typeof payload.tool_count === 'number'
    ? payload.tool_count
    : (Array.isArray(payload.tools)
        ? payload.tools.length
        : (typeof payload.tools === 'number' ? payload.tools : (trans?.totalTools ?? 0)));

  const toolCounts = payload.tool_breakdown || payload.tool_usage || trans?.toolCounts || {};
  const activeTool = payload.active_tool || (payload.agent_state === 'tool_use' ? trans?.lastTool : null);

  // Subagents
  const subagentCount = typeof payload.subagent_count === 'number'
    ? payload.subagent_count
    : (Array.isArray(payload.subagents)
        ? payload.subagents.length
        : (typeof payload.subagents === 'number' ? payload.subagents : (trans?.subagentsCount ?? 0)));

  // MCPs & Context files
  const mcpCount = typeof payload.mcp_count === 'number' ? payload.mcp_count : getMcpCount();
  const contextFiles = payload.context_files || getContextFiles(cwd);

  // Duration
  let durationMs = payload.cost?.total_duration_ms || payload.duration_ms;
  if (!durationMs && trans?.startTime) {
    durationMs = Math.max(0, Date.now() - new Date(trans.startTime).getTime());
  }
  const durationStr = formatDuration(durationMs);

  // Rate limits / Usage
  const rateLimitUsed = payload.rate_limits?.five_hour?.used_percentage ?? payload.usage_percentage ?? null;
  let rateLimitResetsIn = payload.rate_limits?.resets_in || null;
  if (!rateLimitResetsIn && payload.rate_limits?.five_hour?.resets_at) {
    const diff = (payload.rate_limits.five_hour.resets_at * 1000) - Date.now();
    if (diff > 0) rateLimitResetsIn = formatDuration(diff);
  }

  // Context window percentage
  const maxTokens = ctx.context_window_size || 0;
  const usedPct = typeof ctx.used_percentage === 'number'
    ? ctx.used_percentage
    : (maxTokens > 0 ? (totalTokens / maxTokens) * 100 : 0);

  // User & Model
  const user = payload.user || process.env.USERNAME || process.env.USER || 'user';
  const modelName = payload.model?.display_name || payload.model?.id || 'Gemini 3.8 Flash';
  const effort = payload.model?.effort || null;

  return {
    user,
    cwd,
    modelName,
    effort,
    agentState: payload.agent_state || 'idle',
    usedPct,
    totalTokens,
    maxTokens,
    inTokens,
    outTokens,
    cacheReadTokens,
    cacheCreationTokens,
    cacheHitRate,
    cacheMissRate,
    toolCount,
    toolCounts,
    activeTool,
    subagentCount,
    mcpCount,
    contextFiles,
    durationStr,
    rateLimitUsed,
    rateLimitResetsIn,
    planTier: payload.plan_tier,
    modeText: payload.mode_text,
    vcs: payload.vcs,
    sandbox: payload.sandbox,
    taskCount: payload.task_count || 0,
    artifactCount: payload.artifact_count || 0,
    costEstimated: payload.cost?.estimated || payload.cost?.total_cost_usd || 0,
    terminalWidth: payload.terminal_width || (process.stdout.columns || 110)
  };
}

/**
 * Stacked Layout (Claude Code multi-line style).
 * Mirrors the 5-tier status bar:
 *  1: [Model] | User | Duration
 *  2: Context [bar] % | Usage [bar] % (resets in ...)
 *  3: Files | MCPs | Tools | Subagents | VCS | Sandbox
 *  4: Tokens Xk (in: X, out: X, cache: X) | Cache: XX% hit (hit/miss)
 *  5: >> auto mode on / Agent State badge
 */
function renderStackedLayout(m, isAscii = false) {
  const sep = `${C.gray} | ${C.reset}`;

  // --- Line 1: [Model] | User | Duration ---
  const modelSeg = `${C.brightCyan}[${m.modelName}]${C.reset}`;
  const userSeg = `${C.brightYellow}${m.user}${C.reset}`;
  const clockIcon = isAscii ? 'time:' : '⏱ ';
  const durSeg = `${C.gray}${clockIcon}${m.durationStr}${C.reset}`;
  const line1 = [modelSeg, userSeg, durSeg].join(sep);

  // --- Line 2: Context Bar | Usage / Quota Bar ---
  const ctxBar = renderProgressBar(m.usedPct, 8, isAscii, '█', '░', m.usedPct >= 60 ? null : C.brightGreen);
  const ctxSeg = `${C.gray}Context ${ctxBar.bar} ${C.brightGreen}${ctxBar.pct}${C.reset}`;

  let usageSeg = '';
  if (typeof m.rateLimitUsed === 'number') {
    const usageBar = renderProgressBar(m.rateLimitUsed, 8, isAscii, '█', '░', C.brightBlue);
    const resetNote = m.rateLimitResetsIn ? ` ${C.gray}(resets in ${m.rateLimitResetsIn})${C.reset}` : '';
    usageSeg = `${C.gray}Usage ${usageBar.bar} ${C.brightBlue}${usageBar.pct}${C.reset}${resetNote}`;
  } else if (m.planTier) {
    usageSeg = `${C.gray}Tier: ${C.brightWhite}${m.planTier}${C.reset}`;
  } else if (m.costEstimated > 0) {
    usageSeg = `${C.gray}Cost: ${C.brightWhite}$${m.costEstimated.toFixed(3)}${C.reset}`;
  }
  const line2 = usageSeg ? [ctxSeg, usageSeg].join(sep) : ctxSeg;

  // --- Line 3: Files | MCPs | Tools | Subagents | VCS ---
  const line3Parts = [];
  if (m.contextFiles && m.contextFiles.length > 0) {
    const count = m.contextFiles.length;
    const names = m.contextFiles.map(f => f.replace(/^\d+\s+/, '')).join(', ');
    line3Parts.push(`${C.gray}${count} ${names}${C.reset}`);
  }
  if (m.mcpCount > 0) {
    line3Parts.push(`${C.gray}${m.mcpCount} MCPs${C.reset}`);
  }
  if (m.toolCount > 0) {
    const icon = isAscii ? '' : '🛠️ ';
    const toolDetails = m.activeTool ? ` (${m.activeTool})` : '';
    line3Parts.push(`${C.cyan}${icon}${m.toolCount} ${m.toolCount === 1 ? 'tool' : 'tools'}${toolDetails}${C.reset}`);
  }
  if (m.subagentCount > 0) {
    const icon = isAscii ? '' : '🤖 ';
    line3Parts.push(`${C.brightMagenta}${icon}${m.subagentCount} ${m.subagentCount === 1 ? 'subagent' : 'subagents'}${C.reset}`);
  }
  if (m.vcs && m.vcs.branch) {
    const icon = isAscii ? 'git:' : ' ';
    const dirty = m.vcs.dirty ? `${C.brightYellow}*${C.reset}` : '';
    line3Parts.push(`${C.magenta}${icon}${m.vcs.branch}${dirty}${C.reset}`);
  }
  if (m.sandbox && m.sandbox.enabled) {
    line3Parts.push(isAscii ? `${C.green}[sbx]${C.reset}` : `${C.green}🛡️ sandbox${C.reset}`);
  }
  const line3 = line3Parts.length > 0 ? line3Parts.join(sep) : `${C.gray}📁 ${path.basename(m.cwd)}${C.reset}`;

  // --- Line 4: Tokens (in, out, cache) | Cache hit / miss ---
  const totalFmt = formatTokens(m.totalTokens);
  const inFmt = formatTokens(m.inTokens);
  const outFmt = formatTokens(m.outTokens);
  const cacheFmt = formatTokens(m.cacheReadTokens);

  const tokSeg = `${C.gray}Tokens ${C.bold}${C.brightWhite}${totalFmt}${C.reset} ${C.gray}(in: ${C.white}${inFmt}${C.gray}, out: ${C.white}${outFmt}${C.gray}, cache: ${C.cyan}${cacheFmt}${C.gray})${C.reset}`;

  let cacheSeg = '';
  if (m.cacheHitRate !== null && m.cacheReadTokens > 0) {
    const hitColor = m.cacheHitRate >= 80 ? C.brightGreen : (m.cacheHitRate >= 50 ? C.brightYellow : C.brightRed);
    const hitPctStr = m.cacheHitRate >= 99.9 ? '99.9%' : (m.cacheHitRate === 100 ? '100%' : m.cacheHitRate.toFixed(0) + '%');
    const missFmt = formatTokens(m.inTokens);
    const hitFmt = formatTokens(m.cacheReadTokens);
    const breakdown = m.inTokens > 0 ? ` ${C.dim}(${hitFmt} hit, ${missFmt} miss)${C.reset}` : '';
    cacheSeg = `${C.gray}Cache: ${hitColor}${hitPctStr} hit${C.reset}${breakdown}`;
  }

  const line4 = cacheSeg ? [tokSeg, cacheSeg].join(sep) : tokSeg;

  // --- Line 5: Mode / Status Prompt ---
  let line5 = '';
  if (m.modeText) {
    const arrow = isAscii ? '>> ' : '▸▸ ';
    line5 = `${C.brightYellow}${arrow}${m.modeText}${C.reset}`;
  } else {
    const stateBadge = formatAgentState(m.agentState, isAscii);
    line5 = `${stateBadge} ${C.dim}(Antigravity CLI)${C.reset}`;
  }

  return [line1, line2, line3, line4, line5].join('\n');
}

/**
 * Adaptive Inline Layout (Single-Line).
 * Responsively packs segments according to terminal width.
 */
function renderInlineLayout(m, options = {}) {
  const isAscii = options.ascii || USE_ASCII;
  const style = options.style || STYLE_ARG || 'default';
  const termWidth = m.terminalWidth;

  // Separators
  let sep = `${C.gray} │ ${C.reset}`;
  if (style === 'minimal') sep = `${C.gray} • ${C.reset}`;
  if (style === 'powerline') sep = `${C.gray}  ${C.reset}`;
  if (isAscii) sep = `${C.gray} | ${C.reset}`;

  // 1. Agent State
  const stateSeg = formatAgentState(m.agentState, isAscii);

  // 2. Model & Effort
  const effortSeg = m.effort ? `${C.dim}[${m.effort}]${C.reset}` : '';
  const modelFull = `${C.bold}${C.brightWhite}${m.modelName}${C.reset}${effortSeg ? ' ' + effortSeg : ''}`;
  const modelShort = `${C.bold}${C.brightWhite}${m.modelName.replace(/^Gemini\s+/i, '')}${C.reset}`;

  // 3. Tokens & Cache
  const totalFmt = formatTokens(m.totalTokens);
  const inFmt = formatTokens(m.inTokens);
  const outFmt = formatTokens(m.outTokens);
  const cacheFmt = formatTokens(m.cacheReadTokens);

  const tokFullSeg = `${C.gray}Tokens ${C.bold}${C.brightWhite}${totalFmt}${C.reset} ${C.dim}(in:${inFmt}, out:${outFmt}, cache:${cacheFmt})${C.reset}`;
  const tokShortSeg = `${C.gray}Tok ${C.brightWhite}${totalFmt}${C.reset}`;

  // 4. Cache Hit Rate
  let cacheHitSeg = '';
  if (m.cacheHitRate !== null && m.cacheReadTokens > 0) {
    const hitColor = m.cacheHitRate >= 80 ? C.brightGreen : (m.cacheHitRate >= 50 ? C.brightYellow : C.brightRed);
    const hitPctStr = m.cacheHitRate >= 99.9 ? '99.9%' : (m.cacheHitRate === 100 ? '100%' : m.cacheHitRate.toFixed(0) + '%');
    const icon = isAscii ? 'cache:' : '⚡ ';
    cacheHitSeg = `${hitColor}${icon}${hitPctStr} hit${C.reset}`;
  }

  // 5. Tools & Subagents
  let toolsSeg = '';
  if (m.toolCount > 0) {
    const icon = isAscii ? '' : '🛠️ ';
    toolsSeg = `${C.cyan}${icon}${m.toolCount} ${m.toolCount === 1 ? 'tool' : 'tools'}${C.reset}`;
  }

  let subagentSeg = '';
  if (m.subagentCount > 0) {
    const icon = isAscii ? '' : '🤖 ';
    subagentSeg = `${C.brightMagenta}${icon}${m.subagentCount} ${m.subagentCount === 1 ? 'subagent' : 'subagents'}${C.reset}`;
  }

  // 6. VCS
  let gitSeg = '';
  if (m.vcs && m.vcs.branch) {
    const branch = m.vcs.branch;
    const dirty = m.vcs.dirty ? `${C.brightYellow}*${C.reset}` : '';
    const icon = isAscii ? 'git:' : ' ';
    gitSeg = `${C.magenta}${icon}${branch}${dirty}${C.reset}`;
  }

  // 7. CWD
  let cwdSeg = '';
  if (m.cwd) {
    const folder = path.basename(m.cwd) || m.cwd;
    const icon = isAscii ? '' : '📁 ';
    cwdSeg = `${C.cyan}${icon}${folder}${C.reset}`;
  }

  // 8. Sandbox & Meta
  let sandboxSeg = '';
  if (m.sandbox && m.sandbox.enabled) {
    sandboxSeg = isAscii ? `${C.green}[sbx]${C.reset}` : `${C.green}🛡️ sandbox${C.reset}`;
  }

  let tasksSeg = '';
  if (m.taskCount > 0) {
    const icon = isAscii ? '' : '⚡ ';
    tasksSeg = `${C.brightYellow}${icon}${m.taskCount} ${m.taskCount === 1 ? 'task' : 'tasks'}${C.reset}`;
  }

  let artifactsSeg = '';
  if (m.artifactCount > 0) {
    const icon = isAscii ? '' : '📄 ';
    artifactsSeg = `${C.blue}${icon}${m.artifactCount} ${m.artifactCount === 1 ? 'art' : 'arts'}${C.reset}`;
  }

  let costSeg = '';
  if (m.costEstimated > 0) {
    costSeg = `${C.dim}$${m.costEstimated.toFixed(3)}${C.reset}`;
  }

  // Progress Bar lengths to attempt
  const barLengths = termWidth >= 135 ? [10, 8, 6, 0] : (termWidth >= 95 ? [8, 6, 0] : [0]);

  for (const barLen of barLengths) {
    const { bar, color, pct } = renderProgressBar(m.usedPct, barLen, isAscii);
    const tokenInfo = (barLen === 10 && m.maxTokens > 0)
      ? ` ${C.dim}(${formatTokens(m.totalTokens)}/${formatTokens(m.maxTokens)})${C.reset}`
      : '';
    const ctxSeg = barLen > 0 ? `${bar} ${color}${pct}${C.reset}${tokenInfo}` : `${color}${pct}${C.reset}`;

    // Candidate segment combinations in priority order
    const candidateSets = [
      // 1. Everything
      [stateSeg, modelFull, ctxSeg, tokFullSeg, cacheHitSeg, toolsSeg, subagentSeg, gitSeg, cwdSeg, sandboxSeg, tasksSeg, artifactsSeg, costSeg],
      // 2. Drop cost, artifacts, tasks, sandbox
      [stateSeg, modelFull, ctxSeg, tokFullSeg, cacheHitSeg, toolsSeg, subagentSeg, gitSeg, cwdSeg],
      // 3. Drop subagents & CWD (keep full token breakdown)
      [stateSeg, modelFull, ctxSeg, tokFullSeg, cacheHitSeg, toolsSeg, gitSeg],
      // 4. Compact tokens
      [stateSeg, modelFull, ctxSeg, tokShortSeg, cacheHitSeg, toolsSeg, gitSeg, cwdSeg],
      // 5. Short model & drop tools
      [stateSeg, modelShort, ctxSeg, tokShortSeg, cacheHitSeg, gitSeg, cwdSeg],
      // 6. Drop cache & CWD
      [stateSeg, modelShort, ctxSeg, tokShortSeg, gitSeg],
      // 7. Minimal: State, Model, Ctx, Short Tokens
      [stateSeg, modelShort, ctxSeg, tokShortSeg],
      // 8. Bare minimum
      [stateSeg, modelShort, ctxSeg]
    ];

    for (const candidates of candidateSets) {
      const active = candidates.filter(Boolean);
      const line = active.join(sep);
      if (visibleLength(line) <= termWidth) {
        return line;
      }
    }
  }

  // Ultimate fallback
  const { color, pct } = renderProgressBar(m.usedPct, 0, isAscii);
  return `${stateSeg} ${color}${pct}${C.reset}`;
}

/**
 * Main Statusline Renderer.
 */
function renderStatusline(payload, options = {}) {
  if (!payload || typeof payload !== 'object') {
    return `${C.gray}[antigravity]${C.reset}`;
  }

  const isAscii = options.ascii || USE_ASCII;
  const metrics = extractMetrics(payload);
  const isStacked = options.stacked || IS_STACKED;

  if (isStacked) {
    return renderStackedLayout(metrics, isAscii);
  }

  return renderInlineLayout(metrics, options);
}

// --- CLI Modes: --test, --demo, --help, or Stdin Stream ---

function runDemo() {
  console.log(`\n${C.bold}${C.brightCyan}=== Antigravity & Claude CLI Statusline Demo ===${C.reset}\n`);

  const sampleStates = ['idle', 'working', 'tool_use', 'reviewing', 'error'];
  const samplePcts = [4.2, 35.8, 62.4, 88.9, 94.5];

  console.log(`${C.bold}${C.brightWhite}[Mode 1: Stacked Layout - Similar to Claude Code Screenshot]${C.reset}\n`);

  const demoClaudePayload = {
    product: 'antigravity',
    user: 'damador',
    duration_ms: 45000,
    cwd: process.cwd(),
    agent_state: 'idle',
    model: {
      id: 'claude-3-5-sonnet',
      display_name: 'Opus 5.5'
    },
    context_window: {
      total_input_tokens: 2,
      total_output_tokens: 15,
      cache_read_tokens: 37000,
      context_window_size: 200000,
      used_percentage: 4.0
    },
    rate_limits: {
      five_hour: {
        used_percentage: 47.0
      },
      resets_in: '1h 19m'
    },
    context_files: ['CLAUDE.md'],
    mcp_count: 2,
    tool_count: 8,
    subagent_count: 1,
    vcs: {
      branch: 'main',
      dirty: false
    },
    mode_text: 'auto mode on (shift+tab to cycle)'
  };

  console.log(renderStackedLayout(extractMetrics(demoClaudePayload), false));
  console.log('\n' + '─'.repeat(80) + '\n');

  console.log(`${C.bold}${C.brightWhite}[Mode 2: Live Antigravity Metrics in Stacked Layout]${C.reset}\n`);
  const demoAgyStacked = {
    user: 'damador',
    duration_ms: 780000,
    cwd: process.cwd(),
    agent_state: 'working',
    model: {
      id: 'gemini-3.8-flash',
      display_name: 'Gemini 3.8 Flash',
      effort: 'high'
    },
    context_window: {
      total_input_tokens: 376000,
      total_output_tokens: 31000,
      cache_read_tokens: 3840000,
      context_window_size: 1048576,
      used_percentage: 24.5
    },
    plan_tier: 'Pro',
    tool_count: 86,
    subagent_count: 2,
    mcp_count: 4,
    vcs: { branch: 'main', dirty: true },
    sandbox: { enabled: true },
    mode_text: 'working on code updates'
  };
  console.log(renderStackedLayout(extractMetrics(demoAgyStacked), false));
  console.log('\n' + '─'.repeat(80) + '\n');

  console.log(`${C.bold}${C.brightWhite}[Mode 3: Adaptive Inline Single-Line Layouts]${C.reset}\n`);

  sampleStates.forEach((state, i) => {
    const dummyPayload = {
      product: 'antigravity',
      cwd: process.cwd(),
      agent_state: state,
      terminal_width: 140,
      artifact_count: i === 2 ? 3 : 0,
      task_count: i === 1 ? 2 : 0,
      tool_count: 12 * (i + 1),
      subagent_count: i === 1 ? 1 : 0,
      model: {
        id: 'gemini-3.8-flash',
        display_name: 'Gemini 3.8 Flash',
        effort: 'high'
      },
      context_window: {
        total_input_tokens: Math.round(45000 * (i + 1)),
        total_output_tokens: 4200,
        cache_read_tokens: Math.round(350000 * (i + 1)),
        context_window_size: 1048576,
        used_percentage: samplePcts[i]
      },
      vcs: {
        type: 'git',
        branch: 'main',
        dirty: i % 2 === 1
      },
      sandbox: {
        enabled: true
      },
      cost: {
        estimated: 0.025 * (i + 1)
      }
    };

    console.log(`${C.dim}[State: ${state}, Width: 140]${C.reset}`);
    console.log(renderInlineLayout(extractMetrics(dummyPayload), {}));
    console.log();
  });

  console.log(`${C.dim}[Adaptive Narrow: Width 85]${C.reset}`);
  console.log(renderInlineLayout(extractMetrics({
    agent_state: 'working',
    terminal_width: 85,
    model: { display_name: 'Gemini 3.8 Flash' },
    context_window: {
      total_input_tokens: 12000,
      total_output_tokens: 1500,
      cache_read_tokens: 140000,
      used_percentage: 42.1
    },
    tool_count: 14,
    vcs: { branch: 'feat/statusline', dirty: true },
    cwd: process.cwd()
  }), {}));
  console.log();

  console.log(`${C.dim}[ASCII Compatibility Mode]${C.reset}`);
  console.log(renderInlineLayout(extractMetrics({
    agent_state: 'tool_use',
    terminal_width: 100,
    model: { display_name: 'Gemini 3.8 Flash' },
    context_window: {
      total_input_tokens: 5000,
      total_output_tokens: 800,
      cache_read_tokens: 85000,
      used_percentage: 28.0
    },
    tool_count: 5,
    subagent_count: 1,
    vcs: { branch: 'main', dirty: false },
    cwd: process.cwd()
  }), { ascii: true }));
  console.log();
}

function showHelp() {
  console.log(`
${C.bold}Antigravity & Claude CLI Statusline Script${C.reset}

${C.yellow}Konfiguracja w Antigravity CLI (agy):${C.reset}
  1. Za pomocą komendy ukośnika wewnątrz TUI:
     - Styl wielowierszowy (Claude Code stacked layout):
       ${C.cyan}/statusline node "${__filename.replace(/\\/g, '/')}" --layout=stacked${C.reset}
     
     - Styl jednoliniowy (adaptive responsive inline):
       ${C.cyan}/statusline node "${__filename.replace(/\\/g, '/')}"${C.reset}

  2. Lub w pliku konfiguracyjnym settings.json (~/.gemini/antigravity-cli/settings.json):
     {
       "statusLine": {
         "type": "command",
         "command": "node \\"${__filename.replace(/\\/g, '\\\\')}\\" --layout=stacked"
       }
     }

${C.yellow}Opcje wiersza poleceń i tryby pracy:${C.reset}
  --layout=stacked    Układ wielowierszowy (5 wierszy z metrykami jak w Claude Code)
  --layout=inline     Układ jednoliniowy, adaptujący się do szerokości okna
  --style=claude      Synonim dla --layout=stacked
  --style=minimal     Zwarte separatory punktowe (•)
  --style=powerline   Separatory w stylu Powerline ()
  --ascii             Wymusza tryb czystego ASCII (brak symboli UTF-8/Nerd Font)
  --no-color          Wyłącza sekwencje kolorów ANSI
  --test              Wykonuje natychmiastowy test z przykładowym stanem
  --demo              Wyświetla pełną demonstrację wszystkich trybów i stanów
  --help              Wyświetla ten ekran pomocy

${C.yellow}Nowe metryki:${C.reset}
  - Tokens: total (in: ..., out: ..., cache: ...)
  - Cache Hit / Miss: procent trafień pamięci podręcznej oraz rozbicie hit/miss
  - Tool Usage: łączna liczba wywołań narzędzi oraz aktywne narzędzie
  - Subagents: liczba uruchomionych i aktywnych podagentów
  - MCPs & Files: liczba serwerów MCP oraz plików reguł (CLAUDE.md, GEMINI.md)
`);
}

// Entrypoint
function main() {
  if (ARGS.includes('--help') || ARGS.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  if (ARGS.includes('--demo')) {
    runDemo();
    process.exit(0);
  }

  if (ARGS.includes('--test')) {
    const testPayload = {
      product: 'antigravity',
      agent_state: 'idle',
      terminal_width: process.stdout.columns || 120,
      cwd: process.cwd(),
      model: {
        id: 'gemini-3.8-flash',
        display_name: 'Gemini 3.8 Flash',
        effort: 'high'
      },
      context_window: {
        total_input_tokens: 145000,
        total_output_tokens: 12000,
        cache_read_tokens: 1250000,
        context_window_size: 1048576,
        used_percentage: 14.97
      },
      vcs: {
        type: 'git',
        branch: 'main',
        dirty: false
      },
      sandbox: {
        enabled: true
      },
      tool_count: 24,
      subagent_count: 1,
      mcp_count: 4,
      cost: {
        estimated: 0.015
      }
    };
    console.log(renderStatusline(testPayload));
    process.exit(0);
  }

  // Interactive TTY fallback (when user runs `node statusline.js` directly in terminal)
  if (process.stdin.isTTY) {
    showHelp();
    process.exit(0);
  }

  // Standard Stdin ingestion mode (when invoked by Antigravity CLI or Claude Code)
  let inputData = '';
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', chunk => {
    inputData += chunk;
  });

  process.stdin.on('end', () => {
    if (!inputData.trim()) {
      process.exit(0);
    }

    try {
      const payload = JSON.parse(inputData);
      const rendered = renderStatusline(payload);
      process.stdout.write(rendered + '\n');
    } catch (err) {
      process.stdout.write(`${C.gray}[antigravity statusline: invalid payload]${C.reset}\n`);
    }
  });

  process.stdin.on('error', () => {
    process.exit(0);
  });
}

main();
