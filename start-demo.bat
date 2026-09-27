@echo off
cd /d "%~dp0apps\nexus-web"
echo Starting Nexus (real full-stack product) on http://0.0.0.0:3000 ...
echo On your phone (same Wi-Fi): http://THIS-COMPUTER-LAN-IP:3000
echo Find your LAN IP with: ipconfig ^| findstr IPv4
node server.js
pause