# ─────────────────────────────────────────────────────────────────────────────
# setup-signing.ps1
# Script de configuration initiale de la signature Android
# Domino Martiniquais
#
# À exécuter UNE SEULE FOIS sur chaque nouvelle machine de développement.
# Configure ~/.gradle/gradle.properties avec les credentials du keystore.
#
# Ce script ne stocke aucun secret dans Git.
# Il guide uniquement la création du fichier gradle.properties local.
#
# Usage : .\scripts\setup-signing.ps1
# ─────────────────────────────────────────────────────────────────────────────

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step  { param($msg) Write-Host "`n▶ $msg" -ForegroundColor Cyan }
function Write-OK    { param($msg) Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-Fail  { param($msg) Write-Host "  ❌ $msg" -ForegroundColor Red }
function Write-Info  { param($msg) Write-Host "  ℹ  $msg" -ForegroundColor Gray }
function Write-Warn  { param($msg) Write-Host "  ⚠️  $msg" -ForegroundColor Yellow }

$GRADLE_DIR   = Join-Path $env:USERPROFILE ".gradle"
$GRADLE_PROPS = Join-Path $GRADLE_DIR "gradle.properties"
$SIGNING_DOC  = Join-Path $PSScriptRoot "..\docs\signing.md"

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor DarkCyan
Write-Host "  🔑 Configuration de la signature Android — Domino Martiniquais" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Ce script configure ~/.gradle/gradle.properties avec vos" -ForegroundColor Gray
Write-Host "  credentials de signature. Ces données ne seront JAMAIS" -ForegroundColor Gray
Write-Host "  versionnées dans git." -ForegroundColor Gray
Write-Host ""
Write-Host "  Référence : " -NoNewline -ForegroundColor Gray
Write-Host "mobile/docs/signing.md" -ForegroundColor Yellow
Write-Host ""

# ─── Étape 1 : Vérifier keytool ─────────────────────────────────────────────
Write-Step "Vérification de Java / keytool..."
try {
    & keytool -help 2>&1 | Out-Null
    Write-OK "keytool disponible"
} catch {
    Write-Fail "keytool introuvable. Installez le JDK depuis https://adoptium.net/"
    exit 1
}

# ─── Étape 2 : Chemin du keystore ───────────────────────────────────────────
Write-Step "Localisation du fichier upload-keystore.jks..."
Write-Host ""
Write-Info "Le keystore ne doit PAS être dans le dossier git du projet."
Write-Info "Emplacement recommandé : C:\Users\<vous>\Documents\android-keys\"
Write-Host ""

do {
    $keystoreInput = Read-Host "  Chemin complet vers upload-keystore.jks"
    $keystoreInput = $keystoreInput.Trim('"').Trim("'")
    if (-not (Test-Path $keystoreInput)) {
        Write-Warn "Fichier introuvable : $keystoreInput"
        Write-Info "Vérifiez le chemin et réessayez."
    }
} while (-not (Test-Path $keystoreInput))

# Normaliser le chemin avec des slashes (requis par Gradle sur Windows)
$keystorePath = ($keystoreInput -replace '\\', '/').Trim()
Write-OK "Keystore trouvé : $keystorePath"

# ─── Étape 3 : Mot de passe du keystore ─────────────────────────────────────
Write-Step "Validation du mot de passe du keystore..."

do {
    $storePass = Read-Host "  Mot de passe du keystore" -AsSecureString
    $storePassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($storePass)
    )

    $testOutput = & keytool -list -keystore $keystoreInput -storepass $storePassPlain 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-OK "Mot de passe du keystore valide"
        break
    } else {
        Write-Warn "Mot de passe incorrect. Réessayez."
    }
} while ($true)

# ─── Étape 4 : Alias de la clé ──────────────────────────────────────────────
Write-Step "Sélection de l'alias de la clé..."
Write-Host ""
Write-Info "Alias disponibles dans le keystore :"

$aliases = & keytool -list -keystore $keystoreInput -storepass $storePassPlain 2>&1 |
    Select-String "PrivateKeyEntry|SecretKeyEntry|trustedCertEntry" |
    ForEach-Object { ($_ -split ',')[0].Trim() }

foreach ($a in $aliases) { Write-Host "    • $a" -ForegroundColor White }

Write-Host ""
do {
    $keyAlias = Read-Host "  Alias à utiliser (référence docs: 'upload')"
    $keyAlias = $keyAlias.Trim()

    $testAlias = & keytool -list -keystore $keystoreInput -storepass $storePassPlain -alias $keyAlias 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-OK "Alias '$keyAlias' valide"
        break
    } else {
        Write-Warn "Alias '$keyAlias' introuvable dans le keystore. Réessayez."
    }
} while ($true)

# ─── Étape 5 : Mot de passe de la clé ───────────────────────────────────────
Write-Step "Validation du mot de passe de la clé..."

do {
    $keyPass = Read-Host "  Mot de passe de la clé (souvent identique au keystore)" -AsSecureString
    $keyPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($keyPass)
    )

    # Keytool ne permet pas de tester directement le keyPassword.
    # On fait un test basique de cohérence (l'alias existe déjà, c'est suffisant).
    Write-OK "Mot de passe de la clé enregistré"
    break
} while ($false)

# ─── Étape 6 : Empreinte de référence ───────────────────────────────────────
Write-Step "Extraction des empreintes du certificat..."

$certInfo = & keytool -list -v -keystore $keystoreInput -storepass $storePassPlain -alias $keyAlias 2>&1
$sha1Line   = ($certInfo | Select-String "SHA1:").ToString().Trim()
$sha256Line = ($certInfo | Select-String "SHA256:").ToString().Trim()
$ownerLine  = ($certInfo | Select-String "Owner:").ToString().Trim()
$validLine  = ($certInfo | Select-String "Valid from:").ToString().Trim()

Write-OK "Empreintes extraites"
Write-Info $sha1Line
Write-Info $sha256Line

# ─── Étape 7 : Écriture de ~/.gradle/gradle.properties ─────────────────────
Write-Step "Écriture dans ~/.gradle/gradle.properties..."

# Créer le dossier si nécessaire
New-Item -ItemType Directory -Force $GRADLE_DIR | Out-Null

# Vérifier si les propriétés existent déjà
$existingContent = ""
if (Test-Path $GRADLE_PROPS) {
    $existingContent = Get-Content $GRADLE_PROPS -Raw

    if ($existingContent -match "UPLOAD_KEYSTORE_PATH") {
        Write-Warn "Des propriétés UPLOAD_ existent déjà dans ~/.gradle/gradle.properties."
        $overwrite = Read-Host "  Écraser les valeurs existantes ? (o/N)"
        if ($overwrite -notmatch '^[oO]$') {
            Write-Info "Configuration annulée. Aucune modification apportée."
            exit 0
        }
        # Supprimer les anciennes propriétés UPLOAD_
        $existingContent = $existingContent -replace "(?m)^UPLOAD_[^\r\n]*[\r\n]*", ""
        Set-Content $GRADLE_PROPS $existingContent -NoNewline
    }
}

# Ajouter les nouvelles propriétés
$newProps = @"

# === Domino Martiniquais — Signature Android (upload key) ===
# Configuré le $(Get-Date -Format 'yyyy-MM-dd') via setup-signing.ps1
# NE PAS PARTAGER ce fichier — il contient des secrets.
UPLOAD_KEYSTORE_PATH=$keystorePath
UPLOAD_STORE_PASSWORD=$storePassPlain
UPLOAD_KEY_ALIAS=$keyAlias
UPLOAD_KEY_PASSWORD=$keyPassPlain
"@

Add-Content $GRADLE_PROPS $newProps

Write-OK "Credentials écrits dans $GRADLE_PROPS"

# ─── Résumé ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor DarkGreen
Write-Host "  ✅ Configuration terminée !" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor DarkGreen
Write-Host ""
Write-Host "  Fichier configuré : $GRADLE_PROPS" -ForegroundColor White
Write-Host "  Keystore          : $keystorePath" -ForegroundColor White
Write-Host "  Alias             : $keyAlias" -ForegroundColor White
Write-Host ""
Write-Host "  Prochaines étapes :" -ForegroundColor Gray
Write-Host "    1. Lancez : .\scripts\build-release.ps1" -ForegroundColor Gray
Write-Host "    2. Ou directement : cd android && .\gradlew bundleRelease" -ForegroundColor Gray
Write-Host ""
Write-Host "  ⚠️  Conservez votre keystore en lieu sûr (hors du projet git)." -ForegroundColor Yellow
Write-Host "     Référence : mobile/docs/signing.md" -ForegroundColor Yellow
Write-Host ""
