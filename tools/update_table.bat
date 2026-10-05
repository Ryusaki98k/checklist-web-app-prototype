@echo off
cd /d "%~dp0\.."
npx tsx tools/drizzle_push.ts
pause