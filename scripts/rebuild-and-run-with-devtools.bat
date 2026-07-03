@echo off
REM Rebuild with electron-forge and run the built exe with DevTools enabled.
echo Setting ELECTRON_DEVTOOLS=1 for this session...
set ELECTRON_DEVTOOLS=1
echo Running npm run make...
call npm run make

echo Searching for built exe under the out directory...
setlocal enabledelayedexpansion
for /f "delims=" %%F in ('dir /b /s /a:-d "out\*.exe" 2^>nul') do (
    set "file=%%F"
    rem Skip Setup.exe (installer)
    for %%N in ("%%~nxF") do set "name=%%~N"
    if /i not "!name!"=="Setup.exe" (
        echo Found !file!
        start "" "!file!"
        goto :done
    )
)

echo No runnable exe found under out. Opening the out folder for inspection...
start "" out
:done

nexit /b 0