# Script para resetear la password del usuario 'rumofe' en PostgreSQL.
# REQUIERE EJECUTAR COMO ADMINISTRADOR.
# Modifica temporalmente pg_hba.conf -> trust, resetea, y restaura.

$ErrorActionPreference = "Stop"

$NEW_PASSWORD = "tfg_password"
$DB_USER      = "rumofe"
$PG_DATA      = "C:\Program Files\PostgreSQL\16\data"
$PG_BIN       = "C:\Program Files\PostgreSQL\16\bin"
$HBA_FILE     = "$PG_DATA\pg_hba.conf"
$HBA_BACKUP   = "$PG_DATA\pg_hba.conf.bak_resetpw"
$SERVICE      = "postgresql-x64-16"

Write-Host "[1/6] Backup de pg_hba.conf..." -ForegroundColor Cyan
Copy-Item $HBA_FILE $HBA_BACKUP -Force

Write-Host "[2/6] Cambiando autenticacion local a 'trust'..." -ForegroundColor Cyan
$content = Get-Content $HBA_FILE -Raw
$modified = $content `
    -replace 'host\s+all\s+all\s+127\.0\.0\.1/32\s+\S+', 'host    all             all             127.0.0.1/32            trust' `
    -replace 'host\s+all\s+all\s+::1/128\s+\S+',         'host    all             all             ::1/128                 trust' `
    -replace 'local\s+all\s+all\s+\S+',                  'local   all             all                                     trust'
Set-Content $HBA_FILE -Value $modified -Encoding ASCII

Write-Host "[3/6] Reiniciando servicio PostgreSQL..." -ForegroundColor Cyan
Restart-Service $SERVICE -Force
Start-Sleep -Seconds 3

Write-Host "[4/6] Reseteando password de '$DB_USER'..." -ForegroundColor Cyan
$sql = "ALTER USER $DB_USER WITH PASSWORD '$NEW_PASSWORD';"
& "$PG_BIN\psql.exe" -U postgres -h localhost -d postgres -c $sql
if ($LASTEXITCODE -ne 0) {
    Write-Host "Fallo el ALTER USER. Restaurando pg_hba.conf y abortando." -ForegroundColor Red
    Copy-Item $HBA_BACKUP $HBA_FILE -Force
    Restart-Service $SERVICE -Force
    exit 1
}

Write-Host "[5/6] Restaurando pg_hba.conf original..." -ForegroundColor Cyan
Copy-Item $HBA_BACKUP $HBA_FILE -Force
Remove-Item $HBA_BACKUP

Write-Host "[6/6] Reiniciando PostgreSQL con configuracion original..." -ForegroundColor Cyan
Restart-Service $SERVICE -Force
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "OK! La password de '$DB_USER' ahora es '$NEW_PASSWORD'." -ForegroundColor Green
Write-Host "Puedes arrancar el backend con normalidad." -ForegroundColor Green
