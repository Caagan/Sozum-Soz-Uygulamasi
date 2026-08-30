@echo off
rem SOZUM SOZ testlercisi: tum test dosyalarini sirayla calistir.
rem Gerekli tek sey: PATH'te node. (jsdom os yoluyla node_modules'ten yuklenir.)
setlocal
cd /d "%~dp0"
node test-app.js
node test-offtopic.js
node test-ai-stamp.js
node test-kvkk-full.js