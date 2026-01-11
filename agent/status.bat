@echo off
echo ============================================
echo   AtlasNode Agent Status (Windows)
echo ============================================
echo.

REM Check if NSSM is installed
where nssm >nul 2>&1
if %errorLevel% equ 0 (
    echo Using NSSM...
    echo.
    nssm status AtlasNodeAgent
    echo.
    echo Service Details:
    sc query AtlasNodeAgent
    echo.
    echo Service Configuration:
    sc qc AtlasNodeAgent
) else (
    echo NSSM not found, checking Windows Service...
    echo.
    sc query AtlasNodeAgent
    if %errorLevel% neq 0 (
        echo.
        echo Service not found. The agent may not be installed as a service.
        echo.
        echo To check if the agent is running manually:
        echo   tasklist ^| findstr node.exe
    )
)

echo.
echo ============================================
echo Useful Commands:
echo   Start service: nssm start AtlasNodeAgent
echo   Stop service: nssm stop AtlasNodeAgent
echo   Restart service: nssm restart AtlasNodeAgent
echo   Remove service: nssm remove AtlasNodeAgent
echo ============================================
echo.
pause

