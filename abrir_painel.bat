@echo off
REM Abre o Painel ICM num servidor local e no navegador.
REM Duplo-clique neste arquivo. Feche a janela "Servidor Painel ICM" para parar.
cd /d "%~dp0"
set "PYEXE=C:\Program Files\QGIS 3.44.12\apps\Python312\python.exe"
set "PYTHONHOME=C:\Program Files\QGIS 3.44.12\apps\Python312"
if not exist "%PYEXE%" (
  echo Nao encontrei o Python do QGIS em:
  echo   %PYEXE%
  echo Ajuste o caminho no topo deste .bat se o QGIS estiver em outra versao/pasta.
  pause
  exit /b 1
)
start "Servidor Painel ICM" "%PYEXE%" -m http.server 8766 --bind 127.0.0.1
timeout /t 2 /nobreak >nul
REM parametro anti-cache: forca o navegador a carregar sempre a versao atual
start "" "http://127.0.0.1:8766/index.html?nc=%RANDOM%%RANDOM%"
echo.
echo Painel aberto em http://127.0.0.1:8766/
echo Para parar, feche a janela "Servidor Painel ICM".
timeout /t 4 /nobreak >nul
