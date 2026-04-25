@echo off
echo ========================================
echo   The Budge - Application Finance
echo ========================================
echo.

REM Verifier si Node.js est installe
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERREUR: Node.js n'est pas trouve dans le PATH.
    echo.
    echo Solutions:
    echo 1. Fermez COMPLETEMENT ce terminal
    echo 2. Rouvrez un nouveau terminal
    echo 3. Relancez ce script
    echo.
    echo OU
    echo.
    echo 1. Redemarrez votre ordinateur
    echo 2. Relancez ce script
    echo.
    pause
    exit /b 1
)

REM Verifier si les dependances sont installees
if not exist "node_modules" (
    echo Installation des dependances en cours...
    echo Cela peut prendre quelques minutes...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ERREUR lors de l'installation des dependances.
        pause
        exit /b 1
    )
    echo.
    echo Installation terminee!
    echo.
)

echo Demarrage du serveur de developpement...
echo.
echo L'application sera accessible sur: http://localhost:3000
echo.
echo Appuyez sur Ctrl+C pour arreter le serveur
echo.
cd /d "%~dp0"
call npm run dev
pause

