@echo off
setlocal
cd /d "%~dp0\.."
echo ==============================================================================
echo                Starting Database Reset for checklist_web_app
echo ==============================================================================
npx tsx tools/reset_checklist_schema.ts %*
echo.
pause
