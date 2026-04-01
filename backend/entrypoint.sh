#!/bin/bash
echo "Esperando a la base de datos..."
while ! nc -z db 5432; do sleep 1; done
echo "Base de datos lista. Corriendo migraciones..."
alembic upgrade head
echo "Arrancando servidor..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
