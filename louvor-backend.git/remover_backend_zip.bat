
@echo off
echo === REMOVER backend.zip DO HISTÓRICO DO GIT ===

REM 1. Navegar para a pasta do repositório
cd /d C:\Users\bomba\AppLouvor\backend

REM 2. Executar o git-filter-repo.py
echo Executando limpeza com git-filter-repo...
python git-filter-repo.py --path backend.zip --invert-paths

IF %ERRORLEVEL% NEQ 0 (
    echo ERRO ao executar o script! Verifique se o Python está instalado.
    pause
    exit /b 1
)

REM 3. Configurar a URL remota (caso necessário)
git remote set-url origin https://github.com/bombazevedo/louvor-backend.git

REM 4. Push forçado
echo Enviando alterações para o GitHub...
git push origin --force --all

echo === CONCLUÍDO ===
pause
