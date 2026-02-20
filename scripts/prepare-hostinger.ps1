param(
  [string]$OutputDir = "hostinger-ready",
  [switch]$SkipClientBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

function Invoke-RobocopySync {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  robocopy $Source $Destination /MIR /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
  $code = $LASTEXITCODE
  if ($code -ge 8) {
    throw "Robocopy failed for '$Source' -> '$Destination' (exit code: $code)."
  }
}

Push-Location $projectRoot
try {
  if (-not $SkipClientBuild) {
    Write-Host "Building client bundle..."
    npm run build:client
    if ($LASTEXITCODE -ne 0) {
      throw "Client build failed. Fix build errors and run again."
    }
  }

  $required = @(
    "dist/server",
    "dist/client",
    "dist/shared",
    "package.json",
    "package-lock.json"
  )

  foreach ($path in $required) {
    if (-not (Test-Path $path)) {
      throw "Required path missing: $path"
    }
  }

  $distOut = Join-Path $OutputDir "dist"
  New-Item -ItemType Directory -Path $distOut -Force | Out-Null

  Invoke-RobocopySync -Source "dist/server" -Destination (Join-Path $distOut "server")
  Invoke-RobocopySync -Source "dist/client" -Destination (Join-Path $distOut "client")
  Invoke-RobocopySync -Source "dist/shared" -Destination (Join-Path $distOut "shared")

  $rootPkg = Get-Content "package.json" -Raw | ConvertFrom-Json
  # Build a minimal runtime package to avoid host panel analyzers choking on unrelated deps.
  $deployPkg = [ordered]@{
    name = $rootPkg.name
    version = $rootPkg.version
    private = $true
    type = "module"
    main = "server.js"
    scripts = [ordered]@{
      build = "echo Build skipped (prebuilt dist included)"
      start = "node server.js"
    }
    dependencies = [ordered]@{
      bcryptjs = "^3.0.3"
      bson = "^6.10.4"
      cors = "^2.8.5"
      dotenv = "^17.2.3"
      express = "^5.2.1"
      jsonwebtoken = "^9.0.3"
      mongoose = "^8.19.1"
      razorpay = "^2.9.6"
      react = "^19.2.0"
      "react-dom" = "^19.2.0"
      "tsconfig-paths" = "^4.2.0"
    }
  }
  $packageJsonOut = Join-Path $OutputDir "package.json"
  $packageJsonText = $deployPkg | ConvertTo-Json -Depth 100
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Resolve-Path $packageJsonOut), $packageJsonText, $utf8NoBom)

  if (Test-Path (Join-Path $OutputDir "package-lock.json")) {
    Remove-Item (Join-Path $OutputDir "package-lock.json") -Force
  }

  if (Test-Path ".env.example") {
    Copy-Item ".env.example" (Join-Path $OutputDir ".env.example") -Force
  }

  # Add root entry shims so control panels that enforce server.js/app.js can boot reliably.
  Set-Content -Path (Join-Path $OutputDir "server.js") -Value "import './dist/server/app.js';" -Encoding ascii
  Set-Content -Path (Join-Path $OutputDir "app.js") -Value "import './dist/server/app.js';" -Encoding ascii

  $deployText = @"
Hostinger deploy folder (Node.js)

1) Upload all files in this folder to your Hostinger Node app directory.
2) Create .env from .env.example and set DATABASE_URL, JWT_SECRET, PORT.
3) Install runtime dependencies: npm install
4) Build command in Hostinger can be empty (or npm run build; it is no-op in this package).
5) Start app: npm start
   (Startup file alternative: dist/server/app.js)

This package serves both API and frontend from one Node app.
"@
  Set-Content -Path (Join-Path $OutputDir "DEPLOY.txt") -Value $deployText -Encoding ascii

  Write-Host "Done. Deployment folder is ready at: $OutputDir"
}
finally {
  Pop-Location
}
