@echo off
chcp 65001 >nul
cd /d "C:\Users\Пользователь\OneDrive\Desktop\Новая папка (7)"
npm run build 2>&1
echo BUILD_DONE
pause
