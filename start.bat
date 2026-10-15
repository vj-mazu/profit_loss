@echo off
title Profit-Loss ERP Launcher
echo ========================================================
echo   Launching Profit-Loss Commodity Trading ERP System
echo ========================================================
echo.

echo Starting Backend API Server (Port 5050)...
start "Profit-Loss ERP Backend" cmd /k "cd /d %~dp0backend && npm start"

timeout /t 3 /nobreak >nul

echo Starting Frontend Web Application (Port 5173)...
start "Profit-Loss ERP Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 /nobreak >nul

echo Opening browser at http://localhost:5173 ...
start http://localhost:5173

echo.
echo ========================================================
echo   ERP is now running!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:5050/api
echo   Default Admin:   admin   / admin123
echo   Default Manager: manager / manager123
echo ========================================================
pause
