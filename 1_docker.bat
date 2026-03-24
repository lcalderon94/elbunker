@echo off
title El Bunker - Base de Datos
echo ========================================
echo   EL BUNKER - Levantando Docker...
echo ========================================
cd /d "C:\Users\luis_\OneDrive\Escritorio\files (4)\el-bunker\apps\api"
docker compose up -d
echo.
echo Base de datos lista!
echo.
pause
