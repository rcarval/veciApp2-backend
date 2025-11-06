#!/bin/bash

# =====================================================
# Script para instalar dependencias de notificaciones push
# =====================================================

echo "🔔 Instalando dependencias para notificaciones push..."
echo ""

# Backend
echo "📦 Instalando dependencias del backend..."
cd veciApp2-backend
npm install firebase-admin
echo "✅ Backend: firebase-admin instalado"
echo ""

# Frontend
echo "📦 Instalando dependencias del frontend..."
cd ../veciApp
npx expo install expo-notifications expo-device expo-constants
echo "✅ Frontend: expo-notifications instalado"
echo ""

echo "✅ ¡Todas las dependencias instaladas!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Ejecuta el script SQL: AGREGAR_FCM_TOKEN.sql"
echo "2. Configura Firebase Console y descarga credenciales"
echo "3. Coloca firebase-adminsdk.json en veciApp2-backend/src/config/"
echo "4. Coloca google-services.json en veciApp/"
echo "5. Coloca GoogleService-Info.plist en veciApp/"
echo "6. Rebuild la app: npx expo prebuild && npx expo run:android"
echo ""
echo "📚 Consulta GUIA_NOTIFICACIONES_PUSH.md para más detalles"

