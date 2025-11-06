#!/bin/bash

# Script para matar procesos en el puerto 3000

echo "🔍 Buscando procesos en el puerto 3000..."

# Encontrar procesos usando el puerto 3000
PIDS=$(lsof -ti:3000 2>/dev/null)

if [ -z "$PIDS" ]; then
    echo "ℹ️  No hay procesos corriendo en el puerto 3000"
    exit 0
fi

echo "📋 Procesos encontrados:"
lsof -i:3000

echo ""
read -p "¿Deseas eliminar estos procesos? (s/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo "🗑️  Eliminando procesos..."
    echo $PIDS | xargs kill -9 2>/dev/null
    echo "✅ Procesos eliminados"
else
    echo "❌ Operación cancelada"
    exit 1
fi








