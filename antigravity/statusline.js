#!/usr/bin/env node
/**
 * Antigravity CLI Custom Statusline Script
 * 
 * Generates an adaptive, color-coded, informative status bar for Google Antigravity CLI (agy).
 * Receives the session state JSON payload via standard input (stdin) and outputs the rendered
 * statusline to standard output (stdout).
 * 
 * Features:
 *  - Responsive priority-based layout: dynamically fits segments to terminal width without wrapping.
 *  - Visual progress bar & token metrics for LLM Context Window usage.
 *  - Real-time agent status indicators (idle, working, tool_use, reviewing, authenticating, error).
 *  - Model display name and thinking effort level.
 *  - Git repository branch and dirty status.
 *  - Working directory, sandbox status, active tasks, artifacts, and estimated cost.
 *  - Multiple aesthetic styles: default (modern unicode), minimal, ascii (compatibility), powerline.
 *  - Zero external dependencies (uses native Node.js standard library).
 *  - Built-in --test, --demo, and --help modes for standalone verification.
 * 
 * Configuration in Antigravity CLI:
 *  - Slash command inside CLI:
 *      /statusline node <full-path-to-statusline.js>
 *  - Or via settings.json (~/.gemini/antigravity-cli/settings.json):
 *      {
 *        "statusLine": {
 *          "type": "command",
 *          "command": "node <full-path-to-statusline.js>"
 *        }
 *      }
 */

const path = require('path');

// Parse CLI options
const ARGS = process.argv.slice(2);
const USE_ASCII = ARGS.includes('--ascii') || process.env.STATUSLINE_ASCII === '1';
const STYLE_ARG = (ARGS.find(a => a.startsWith('--style=')) || '').replace('--style=', '').toLowerCase();
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
 * Strips ANSI color/escape sequences from a string to measure visible width.
 */
function stripAnsi(str) {
  if (!str) return '';
  return str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

/**
 * Returns visible character length of string with ANSI codes.
 */
function visibleLength(str) {
  return stripAnsi(str).length;
}

/**
 * Format token count into human-readable compact string (e.g. 1.2k, 1.0M).
 */
function formatTokens(count) {
  if (typeof count !== 'number' || isNaN(count)) return '0';
  if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + 'M';
  if (count >= 1_000) return (count / 1_000).toFixed(1) + 'k';
  return String(count);
}

/**
 * Formats a visual progress bar for context window tokens.
 */
function renderProgressBar(percentage, length = 10, isAscii = false) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const filled = Math.round((clamped / 100) * length);
  const empty = length - filled;
  
  let color = C.brightGreen;
  if (clamped >= 85) {
    color = C.brightRed;
  } else if (clamped >= 60) {
    color = C.brightYellow;
  }
  
  let bar = '';
  if (length > 0) {
    if (isAscii) {
      bar = `[${color}${'#'.repeat(filled)}${C.gray}${'-'.repeat(empty)}${C.reset}]`;
    } else {
      bar = `${color}${'█'.repeat(filled)}${C.gray}${'░'.repeat(empty)}${C.reset}`;
    }
  }
  
  return { bar, color, pct: clamped.toFixed(1) + '%' };
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
 * Main Statusline Renderer.
 * Prioritizes segments and dynamically adapts to available terminal width.
 */
function renderStatusline(payload, options = {}) {
  if (!payload || typeof payload !== 'object') {
    return `${C.gray}[antigravity]${C.reset}`;
  }

  const isAscii = options.ascii || USE_ASCII;
  const style = options.style || STYLE_ARG || 'default';
  const termWidth = payload.terminal_width || (process.stdout.columns || 100);

  // Separators
  let sep = `${C.gray} │ ${C.reset}`;
  if (style === 'minimal') sep = `${C.gray} • ${C.reset}`;
  if (style === 'powerline') sep = `${C.gray}  ${C.reset}`;
  if (isAscii) sep = `${C.gray} | ${C.reset}`;

  // 1. Agent State (Highest Priority)
  const stateSeg = formatAgentState(payload.agent_state, isAscii);

  // 2. Model & Effort (Highest Priority)
  const rawModel = payload.model?.display_name || payload.model?.id || 'Gemini';
  const effort = payload.model?.effort ? `${C.dim}[${payload.model.effort}]${C.reset}` : '';
  const modelFull = `${C.bold}${C.brightWhite}${rawModel}${C.reset}${effort ? ' ' + effort : ''}`;
  const modelShort = `${C.bold}${C.brightWhite}${rawModel.replace(/^Gemini\s+/i, '')}${C.reset}`;

  // 3. Context Window Usage
  const ctx = payload.context_window || {};
  const usedPct = typeof ctx.used_percentage === 'number' 
    ? ctx.used_percentage 
    : (ctx.context_window_size && ctx.total_input_tokens 
        ? ((ctx.total_input_tokens + (ctx.total_output_tokens || 0)) / ctx.context_window_size) * 100 
        : 0);

  const totalTokens = (ctx.total_input_tokens || 0) + (ctx.total_output_tokens || 0);
  const maxTokens = ctx.context_window_size || 0;

  // 4. Git / VCS
  let gitSeg = '';
  if (payload.vcs && payload.vcs.branch) {
    const branch = payload.vcs.branch;
    const dirty = payload.vcs.dirty ? `${C.brightYellow}*${C.reset}` : '';
    const icon = isAscii ? 'git:' : ' ';
    gitSeg = `${C.magenta}${icon}${C.brightMagenta}${branch}${dirty}${C.reset}`;
  }

  // 5. CWD
  const currentCwd = payload.cwd || process.cwd();
  let cwdSeg = '';
  if (currentCwd) {
    const folder = path.basename(currentCwd) || currentCwd;
    const icon = isAscii ? '' : '📁 ';
    cwdSeg = `${C.cyan}${icon}${folder}${C.reset}`;
  }

  // 6. Secondary / Metadata Segments
  let sandboxSeg = '';
  if (payload.sandbox && payload.sandbox.enabled) {
    sandboxSeg = isAscii ? `${C.green}[sbx]${C.reset}` : `${C.green}🛡️ sandbox${C.reset}`;
  }

  let tasksSeg = '';
  if (payload.task_count && payload.task_count > 0) {
    const icon = isAscii ? '' : '⚡ ';
    tasksSeg = `${C.brightYellow}${icon}${payload.task_count} ${payload.task_count === 1 ? 'task' : 'tasks'}${C.reset}`;
  }

  let artifactsSeg = '';
  if (payload.artifact_count && payload.artifact_count > 0) {
    const icon = isAscii ? '' : '📄 ';
    artifactsSeg = `${C.blue}${icon}${payload.artifact_count} ${payload.artifact_count === 1 ? 'art' : 'arts'}${C.reset}`;
  }

  let costSeg = '';
  if (payload.cost && typeof payload.cost.estimated === 'number' && payload.cost.estimated > 0) {
    costSeg = `${C.dim}$${payload.cost.estimated.toFixed(3)}${C.reset}`;
  }

  // --- Dynamic Segment Packing ---
  // Try wide layouts first, gracefully degrading if width is exceeded.

  const barLengths = termWidth >= 120 ? [10, 8, 6, 0] : (termWidth >= 85 ? [8, 6, 0] : [0]);

  for (const barLen of barLengths) {
    const { bar, color, pct } = renderProgressBar(usedPct, barLen, isAscii);
    const tokenInfo = (barLen === 10 && maxTokens > 0)
      ? ` ${C.dim}(${formatTokens(totalTokens)}/${formatTokens(maxTokens)})${C.reset}`
      : '';
    const ctxSeg = barLen > 0 ? `${bar} ${color}${pct}${C.reset}${tokenInfo}` : `${color}${pct}${C.reset}`;

    // Candidates in priority order
    const candidateSets = [
      // 1. Everything
      [stateSeg, modelFull, ctxSeg, gitSeg, cwdSeg, sandboxSeg, tasksSeg, artifactsSeg, costSeg],
      // 2. Drop cost & artifacts
      [stateSeg, modelFull, ctxSeg, gitSeg, cwdSeg, sandboxSeg, tasksSeg],
      // 3. Drop tasks
      [stateSeg, modelFull, ctxSeg, gitSeg, cwdSeg, sandboxSeg],
      // 4. Drop sandbox
      [stateSeg, modelFull, ctxSeg, gitSeg, cwdSeg],
      // 5. Short model name
      [stateSeg, modelShort, ctxSeg, gitSeg, cwdSeg],
      // 6. Drop CWD
      [stateSeg, modelShort, ctxSeg, gitSeg],
      // 7. Minimal (State, Model, Ctx)
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

  // Ultimate fallback if terminal is extremely narrow
  const { color, pct } = renderProgressBar(usedPct, 0, isAscii);
  return `${stateSeg} ${color}${pct}${C.reset}`;
}

// --- CLI Modes: --test, --demo, --help, or Stdin Stream ---

function runDemo() {
  console.log(`\n${C.bold}${C.brightCyan}=== Antigravity CLI Statusline Demo ===${C.reset}\n`);

  const sampleStates = ['idle', 'working', 'tool_use', 'reviewing', 'error'];
  const samplePcts = [14.2, 45.8, 68.2, 88.9, 94.5];

  sampleStates.forEach((state, i) => {
    const dummyPayload = {
      product: 'antigravity',
      version: '1.2.0',
      conversation_id: '7c16df7a-144e-4739-8750-ab00559b1114',
      cwd: process.cwd(),
      agent_state: state,
      plan_tier: 'Pro',
      terminal_width: 125,
      artifact_count: i === 2 ? 3 : 0,
      task_count: i === 1 ? 2 : 0,
      model: {
        id: 'gemini-3.8-flash',
        display_name: 'Gemini 3.8 Flash',
        effort: 'high'
      },
      context_window: {
        total_input_tokens: Math.round(1048576 * (samplePcts[i] / 100)),
        total_output_tokens: 4200,
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

    console.log(`${C.dim}[State: ${state}, Width: 125]${C.reset}`);
    console.log(renderStatusline(dummyPayload));
    console.log();
  });

  console.log(`${C.dim}[Adaptive Narrow: Width 75]${C.reset}`);
  console.log(renderStatusline({
    agent_state: 'working',
    terminal_width: 75,
    model: { display_name: 'Gemini 3.8 Flash' },
    context_window: { used_percentage: 42.1 },
    vcs: { branch: 'feat/statusline', dirty: true },
    cwd: process.cwd()
  }));
  console.log();

  console.log(`${C.dim}[ASCII Compatibility Mode]${C.reset}`);
  console.log(renderStatusline({
    agent_state: 'tool_use',
    terminal_width: 90,
    model: { display_name: 'Gemini 3.8 Flash' },
    context_window: { used_percentage: 55.0 },
    vcs: { branch: 'main', dirty: false },
    cwd: process.cwd()
  }, { ascii: true }));
  console.log();
}

function showHelp() {
  console.log(`
${C.bold}Antigravity CLI Statusline Script${C.reset}

${C.yellow}Konfiguracja w Antigravity CLI (agy):${C.reset}
  1. Za pomocą komendy ukośnika wewnątrz TUI:
     ${C.cyan}/statusline node "${__filename.replace(/\\/g, '/')}"${C.reset}

  2. Lub w pliku konfiguracyjnym settings.json (~/.gemini/antigravity-cli/settings.json):
     {
       "statusLine": {
         "type": "command",
         "command": "node \\"${__filename.replace(/\\/g, '\\\\')}\\""
       }
     }

${C.yellow}Opcje uruchomienia i testowania:${C.reset}
  node statusline.js --test           Wykonuje natychmiastowy test z przykładowym stanem
  node statusline.js --demo           Wyświetla demonstrację wszystkich stanów agenta i trybów
  node statusline.js --ascii          Wymusza tryb czystego ASCII (bez znaków UTF-8/Nerd Font)
  node statusline.js --style=minimal  Używa zwartych separatorów punktowych (•)
  node statusline.js --no-color       Wyłącza formatowanie ANSI

${C.yellow}Weryfikacja przez potok (pipe):${C.reset}
  '{"agent_state":"working","model":{"display_name":"Gemini 3.8 Flash"}}' | node statusline.js
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
      terminal_width: process.stdout.columns || 115,
      cwd: process.cwd(),
      model: {
        id: 'gemini-3.8-flash',
        display_name: 'Gemini 3.8 Flash',
        effort: 'high'
      },
      context_window: {
        total_input_tokens: 145000,
        total_output_tokens: 12000,
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
      task_count: 0,
      artifact_count: 0,
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

  // Standard Stdin ingestion mode (when invoked by Antigravity CLI)
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
