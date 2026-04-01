#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Crear entorno virtual si no existe
if [ ! -d "venv" ]; then
    echo "Creando entorno virtual..."
    python3 -m venv venv
fi

# Activar entorno virtual
source venv/bin/activate

# Instalar/actualizar dependencias
echo "Instalando dependencias..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Aplicar migraciones
echo "Aplicando migraciones..."
alembic upgrade head

# Arrancar servidor con hot-reload
echo "Arrancando servidor en http://localhost:8000"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
