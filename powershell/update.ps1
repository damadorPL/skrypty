function Get-UpdateTools {
    # ---------------------------------------------------------------------------
    # Install missing tools before updating
    # ---------------------------------------------------------------------------
    $toolsToCheck = @(
        @{
            Name       = "uv"
            Command    = "uv"
            InstallCmd = { Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression }
            DocsUrl    = "https://docs.astral.sh/uv/getting-started/installation/"
        },
        @{
            Name       = "pnpm"
            Command    = "pnpm"
            InstallCmd = { Invoke-WebRequest https://get.pnpm.io/install.ps1 -UseBasicParsing | Invoke-Expression }
            DocsUrl    = "https://pnpm.io/installation"
        },
        @{
            Name       = "bun"
            Command    = "bun"
            InstallCmd = { Invoke-RestMethod bun.sh/install.ps1 | Invoke-Expression }
            DocsUrl    = "https://bun.com/docs/installation#windows"
        },
        @{
            Name       = "deno"
            Command    = "deno"
            InstallCmd = { Invoke-RestMethod https://deno.land/install.ps1 | Invoke-Expression }
            DocsUrl    = "https://docs.deno.com/runtime/getting_started/installation/"
        },
        @{
            Name       = "claude"
            Command    = "claude"
            InstallCmd = { Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression }
            DocsUrl    = "https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview"
        },
        @{
            Name       = "agy"
            Command    = "agy"
            InstallCmd = { Invoke-RestMethod https://antigravity.google/cli/install.ps1 | Invoke-Expression }
            DocsUrl    = "https://antigravity.google/docs/cli/reference"
        },
        @{
            Name       = "grok"
            Command    = "grok"
            InstallCmd = { Invoke-RestMethod https://x.ai/cli/install.ps1 | Invoke-Expression }
            DocsUrl    = "https://x.ai/cli"
        }
    )

    foreach ($tool in $toolsToCheck) {
        if (-not (Get-Command $tool.Command -ErrorAction SilentlyContinue)) {
            Write-Host "⚠️  '$($tool.Name)' not found. Installing..." -ForegroundColor Yellow
            Write-Host "   Docs: $($tool.DocsUrl)" -ForegroundColor Gray
            try {
                & $tool.InstallCmd
                Write-Host "✅ '$($tool.Name)' installed successfully." -ForegroundColor Green
            } catch {
                Write-Host "❌ Failed to install '$($tool.Name)': $($_.Exception.Message)" -ForegroundColor Red
                Write-Host "   Install manually: $($tool.DocsUrl)" -ForegroundColor Gray
            }
        }
    }

    # Helper function for consistent headers
    function Write-SectionHeader {
        param([string]$Title)
        Write-Host "`n--------------------------------------------------"
        Write-Host "🔄 Checking $Title" -ForegroundColor Cyan
        Write-Host "--------------------------------------------------"
    }

    # Helper to safely fetch GitHub latest release, with rate-limit detection
    function Get-GitHubLatestVersion {
        param(
            [string]$Repo,         # e.g. "astral-sh/uv"
            [string]$StripPrefix   # e.g. "bun-v" or "v" or ""
        )
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -ErrorAction Stop
        if ($release.message) {
            throw "GitHub API error: $($release.message)"
        }
        return $release.tag_name.TrimStart($StripPrefix)
    }

    # Helper to safely download and execute a remote install script
    function Invoke-RemoteScript {
        param([string]$Uri)
        $script = Invoke-RestMethod -Uri $Uri -ErrorAction Stop
        Invoke-Expression $script
    }

    # ---------------------------------------------------------------------------
    # UV (Global Installation)
    # ---------------------------------------------------------------------------
    Write-SectionHeader "UV"
    try {
        $globalUvPath = Join-Path $env:USERPROFILE ".local\bin\uv.exe"
        if (Test-Path $globalUvPath) {
            Write-Host "Updating global uv at: $globalUvPath"
            $currentUvVersion = (& $globalUvPath --version).Split(' ')[1]
            Write-Host "Current global version: $currentUvVersion"
            & $globalUvPath self update
        } else {
            Write-Host "Global uv not found. Installing via standalone installer..." -ForegroundColor Yellow
            Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
        }
    } catch {
        Write-Host "❌ Could not check/update global UV." -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }


    # ---------------------------------------------------------------------------
    # pnpm
    # ---------------------------------------------------------------------------
    Write-SectionHeader "pnpm"
    try {
        $currentPnpmVersion = pnpm -v
        Write-Host "Installed Version: $currentPnpmVersion"

        $latestPnpmVersion = npm view pnpm version
        Write-Host "Latest Version:    $latestPnpmVersion"

        if ([version]$currentPnpmVersion -lt [version]$latestPnpmVersion) {
            Write-Host "Newer version available. Updating pnpm..." -ForegroundColor Yellow
            Invoke-RemoteScript "https://get.pnpm.io/install.ps1"
            Write-Host "pnpm updated successfully." -ForegroundColor Green
            pnpm -v

            $pnpmExePath = Join-Path $env:LOCALAPPDATA "pnpm\.tools\pnpm-exe"
            if (Test-Path $pnpmExePath) {
                Write-Host "`nChecking for old pnpm versions in: $pnpmExePath" -ForegroundColor Gray

                $installedVersions = Get-ChildItem -Path $pnpmExePath -Directory |
                                     Sort-Object { [version]$_.Name } -Descending

                if ($installedVersions.Count -gt 1) {
                    $versionsToRemove = $installedVersions | Select-Object -Skip 1
                    foreach ($ver in $versionsToRemove) {
                        Write-Host "🗑️  Deleting old pnpm version: $($ver.Name)" -ForegroundColor Magenta
                        try {
                            Remove-Item -Path $ver.FullName -Recurse -Force -ErrorAction Stop
                        } catch {
                            Write-Host "Failed to delete $($ver.Name): $_" -ForegroundColor Red
                        }
                    }
                    Write-Host "Cleanup complete. Kept version $($installedVersions[0].Name)." -ForegroundColor Green
                } else {
                    Write-Host "No old pnpm versions to clean up." -ForegroundColor Gray
                }
            }
        } else {
            Write-Host "pnpm is already up to date." -ForegroundColor Green
        }

    } catch {
        Write-Host "❌ Could not check/update pnpm. Is it installed and in your PATH?" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }

    # ---------------------------------------------------------------------------
    # Bun
    # ---------------------------------------------------------------------------
    Write-SectionHeader "Bun"
    try {
        $currentBunVersion = bun -v
        Write-Host "Installed Version: $currentBunVersion"

        bun upgrade
    } catch {
        Write-Host "❌ Could not check/update Bun. Is it installed and in your PATH?" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }

    # ---------------------------------------------------------------------------
    # Deno
    # ---------------------------------------------------------------------------
    Write-SectionHeader "Deno"
    try {
        $currentDenoVersion = (deno -v | Select-Object -First 1).Split(' ')[1]
        Write-Host "Installed Version: $currentDenoVersion"

        deno upgrade
    } catch {
        Write-Host "❌ Could not check/update Deno. Is it installed and in your PATH?" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }

    # ---------------------------------------------------------------------------
    # Claude Code
    # ---------------------------------------------------------------------------
    Write-SectionHeader "Claude Code"
    try {
        claude update
    } catch {
        Write-Host "❌ Could not check/update Claude. Is it installed and in your PATH?" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }

    # ---------------------------------------------------------------------------
    # Antigravity CLI (agy)
    # ---------------------------------------------------------------------------
    Write-SectionHeader "Antigravity CLI (agy)"
    try {
        agy update
    } catch {
        Write-Host "❌ Could not check/update agy. Is it installed and in your PATH?" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }

    # ---------------------------------------------------------------------------
    # Grok CLI (grok)
    # ---------------------------------------------------------------------------
    Write-SectionHeader "Grok CLI (grok)"
    try {
        grok update
    } catch {
        Write-Host "❌ Could not check/update grok. Is it installed and in your PATH?" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }

    # ---------------------------------------------------------------------------
    # NPM Global Packages
    # ---------------------------------------------------------------------------
    Write-SectionHeader "NPM Global Packages"
    try {
        $outdatedRaw = npm outdated -g --json 2>&1
        if ($LASTEXITCODE -gt 1) {
            throw "npm exited with code {$LASTEXITCODE}: $outdatedRaw"
        }

        if ($LASTEXITCODE -eq 1) {
            Write-Host "Outdated npm global packages found. Updating each to @latest..." -ForegroundColor Yellow

            $outdatedJson = $outdatedRaw | ConvertFrom-Json
            $packageNames = $outdatedJson | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name

            foreach ($pkg in $packageNames) {
                $current  = $outdatedJson.$pkg.current
                $latest   = $outdatedJson.$pkg.latest
                Write-Host "  Updating $pkg  $current → $latest" -ForegroundColor Yellow
                npm install -g "$pkg@latest"
            }

            Write-Host "Global packages updated successfully." -ForegroundColor Green
            Write-Host "New global package list (top level):"
            npm list -g --depth=0
        } else {
            Write-Host "All npm global packages are up to date." -ForegroundColor Green
        }
    } catch {
        Write-Host "❌ Could not check/update npm global packages. Is npm installed?" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }

    Write-Host "`n✅ All checks complete." -ForegroundColor Green
}
