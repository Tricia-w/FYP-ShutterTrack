# Fix imports after moving files into Admin, Layout, Player, and Welcome folders.
# Put this file beside package.json, then run:
# powershell -ExecutionPolicy Bypass -File .\fix-current-imports.ps1

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $root "src"

function Replace-InFile {
    param(
        [string]$RelativePath,
        [hashtable]$Changes
    )

    $path = Join-Path $src $RelativePath

    if (-not (Test-Path $path)) {
        Write-Warning "File not found: $RelativePath"
        return
    }

    $content = Get-Content $path -Raw

    foreach ($old in $Changes.Keys) {
        $content = $content.Replace($old, $Changes[$old])
    }

    Set-Content $path $content -Encoding UTF8
    Write-Host "Fixed $RelativePath"
}

# Admin
Replace-InFile "components\Admin\Admin.jsx" @{
    "from '../context/AuthContext'" = "from '../../context/AuthContext'"
    "from './Layout.module.css'" = "from '../Layout/Layout.module.css'"
}

Replace-InFile "components\Admin\AuthCallback.jsx" @{
    "from '../lib/supabase'" = "from '../../lib/supabase'"
    "from '../lib/supabaseClient'" = "from '../../lib/supabaseClient'"
}

# Layout
Replace-InFile "components\Layout\Layout.js" @{
    "from '../context/AuthContext'" = "from '../../context/AuthContext'"
    "from '../lib/supabase'" = "from '../../lib/supabase'"
    "from '../lib/supabaseClient'" = "from '../../lib/supabaseClient'"
}

# Player pages
$playerFiles = @(
    "Dashboard.js",
    "Expenses.js",
    "Fitness.js",
    "Performance.jsx",
    "Players.js",
    "Profile.jsx",
    "Settings.jsx"
)

foreach ($file in $playerFiles) {
    Replace-InFile "components\Player\$file" @{
        "from '../context/AuthContext'" = "from '../../context/AuthContext'"
        "from '../lib/supabase'" = "from '../../lib/supabase'"
        "from '../lib/supabaseClient'" = "from '../../lib/supabaseClient'"
        "from './Pages.module.css'" = "from '../Layout/Pages.module.css'"
        "from './SkillRadarChart'" = "from '../Layout/SkillRadarChart'"
        "from './ExpensesPie'" = "from '../Layout/ExpensesPie'"
        "from './MonthlyTrendLineChart'" = "from '../Layout/MonthlyTrendLineChart'"
        "from './MatchCard'" = "from '../Layout/MatchCard'"
        "from './RankingTable'" = "from '../Layout/RankingTable'"
    }
}

# Welcome pages
$welcomeFiles = @(
    "Login.js",
    "Register.js",
    "ResetPassword.jsx",
    "PasswordChecklist.jsx"
)

foreach ($file in $welcomeFiles) {
    Replace-InFile "components\Welcome\$file" @{
        "from '../lib/supabase'" = "from '../../lib/supabase'"
        "from '../lib/supabaseClient'" = "from '../../lib/supabaseClient'"
        "from './Auth.module.css'" = "from '../Admin/Auth.module.css'"
        "from '../utils/passwordValidation'" = "from '../../utils/passwordValidation'"
    }
}

# Coach pages
$coachFiles = @(
    "CoachDashboard.jsx",
    "CoachPlayers.jsx",
    "CoachProfile.jsx",
    "CoachProgress.jsx",
    "CoachSessions.jsx",
    "CoachShared.jsx"
)

foreach ($file in $coachFiles) {
    Replace-InFile "components\Coach\$file" @{
        "from '../Pages.module.css'" = "from '../Layout/Pages.module.css'"
    }
}

Write-Host ""
Write-Host "All current moved-folder imports were updated."
Write-Host "Now stop the React server with Ctrl+C and run npm start again."