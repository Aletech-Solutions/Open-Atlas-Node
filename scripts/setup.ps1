#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   AtlasNode Setup Script (Windows)" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is installed
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Host "Error: Docker is not installed" -ForegroundColor Red
    Write-Host "Please install Docker Desktop: https://docs.docker.com/desktop/install/windows-install/"
    exit 1
}
Write-Host "[OK] Docker found" -ForegroundColor Green

# Check if Docker Compose is available
$composeAvailable = $false
try {
    $null = docker compose version 2>$null
    if ($LASTEXITCODE -eq 0) { $composeAvailable = $true }
} catch {}

if (-not $composeAvailable) {
    $dockerComposeCmd = Get-Command docker-compose -ErrorAction SilentlyContinue
    if ($dockerComposeCmd) { $composeAvailable = $true }
}

if (-not $composeAvailable) {
    Write-Host "Error: Docker Compose is not installed" -ForegroundColor Red
    Write-Host "Docker Desktop includes Docker Compose. Please ensure it is enabled."
    exit 1
}
Write-Host "[OK] Docker Compose found" -ForegroundColor Green

# Change to project root (parent of scripts/)
$projectRoot = Split-Path -Parent $PSScriptRoot
if ($PSScriptRoot) {
    Set-Location $projectRoot
} else {
    $projectRoot = Get-Location
}

$envFile = Join-Path $projectRoot ".env"

if (-not (Test-Path $envFile)) {
    Write-Host ""
    Write-Host "Creating .env file..." -ForegroundColor Yellow

    # Generate secure random strings
    $jwtBytes = New-Object byte[] 32
    $dbBytes = New-Object byte[] 16
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($jwtBytes)
    $rng.GetBytes($dbBytes)
    $jwtSecret = [BitConverter]::ToString($jwtBytes) -replace '-',''
    $dbPassword = [BitConverter]::ToString($dbBytes) -replace '-',''

    Write-Host "[OK] Generated secure JWT secret and database password" -ForegroundColor Green
    Write-Host ""

    # Get server IP for BACKEND_HOST
    Write-Host "-------------------------------------------" -ForegroundColor Yellow
    Write-Host " IMPORTANT: Configure Agent Communication" -ForegroundColor Yellow
    Write-Host "-------------------------------------------" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Agents installed on remote machines need to know how to"
    Write-Host "connect back to this control server."
    Write-Host ""

    # Try to detect IP address
    Write-Host "Detecting your server's IP address..."
    $detectedIP = $null
    try {
        $adapters = Get-NetIPAddress -AddressFamily IPv4 |
            Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } |
            Sort-Object -Property InterfaceIndex |
            Select-Object -First 1
        if ($adapters) {
            $detectedIP = $adapters.IPAddress
        }
    } catch {
        try {
            $detectedIP = (Test-Connection -ComputerName $env:COMPUTERNAME -Count 1).IPV4Address.IPAddressToString
        } catch {}
    }

    $backendHost = "CHANGE_THIS_TO_YOUR_SERVER_IP"

    if ($detectedIP) {
        Write-Host "Detected IP: $detectedIP" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Options:"
        Write-Host "  1) Use detected IP: $detectedIP"
        Write-Host "  2) Enter a different IP or hostname"
        Write-Host "  3) Skip (configure manually later)"
        Write-Host ""
        $choice = Read-Host "Choose an option (1-3)"

        switch ($choice) {
            "1" { $backendHost = $detectedIP; Write-Host "Using: $backendHost" }
            "2" { $backendHost = Read-Host "Enter IP address or hostname" }
            "3" {
                Write-Host "Skipping... You'll need to set BACKEND_HOST in .env manually!" -ForegroundColor Yellow
                $backendHost = "CHANGE_THIS_TO_YOUR_SERVER_IP"
            }
            default { $backendHost = $detectedIP; Write-Host "Using default: $backendHost" }
        }
    } else {
        Write-Host "Could not auto-detect IP address." -ForegroundColor Yellow
        $backendHost = Read-Host "Enter your server's IP address or hostname"
        if ([string]::IsNullOrWhiteSpace($backendHost)) {
            Write-Host "WARNING: No IP set! You MUST configure BACKEND_HOST in .env" -ForegroundColor Red
            $backendHost = "CHANGE_THIS_TO_YOUR_SERVER_IP"
        }
    }

    # Write .env file
    $envContent = @"
# Database Configuration
DB_NAME=atlasnode
DB_USER=atlasnode
DB_PASSWORD=$dbPassword

# Backend Configuration
NODE_ENV=production
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*

# Ports
BACKEND_PORT=5000
FRONTEND_PORT=3000

# Agent Communication (IMPORTANT!)
BACKEND_HOST=$backendHost
"@

    Set-Content -Path $envFile -Value $envContent -Encoding UTF8
    Write-Host ""
    Write-Host "[OK] Created .env file" -ForegroundColor Green
    Write-Host ""

    if ($backendHost -eq "CHANGE_THIS_TO_YOUR_SERVER_IP") {
        Write-Host "WARNING: You MUST edit .env and set BACKEND_HOST before adding machines!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Edit .env now with your preferred editor (notepad, VS Code, etc.)"
        Write-Host ""
        Read-Host "Press Enter to continue or Ctrl+C to exit and edit .env"
    } else {
        Write-Host "Configuration summary:" -ForegroundColor Cyan
        Write-Host "  BACKEND_HOST=$backendHost"
        Write-Host "  Agents will connect to: http://${backendHost}:5000"
        Write-Host ""
        Read-Host "Press Enter to continue"
    }
}

# Create necessary directories
Write-Host "Creating directories..."
New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot "agent-bundles") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot "logs") | Out-Null

Write-Host ""
Write-Host "Building and starting containers..."
docker-compose up -d --build

Write-Host ""
Write-Host "Waiting for services to be ready..."
Start-Sleep -Seconds 10

# Health checks
try {
    $health = Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($health.StatusCode -eq 200) {
        Write-Host "[OK] Backend is healthy" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Backend health check failed" -ForegroundColor Red
        Write-Host "Check logs with: docker-compose logs backend"
    }
} catch {
    Write-Host "[FAIL] Backend health check failed" -ForegroundColor Red
    Write-Host "Check logs with: docker-compose logs backend"
}

try {
    $frontend = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($frontend.StatusCode -eq 200) {
        Write-Host "[OK] Frontend is accessible" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Frontend is not accessible" -ForegroundColor Red
        Write-Host "Check logs with: docker-compose logs frontend"
    }
} catch {
    Write-Host "[FAIL] Frontend is not accessible" -ForegroundColor Red
    Write-Host "Check logs with: docker-compose logs frontend"
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "   AtlasNode Setup Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "[OK] Dashboard: http://localhost:3000" -ForegroundColor Green
Write-Host "[OK] API: http://localhost:5000" -ForegroundColor Green
Write-Host ""

# Show BACKEND_HOST configuration
if (Test-Path $envFile) {
    $hostLine = Get-Content $envFile | Where-Object { $_ -match "^BACKEND_HOST=" }
    if ($hostLine) {
        $hostValue = ($hostLine -split '=', 2)[1]
        if ($hostValue -and $hostValue -ne "CHANGE_THIS_TO_YOUR_SERVER_IP") {
            Write-Host "[OK] Agent communication: http://${hostValue}:5000" -ForegroundColor Green
            Write-Host ""
        } else {
            Write-Host "WARNING: BACKEND_HOST not configured!" -ForegroundColor Red
            Write-Host "   Edit .env and set BACKEND_HOST before adding machines"
            Write-Host ""
        }
    }
}

Write-Host "Next steps:"
Write-Host "  1. Open http://localhost:3000 in your browser"
Write-Host "  2. Register your first user (becomes admin)"
Write-Host "  3. Add machines from the dashboard"
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  View logs:      docker-compose logs -f"
Write-Host "  Stop services:  docker-compose stop"
Write-Host "  Restart:        docker-compose restart"
Write-Host "  Remove all:     docker-compose down -v"
Write-Host ""
