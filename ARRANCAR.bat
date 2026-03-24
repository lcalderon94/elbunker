@echo off
title El Bunker - Iniciando...
echo ========================================
echo   EL BUNKER - Arrancando todo...
echo ========================================
echo.

echo [1/3] Levantando Docker...
start "El Bunker - Docker" cmd /k "1_docker.bat"
timeout /t 5 /nobreak >nul

echo [2/3] Levantando Backend...
start "El Bunker - Backend" cmd /k "2_backend.bat"
timeout /t 8 /nobreak >nul

echo [3/3] Levantando Frontend...
start "El Bunker - Frontend" cmd /k "3_frontend.bat"

echo.
echo ========================================
echo   Todo arrancado!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3000/api
echo ========================================
echo.
pause
