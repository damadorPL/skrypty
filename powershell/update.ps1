function Get-UpdateTools {
    # Set output encoding to UTF-8 to support emojis
    $oldOutputEncoding = [Console]::OutputEncoding
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8

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
            $currentUvVersion = (& $globalUvPath --version).Split(' ')[1]
            Write-Host "Installed Version: $currentUvVersion" -ForegroundColor Gray
            Write-Host "🔍 Checking for UV updates..." -ForegroundColor Gray

            $dryRunOutput = (& $globalUvPath self update --dry-run 2>&1) | Out-String
            if ($dryRunOutput -match "already on|latest version|up to date") {
                Write-Host "✅ UV is already up to date." -ForegroundColor Green
            } else {
                $latestVersion = "latest"
                if ($dryRunOutput -match "to v?(\d+\.\d+\.\d+)") {
                    $latestVersion = $Matches[1]
                }
                Write-Host "⚠️  Newer version available ($latestVersion). Updating UV..." -ForegroundColor Yellow
                Write-Progress -Activity "Updating UV" -Status "Downloading and installing update..." -PercentComplete -1
                $updateOutput = (& $globalUvPath self update 2>&1) | Out-String
                Write-Progress -Activity "Updating UV" -Completed

                $newUvVersion = (& $globalUvPath --version).Split(' ')[1]
                Write-Host "✅ UV updated successfully ($currentUvVersion -> $newUvVersion)." -ForegroundColor Green
            }
        } else {
            Write-Host "⚠️  Global uv not found. Installing via standalone installer..." -ForegroundColor Yellow
            Write-Progress -Activity "Installing UV" -Status "Running installer..." -PercentComplete -1
            Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
            Write-Progress -Activity "Installing UV" -Completed
            Write-Host "✅ UV installed successfully." -ForegroundColor Green
        }
    } catch {
        Write-Progress -Activity "Updating UV" -Completed
        Write-Host "❌ Could not check/update UV: $($_.Exception.Message)" -ForegroundColor Red
    }


    # ---------------------------------------------------------------------------
    # pnpm
    # ---------------------------------------------------------------------------
    Write-SectionHeader "pnpm"
    try {
        $currentPnpmVersion = (pnpm -v).Trim()
        Write-Host "Installed Version: $currentPnpmVersion" -ForegroundColor Gray
        Write-Host "🔍 Checking for pnpm updates..." -ForegroundColor Gray

        $latestPnpmVersion = (npm view pnpm version).Trim()

        if ([version]$currentPnpmVersion -lt [version]$latestPnpmVersion) {
            Write-Host "Latest Version:    $latestPnpmVersion" -ForegroundColor Gray
            Write-Host "⚠️  Newer version available ($latestPnpmVersion). Updating pnpm..." -ForegroundColor Yellow
            Write-Progress -Activity "Updating pnpm" -Status "Running installer script..." -PercentComplete -1
            Invoke-RemoteScript "https://get.pnpm.io/install.ps1" | Out-Null
            Write-Progress -Activity "Updating pnpm" -Completed
            Write-Host "✅ pnpm updated successfully ($currentPnpmVersion -> $latestPnpmVersion)." -ForegroundColor Green

            $pnpmExePath = Join-Path $env:LOCALAPPDATA "pnpm\.tools\pnpm-exe"
            if (Test-Path $pnpmExePath) {
                Write-Host "`n   Checking for old pnpm versions in: $pnpmExePath" -ForegroundColor Gray

                $installedVersions = Get-ChildItem -Path $pnpmExePath -Directory |
                                     Sort-Object { [version]$_.Name } -Descending

                if ($installedVersions.Count -gt 1) {
                    $versionsToRemove = $installedVersions | Select-Object -Skip 1
                    foreach ($ver in $versionsToRemove) {
                        Write-Host "🗑️  Deleting old pnpm version: $($ver.Name)" -ForegroundColor Magenta
                        try {
                            Remove-Item -Path $ver.FullName -Recurse -Force -ErrorAction Stop
                        } catch {
                            Write-Host "❌ Failed to delete $($ver.Name): $($_.Exception.Message)" -ForegroundColor Red
                        }
                    }
                    Write-Host "✅ Cleanup complete. Kept version $($installedVersions[0].Name)." -ForegroundColor Green
                } else {
                    Write-Host "   No old pnpm versions to clean up." -ForegroundColor Gray
                }
            }
        } else {
            Write-Host "✅ pnpm is already up to date." -ForegroundColor Green
        }

    } catch {
        Write-Progress -Activity "Updating pnpm" -Completed
        Write-Host "❌ Could not check/update pnpm: $($_.Exception.Message)" -ForegroundColor Red
    }

    # ---------------------------------------------------------------------------
    # Bun
    # ---------------------------------------------------------------------------
    Write-SectionHeader "Bun"
    try {
        $currentBunVersion = (bun -v).Trim()
        Write-Host "Installed Version: $currentBunVersion" -ForegroundColor Gray
        Write-Host "🔍 Checking for Bun updates..." -ForegroundColor Gray

        $latestBunVersion = (npm view bun version).Trim()

        if ([version]$currentBunVersion -lt [version]$latestBunVersion) {
            Write-Host "⚠️  Newer version available ($latestBunVersion). Updating Bun..." -ForegroundColor Yellow
            Write-Progress -Activity "Updating Bun" -Status "Running bun upgrade..." -PercentComplete -1
            $updateOutput = (bun upgrade 2>&1) | Out-String
            Write-Progress -Activity "Updating Bun" -Completed

            $newBunVersion = (bun -v).Trim()
            Write-Host "✅ Bun updated successfully ($currentBunVersion -> $newBunVersion)." -ForegroundColor Green
        } else {
            Write-Host "✅ Bun is already up to date." -ForegroundColor Green
        }
    } catch {
        Write-Progress -Activity "Updating Bun" -Completed
        Write-Host "❌ Could not check/update Bun: $($_.Exception.Message)" -ForegroundColor Red
    }

    # ---------------------------------------------------------------------------
    # Deno
    # ---------------------------------------------------------------------------
    Write-SectionHeader "Deno"
    try {
        $currentDenoVersion = ((deno -v | Select-Object -First 1).Split(' ')[1]).Trim()
        Write-Host "Installed Version: $currentDenoVersion" -ForegroundColor Gray
        Write-Host "🔍 Checking for Deno updates..." -ForegroundColor Gray

        $dryRunOutput = (deno upgrade --dry-run 2>&1) | Out-String

        if ($dryRunOutput -match "most recent release|up to date") {
            Write-Host "✅ Deno is already up to date." -ForegroundColor Green
        } else {
            $latestVersion = "latest"
            if ($dryRunOutput -match "(\d+\.\d+\.\d+)") {
                foreach ($m in $Matches.Values) {
                    if ($m -ne $currentDenoVersion) {
                        $latestVersion = $m
                        break
                    }
                }
            }
            Write-Host "⚠️  Newer version available ($latestVersion). Updating Deno..." -ForegroundColor Yellow
            Write-Progress -Activity "Updating Deno" -Status "Running deno upgrade..." -PercentComplete -1
            $updateOutput = (deno upgrade 2>&1) | Out-String
            Write-Progress -Activity "Updating Deno" -Completed

            $newDenoVersion = ((deno -v | Select-Object -First 1).Split(' ')[1]).Trim()
            Write-Host "✅ Deno updated successfully ($currentDenoVersion -> $newDenoVersion)." -ForegroundColor Green
        }
    } catch {
        Write-Progress -Activity "Updating Deno" -Completed
        Write-Host "❌ Could not check/update Deno: $($_.Exception.Message)" -ForegroundColor Red
    }

    # ---------------------------------------------------------------------------
    # Claude Code
    # ---------------------------------------------------------------------------
    Write-SectionHeader "Claude Code"
    try {
        $rawClaudeVersion = (claude --version 2>$null | Out-String).Trim()
        $currentClaudeVersion = if ($rawClaudeVersion -match '(\d+\.\d+\.\d+)') { $Matches[1] } else { $null }
        if ($currentClaudeVersion) {
            Write-Host "Installed Version: $currentClaudeVersion" -ForegroundColor Gray
        }
        Write-Host "🔍 Checking for Claude Code updates..." -ForegroundColor Gray

        $latestClaudeVersion = (npm view @anthropic-ai/claude-code version).Trim()

        if ($currentClaudeVersion -and [version]$currentClaudeVersion -lt [version]$latestClaudeVersion) {
            Write-Host "⚠️  Newer version available ($latestClaudeVersion). Updating Claude Code..." -ForegroundColor Yellow
            Write-Progress -Activity "Updating Claude Code" -Status "Running claude update..." -PercentComplete -1
            $updateOutput = (claude update 2>&1) | Out-String
            Write-Progress -Activity "Updating Claude Code" -Completed

            $rawNewClaude = (claude --version 2>$null | Out-String).Trim()
            $newClaudeVersion = if ($rawNewClaude -match '(\d+\.\d+\.\d+)') { $Matches[1] } else { $latestClaudeVersion }
            Write-Host "✅ Claude Code updated successfully ($currentClaudeVersion -> $newClaudeVersion)." -ForegroundColor Green
        } else {
            Write-Host "✅ Claude Code is already up to date." -ForegroundColor Green
        }
    } catch {
        Write-Progress -Activity "Updating Claude Code" -Completed
        Write-Host "❌ Could not check/update Claude Code: $($_.Exception.Message)" -ForegroundColor Red
    }

    # ---------------------------------------------------------------------------
    # Antigravity CLI (agy)
    # ---------------------------------------------------------------------------
    Write-SectionHeader "Antigravity CLI (agy)"
    try {
        $rawAgyVersion = (agy --version 2>$null | Out-String).Trim()
        $currentAgyVersion = if ($rawAgyVersion -match '(\d+\.\d+\.\d+)') { $Matches[1] } else { $null }
        if ($currentAgyVersion) {
            Write-Host "Installed Version: $currentAgyVersion" -ForegroundColor Gray
        }
        Write-Host "🔍 Checking for Antigravity CLI updates..." -ForegroundColor Gray

        Write-Progress -Activity "Checking Antigravity CLI" -Status "Checking for updates..." -PercentComplete -1
        $updateOutput = (agy update 2>&1) | Out-String
        Write-Progress -Activity "Checking Antigravity CLI" -Completed

        if ($updateOutput -match "already|latest version|up to date") {
            Write-Host "✅ Antigravity CLI (agy) is already up to date." -ForegroundColor Green
        } else {
            Write-Host "⚠️  Newer version available. Updating Antigravity CLI (agy)..." -ForegroundColor Yellow
            $rawNewAgy = (agy --version 2>$null | Out-String).Trim()
            $newAgyVersion = if ($rawNewAgy -match '(\d+\.\d+\.\d+)') { $Matches[1] } else { "latest" }
            Write-Host "✅ Antigravity CLI (agy) updated successfully ($currentAgyVersion -> $newAgyVersion)." -ForegroundColor Green
        }
    } catch {
        Write-Progress -Activity "Checking Antigravity CLI" -Completed
        Write-Host "❌ Could not check/update Antigravity CLI (agy): $($_.Exception.Message)" -ForegroundColor Red
    }

    # ---------------------------------------------------------------------------
    # Grok CLI (grok)
    # ---------------------------------------------------------------------------
    Write-SectionHeader "Grok CLI (grok)"
    try {
        $rawGrokVersion = (grok --version 2>$null | Out-String).Trim()
        $currentGrokVersion = if ($rawGrokVersion -match '(\d+\.\d+\.\d+)') { $Matches[1] } else { $null }
        if ($currentGrokVersion) {
            Write-Host "Installed Version: $currentGrokVersion" -ForegroundColor Gray
        }
        Write-Host "🔍 Checking for Grok CLI updates..." -ForegroundColor Gray

        $checkOutput = (grok update --check --json 2>$null) | Out-String
        if ($checkOutput) {
            $checkObj = $checkOutput | ConvertFrom-Json
            if ($checkObj.updateAvailable -eq $true) {
                $latestGrokVersion = $checkObj.latestVersion
                Write-Host "⚠️  Newer version available ($latestGrokVersion). Updating Grok CLI (grok)..." -ForegroundColor Yellow
                Write-Progress -Activity "Updating Grok CLI" -Status "Running grok update..." -PercentComplete -1
                $updateOutput = (grok update 2>&1) | Out-String
                Write-Progress -Activity "Updating Grok CLI" -Completed

                $rawNewGrok = (grok --version 2>$null | Out-String).Trim()
                $newGrokVersion = if ($rawNewGrok -match '(\d+\.\d+\.\d+)') { $Matches[1] } else { $latestGrokVersion }
                Write-Host "✅ Grok CLI (grok) updated successfully ($currentGrokVersion -> $newGrokVersion)." -ForegroundColor Green
            } else {
                Write-Host "✅ Grok CLI (grok) is already up to date." -ForegroundColor Green
            }
        } else {
            $updateOutput = (grok update 2>&1) | Out-String
            if ($updateOutput -match "Already up to date|up to date|latest") {
                Write-Host "✅ Grok CLI (grok) is already up to date." -ForegroundColor Green
            } else {
                $rawNewGrok = (grok --version 2>$null | Out-String).Trim()
                $newGrokVersion = if ($rawNewGrok -match '(\d+\.\d+\.\d+)') { $Matches[1] } else { "latest" }
                Write-Host "✅ Grok CLI (grok) updated successfully ($currentGrokVersion -> $newGrokVersion)." -ForegroundColor Green
            }
        }
    } catch {
        Write-Progress -Activity "Updating Grok CLI" -Completed
        Write-Host "❌ Could not check/update Grok CLI (grok): $($_.Exception.Message)" -ForegroundColor Red
    }

    # ---------------------------------------------------------------------------
    # NPM Global Packages
    # ---------------------------------------------------------------------------
    Write-SectionHeader "NPM Global Packages"
    try {
        Write-Host "🔍 Fetching global package list..." -ForegroundColor Gray
        $npmListJson = npm list -g --depth=0 --json 2>$null
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($npmListJson)) {
            Write-Host "⚠️  No global npm packages found or npm list failed." -ForegroundColor Yellow
            return
        }

        $packagesObj = $npmListJson | ConvertFrom-Json
        $dependencies = $packagesObj.dependencies

        if ($dependencies) {
            $results = [System.Collections.Generic.List[PSObject]]::new()
            $anyUpdated = $false

            foreach ($pkgName in $dependencies.PSObject.Properties.Name) {
                $currentVersion = $dependencies.$pkgName.version
                if (-not $currentVersion) { continue }

                # Fetch latest version & last modified date
                $viewData = npm view $pkgName version time.modified --json 2>$null
                if ($viewData) {
                    $info = $viewData | ConvertFrom-Json
                    $latestVersion = $info.version
                    $modifiedStr = $info.'time.modified'
                    
                    if ($modifiedStr) {
                        $lastModified = [DateTime]$modifiedStr
                        $ageSpan = (Get-Date) - $lastModified
                        
                        if ($ageSpan.TotalDays -lt 1) {
                            $age = "{0:N0} hours ago" -f $ageSpan.TotalHours
                        } elseif ($ageSpan.TotalDays -lt 30) {
                            $age = "{0:N0} days ago" -f $ageSpan.TotalDays
                        } else {
                            $age = "{0:N0} months ago" -f ($ageSpan.TotalDays / 30)
                        }
                    } else {
                        $lastModified = "Unknown"
                        $age = "Unknown"
                    }
                } else {
                    $latestVersion = "Unknown"
                    $lastModified = "Unknown"
                    $age = "Unknown"
                }

                $isOutdated = $false
                try {
                    if ($latestVersion -ne "Unknown" -and [version]$currentVersion -lt [version]$latestVersion) {
                        $isOutdated = $true
                    }
                } catch {
                    if ($latestVersion -ne "Unknown" -and $currentVersion -ne $latestVersion) {
                        $isOutdated = $true
                    }
                }

                if ($isOutdated) {
                    Write-Host "⚠️  Updating $pkgName from $currentVersion to $latestVersion..." -ForegroundColor Yellow
                    Write-Progress -Activity "Updating Global NPM Packages" -Status "Installing $pkgName@latest..." -PercentComplete -1
                    npm install -g "$pkgName@latest" 2>$null | Out-Null
                    Write-Progress -Activity "Updating Global NPM Packages" -Completed
                    $currentVersion = $latestVersion
                    $anyUpdated = $true
                }

                $results.Add([PSCustomObject]@{
                    "Package Name"      = $pkgName
                    "Installed Version" = $currentVersion
                    "Latest Version"    = $latestVersion
                    "Last Published"    = if ($lastModified -is [DateTime]) { $lastModified.ToString("yyyy-MM-dd HH:mm") } else { $lastModified }
                    "Age of Update"     = $age
                })
            }

            if ($anyUpdated) {
                Write-Host "✅ Global packages updated successfully." -ForegroundColor Green
            } else {
                Write-Host "✅ All npm global packages are already up to date." -ForegroundColor Green
            }

            $results | Format-Table -AutoSize
        } else {
            Write-Host "⚠️  No global npm packages found." -ForegroundColor Yellow
        }
    } catch {
        Write-Progress -Activity "Updating Global NPM Packages" -Completed
        Write-Host "❌ Could not check/update npm global packages: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host "`n✅ All checks complete." -ForegroundColor Green

    # Restore original console output encoding
    if ($oldOutputEncoding) {
        [Console]::OutputEncoding = $oldOutputEncoding
    }
}
