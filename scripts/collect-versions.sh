#!/usr/bin/env bash
# Imprime las versiones de las herramientas del proyecto Tendero móvil.
# Uso: bash collect-versions.sh   (correr desde la carpeta raíz del proyecto)
# En Windows: usar Git Bash o WSL.

v() { # nombre, comando
  printf "%-18s " "$1"
  if out=$(eval "$2" 2>&1 | head -n 1); then echo "$out"; else echo "NO ENCONTRADO"; fi
}

echo "== Sistema =="
v "SO" "uname -sr"
echo
echo "== Herramientas =="
v "Node.js" "node --version"
v "npm" "npm --version"
v "Git" "git --version"
v "Ionic CLI" "npx --no-install ionic --version"
v "Java (JDK)" "java -version"
v "adb" "adb --version"
echo
echo "== Dependencias del proyecto (package.json) =="
if [ -f package.json ]; then
  for p in react react-dom typescript @ionic/react @capacitor/core @capacitor/cli @capacitor/android vite; do
    ver=$(node -p "try{const j=require('./package.json');(j.dependencies&&j.dependencies['$p'])||(j.devDependencies&&j.devDependencies['$p'])||'-'}catch(e){'-'}")
    printf "%-22s %s\n" "$p" "$ver"
  done
else
  echo "No se encontró package.json aquí."
fi
echo
echo "== Android (revisar manualmente en Android Studio) =="
echo "Android Studio: Help > About"
echo "SDK: Settings > Languages & Frameworks > Android SDK"
