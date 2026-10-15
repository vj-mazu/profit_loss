@echo off
title Profit-Loss ERP Frontend
cd /d %~dp0frontend
echo Starting Frontend on port 5173...
npm run dev
pause
