@echo off
echo ========================================
echo OCR Faktur - Spoustim lokalni server
echo ========================================
echo.
echo Server pobezi na: http://localhost:8000
echo.
echo Pro zastaveni stisknete Ctrl+C
echo.
echo Otevrite prohlizec a prejdete na:
echo http://localhost:8000
echo.
echo ========================================
echo.

REM Kontrola Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo CHYBA: Python neni nainstalovan!
    echo Stahnete z: https://www.python.org/downloads/
    echo.
    echo ALTERNATIVA: Otevrete index.html primo v prohlizeci
    pause
    exit /b 1
)

REM Spusteni serveru
echo Spoustim Python HTTP server...
python -m http.server 8000

pause
