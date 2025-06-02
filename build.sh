#!/bin/bash

# build.sh - Script de build pour Render
set -e  # Arrêter en cas d'erreur

echo "=== DEBUT DU BUILD ==="
echo "Working directory: $(pwd)"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

echo ""
echo "=== CONTENU DU REPERTOIRE ==="
ls -la

echo ""
echo "=== INSTALLATION DES DEPENDANCES CLIENT ==="
if [ -d "client" ]; then
    echo "Dossier client trouve"
    cd client
    echo "Contenu du dossier client:"
    ls -la
    
    if [ -f "package.json" ]; then
        echo "package.json trouve, installation des dependances..."
        NPM_CONFIG_PRODUCTION=false npm install
        echo "Dependances installees avec succes"
        
        echo ""
        echo "=== BUILD DE L'APPLICATION REACT ==="
        npm run build
        echo "Build React termine"
        
        echo ""
        echo "=== VERIFICATION DU BUILD ==="
        if [ -d "build" ]; then
            echo "✓ Dossier build cree avec succes"
            echo "Contenu du build:"
            ls -la build/
            echo "Taille du build:"
            du -sh build/
            
            # Vérifier index.html
            if [ -f "build/index.html" ]; then
                echo "✓ index.html present"
                echo "Taille de index.html: $(du -sh build/index.html)"
            else
                echo "✗ index.html manquant!"
                exit 1
            fi
        else
            echo "✗ Dossier build manquant!"
            exit 1
        fi
        
        cd ..
    else
        echo "✗ package.json manquant dans le dossier client!"
        exit 1
    fi
else
    echo "✗ Dossier client manquant!"
    exit 1
fi

echo ""
echo "=== BUILD TERMINE AVEC SUCCES ==="
echo "Structure finale:"
find . -name "build" -type d -exec ls -la {} \;