# Script de Despliegue de Feria Local a Servidor Kali Linux
# Este script empaqueta las ramas de git (main, Publico, Casetero, Administrador) y las sube vía SCP/SSH.

# --- CONFIGURACIÓN DE CONEXIÓN ---
$KALI_IP = "192.168.1.15"  # Cambia por la IP de tu servidor Kali
$KALI_USER = "kali"        # Cambia por tu usuario en Kali
$TARGET_DIR = "/var/www/feria"
# ---------------------------------

Write-Host "=== Iniciando Despliegue de Feria Local ===" -ForegroundColor Cyan
Write-Host "Servidor Destino: $KALI_USER@$KALI_IP" -ForegroundColor Yellow

# 1. Crear archivos temporales locales
Write-Host "`n[1/4] Creando archivos temporales locales..." -ForegroundColor Blue
$tempFiles = @()

$branches = @{
    "main" = "main.tar"
    "Publico" = "publico.tar"
    "Casetero" = "casetero.tar"
    "Administrador" = "administrador.tar"
}

foreach ($branch in $branches.Keys) {
    $tarFile = $branches[$branch]
    Write-Host "  Empaquetando rama '$branch' -> $tarFile..."
    git archive --format=tar -o $tarFile $branch
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error al empaquetar la rama $branch. Asegúrate de que no haya errores de git." -ForegroundColor Red
        exit 1
    }
    $tempFiles += $tarFile
}

# 2. Transferir archivos temporales a Kali
Write-Host "`n[2/4] Transfiriendo paquetes a Kali (/tmp)..." -ForegroundColor Blue
foreach ($tarFile in $tempFiles) {
    Write-Host "  Subiendo $tarFile..."
    scp $tarFile "$($KALI_USER)@$($KALI_IP):/tmp/"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error al transferir $tarFile. Verifica la IP del servidor, que SSH esté activo y tus credenciales." -ForegroundColor Red
        # Limpiar temporales locales
        foreach ($f in $tempFiles) { Remove-Item $f -ErrorAction SilentlyContinue }
        exit 1
    }
}

# 3. Ejecutar comandos de extracción e instalación en Kali
Write-Host "`n[3/4] Extrayendo paquetes en el servidor Nginx..." -ForegroundColor Blue

$sshCmd = @"
sudo mkdir -p $TARGET_DIR/main $TARGET_DIR/publico $TARGET_DIR/casetero $TARGET_DIR/administrador

echo 'Extraiendo main...'
sudo tar -xf /tmp/main.tar -C $TARGET_DIR/main
echo 'Extraiendo publico...'
sudo tar -xf /tmp/publico.tar -C $TARGET_DIR/publico
echo 'Extraiendo casetero...'
sudo tar -xf /tmp/casetero.tar -C $TARGET_DIR/casetero
echo 'Extraiendo administrador...'
sudo tar -xf /tmp/administrador.tar -C $TARGET_DIR/administrador

echo 'Aplicando permisos de Nginx...'
sudo chown -R \$USER:www-data $TARGET_DIR
sudo find $TARGET_DIR -type d -exec chmod 755 {} \;
sudo find $TARGET_DIR -type f -exec chmod 644 {} \;

echo 'Limpiando archivos temporales en el servidor...'
sudo rm -f /tmp/main.tar /tmp/publico.tar /tmp/casetero.tar /tmp/administrador.tar

echo 'Reinicio de Nginx...'
sudo systemctl restart nginx
"@

ssh -t "$($KALI_USER)@$($KALI_IP)" $sshCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error ejecutando comandos remotos en Kali." -ForegroundColor Red
} else {
    Write-Host "`n[4/4] ¡Despliegue finalizado con éxito!" -ForegroundColor Green
    Write-Host "Acceso a la Landing Page: http://$KALI_IP/" -ForegroundColor Green
    Write-Host "Acceso al Mapa Público:  http://$KALI_IP/publico/" -ForegroundColor Green
    Write-Host "Acceso al Portal Casetero: http://$KALI_IP/casetero/" -ForegroundColor Green
    Write-Host "Acceso al Administrador:  http://$KALI_IP/administrador/" -ForegroundColor Green
}

# 4. Limpieza local
foreach ($f in $tempFiles) { Remove-Item $f -ErrorAction SilentlyContinue }
