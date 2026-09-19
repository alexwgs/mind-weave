@echo off
chcp 65001 >nul
cd /d %~dp0
echo 正在启动 MindWeave 后端（单端口模式，含前端页面）...
echo 启动完成后请访问 http://localhost:8080
echo 默认账号：admin / admin123
java -jar mind-weave-backend\target\mind-weave-backend-1.0.0.jar
pause
