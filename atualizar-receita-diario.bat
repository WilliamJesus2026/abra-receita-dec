@echo off
rem Rotina diaria do Receita DEC (Agendador do Windows, ~09:20). Vendas = Comparativo mais novo; posicoes = Ritmo de hoje. Sem Ritmo de hoje, nao publica.
cd /d "%~dp0"
echo [%date% %time%] inicio >> atualizar-receita.log
"C:\Users\william.jesus\AppData\Local\Python\pythoncore-3.14-64\python.exe" diario.py >> atualizar-receita.log 2>&1
echo [%date% %time%] fim (codigo %errorlevel%) >> atualizar-receita.log
