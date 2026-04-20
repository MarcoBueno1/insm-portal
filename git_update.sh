#!/bin/bash
# Script para adicionar novos arquivos e arquivos alterados ao git

echo "Adicionando alterações ao Git..."
git add .

echo "Status atual:"
git status --short

echo ""
echo "Agora você pode fazer o commit e o push:"
echo "git commit -m 'Atualização do portal INSM'"
echo "git push"
