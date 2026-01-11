@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   AtlasNode Agent Installer (Windows)
echo ============================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Please run this script as Administrator
    echo Right-click the script and select "Run as administrator"
    pause
    exit /b 1
)

echo [OK] Running as Administrator

REM Check if Node.js is installed
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Node.js is not installed
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% found

REM Check if config.json exists
if not exist "config.json" (
    echo WARNING: config.json not found
    if exist "config.example.json" (
        echo Copying config.example.json to config.json...
        copy config.example.json config.json
        echo.
        echo Please edit config.json with your settings:
        echo   - Set controlServer URL
        echo   - Set machineId
        echo   - Set agentToken
        echo.
        echo After editing, run this installer again.
        pause
        exit /b 1
    ) else (
        echo ERROR: config.example.json not found
        pause
        exit /b 1
    )
)

echo [OK] config.json found

REM Install dependencies
echo.
echo Installing dependencies...
call npm install --production
if %errorLevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed

REM Install as Windows Service using NSSM
echo.
echo Setting up Windows Service...
echo.
echo This installer requires NSSM (Non-Sucking Service Manager)
echo Download from: https://nssm.cc/download
echo.
echo After installing NSSM, run these commands manually:
echo.
echo nssm install AtlasNodeAgent "%CD%\node_modules\.bin\node.exe" "%CD%\agent.js"
echo nssm set AtlasNodeAgent AppDirectory "%CD%"
echo nssm set AtlasNodeAgent DisplayName "AtlasNode Agent"
echo nssm set AtlasNodeAgent Description "AtlasNode System Monitor and Control Agent"
echo nssm set AtlasNodeAgent Start SERVICE_AUTO_START
echo nssm set AtlasNodeAgent AppExit Default Restart
echo nssm set AtlasNodeAgent AppRestartDelay 10000
echo nssm start AtlasNodeAgent
echo.
echo Or use Task Scheduler to run the agent on startup.
echo.

REM Create a startup script
echo Creating startup script...
echo @echo off > start-agent.bat
echo cd /d "%CD%" >> start-agent.bat
echo node agent.js >> start-agent.bat
echo [OK] Created start-agent.bat

echo.
echo ============================================
echo   Manual Setup Required
echo ============================================
echo.
echo Option 1: Install NSSM and run the commands above
echo Option 2: Use Task Scheduler:
echo   1. Open Task Scheduler
echo   2. Create Basic Task
echo   3. Name: AtlasNode Agent
echo   4. Trigger: When the computer starts
echo   5. Action: Start a program
echo   6. Program: %CD%\start-agent.bat
echo   7. Check "Run with highest privileges"
echo.
echo The agent is ready but needs to be configured to start automatically.
echo.
pause

