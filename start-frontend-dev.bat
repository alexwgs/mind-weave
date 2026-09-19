@echo off
chcp 65001 >nul
cd /d %~dp0mind-weave-frontend
echo 正在启动 MindWeave 前端开发服务器（需先启动后端 start-backend.bat）...
echo 访问 http://localhost:5173
npm run dev
pause
