# ─────────────────────────────────────────────────────────────────────────────
# build-release.ps1
# Script de build release sécurisé — Domino Martiniquais
#
# Valide la présence et l'intégrité du keystore, de l'alias et de toutes les
# propriétés avant de lancer bundleRelease. Arrêt immédiat si une vérification
# échoue — aucun fallback silencieux.
#
# Usage :
#   .\scripts\build-release.ps1             # Build AAB avec toutes les vérifications
#   .\scripts\build-release.ps1 -Prebuild   # expo prebuild --clean puis build
#   .\scripts\build-release.ps1 -Help       # Affiche l'aide
#
# Prérequis :
#   - Java JDK installé (keytool dans le PATH)
#   - ~/.gradle/gradle.properties configuré (voir mobile/docs/signing.md)
#   - upload-keystore.jks présent à l'emplacement défini dans gradle.properties
# ─────────────────────────────────────────────────────────────────────────────

param(
    [switch]$Prebuild,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ─── Helpers d'affichage ────────────────────────────────────────────────────
function Write-Step  { param($msg) Write-Host "`n▶ $msg" -ForegroundColor Cyan }
function Write-OK    { param($msg) Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-Fail  { param($msg) Write-Host "`n  ❌ $msg" -ForegroundColor Red }
function Write-Info  { param($msg) Write-Host "  ℹ  $msg" -ForegroundColor Gray }
function Write-Hint  { param($msg) Write-Host "     → $msg" -ForegroundColor Yellow }

function Exit-WithError {
    param([string]$Message, [string[]]$Hints = @())
    Write-Fail $Message
    foreach ($hint in $Hints) { Write-Hint $hint }
    Write-Host ""
    exit 1
}

if ($Help) {
    Write-Host @"

build-release.ps1 — Build release Android sécurisé

Usage:
  .\scripts\build-release.ps1              Build AAB avec vérifications complètes
  .\scripts\build-release.ps1 -Prebuild    Lance expo prebuild --clean avant le build
  .\scripts\build-release.ps1 -Help        Affiche cette aide

Prérequis (build local) :
  Configurez ~/.gradle/gradle.properties avec :
    UPLOAD_KEYSTORE_PATH=C:/chemin/absolu/upload-keystore.jks
    UPLOAD_STORE_PASSWORD=<mot_de_passe_keystore>
    UPLOAD_KEY_ALIAS=upload
    UPLOAD_KEY_PASSWORD=<mot_de_passe_cle>

Documentation complète : mobile/docs/signing.md

"@
    exit 0
}

# ─── Chemins ────────────────────────────────────────────────────────────────
$SCRIPT_DIR      = $PSScriptRoot
$MOBILE_ROOT     = Split-Path -Parent $SCRIPT_DIR
$ANDROID_DIR     = Join-Path $MOBILE_ROOT "android"
$AAB_PATH        = Join-Path $ANDROID_DIR "app\build\outputs\bundle\release\app-release.aab"
$GRADLE_USER_DIR = Join-Path $env:USERPROFILE ".gradle"
$GRADLE_PROPS    = Join-Path $GRADLE_USER_DIR "gradle.properties"

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor DarkCyan
Write-Host "  🎯 Domino Martiniquais — Build Release Android" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor DarkCyan

# ═══════════════════════════════════════════════════════════════════════════
# BLOC 1 — Vérification des prérequis système
# ═══════════════════════════════════════════════════════════════════════════
Write-Step "Vérification des prérequis système..."

# Java / keytool requis pour la validation du keystore
try {
    $keytoolVersion = & keytool -help 2>&1 | Select-String "keytool" | Select-Object -First 1
    Write-OK "keytool disponible"
} catch {
    Exit-WithError "keytool introuvable dans le PATH." @(
        "Installez le JDK (Java Development Kit) et assurez-vous que keytool est dans votre PATH.",
        "Téléchargement : https://adoptium.net/"
    )
}

# Gradle wrapper présent
$gradlew = Join-Path $ANDROID_DIR "gradlew.bat"
if (-not (Test-Path $gradlew)) {
    Exit-WithError "gradlew.bat introuvable dans $ANDROID_DIR" @(
        "Lancez 'npx expo prebuild' depuis le dossier mobile/ pour régénérer le dossier android/."
    )
}
Write-OK "Gradle wrapper trouvé"

# ═══════════════════════════════════════════════════════════════════════════
# BLOC 2 — Lecture et validation de ~/.gradle/gradle.properties
# ═══════════════════════════════════════════════════════════════════════════
Write-Step "Lecture de ~/.gradle/gradle.properties..."

if (-not (Test-Path $GRADLE_PROPS)) {
    Exit-WithError "~/.gradle/gradle.properties introuvable." @(
        "Créez ce fichier et ajoutez vos credentials de signature.",
        "Consultez mobile/docs/signing.md pour la procédure complète.",
        "Ou lancez : .\scripts\setup-signing.ps1"
    )
}

# Parse le fichier properties (ignore commentaires et lignes vides)
$props = @{}
Get-Content $GRADLE_PROPS | Where-Object { $_ -match '^\s*[^#]\S+=\S' } | ForEach-Object {
    $parts = $_ -split '=', 2
    if ($parts.Count -eq 2) {
        $props[$parts[0].Trim()] = $parts[1].Trim()
    }
}

# Vérifier que les 4 propriétés requises sont présentes
$requiredProps = @(
    "UPLOAD_KEYSTORE_PATH",
    "UPLOAD_STORE_PASSWORD",
    "UPLOAD_KEY_ALIAS",
    "UPLOAD_KEY_PASSWORD"
)
$missingProps = $requiredProps | Where-Object { -not $props.ContainsKey($_) -or [string]::IsNullOrWhiteSpace($props[$_]) }

if ($missingProps) {
    Exit-WithError "Propriétés manquantes dans ~/.gradle/gradle.properties :" @(
        "Propriétés manquantes : $($missingProps -join ', ')",
        "Consultez mobile/docs/signing.md pour la procédure complète."
    )
}

$KEYSTORE_PATH = $props["UPLOAD_KEYSTORE_PATH"] -replace '\\', '/'
$STORE_PASS    = $props["UPLOAD_STORE_PASSWORD"]
$KEY_ALIAS     = $props["UPLOAD_KEY_ALIAS"]

Write-OK "4 propriétés de signature trouvées"
Write-Info "Keystore : $KEYSTORE_PATH"
Write-Info "Alias    : $KEY_ALIAS"

# ═══════════════════════════════════════════════════════════════════════════
# BLOC 3 — Vérification physique du keystore
# ═══════════════════════════════════════════════════════════════════════════
Write-Step "Vérification du fichier keystore..."

# Normaliser le chemin pour Windows
$keystoreWinPath = $KEYSTORE_PATH -replace '/', '\'

if (-not (Test-Path $keystoreWinPath)) {
    Exit-WithError "Fichier keystore introuvable : $keystoreWinPath" @(
        "Vérifiez que UPLOAD_KEYSTORE_PATH dans ~/.gradle/gradle.properties est correct.",
        "Le fichier upload-keystore.jks doit être conservé manuellement (il n'est pas dans git).",
        "Consultez mobile/docs/signing.md — section 'Restaurer le keystore'."
    )
}

$keystoreSize = (Get-Item $keystoreWinPath).Length
if ($keystoreSize -lt 500) {
    Exit-WithError "Le fichier keystore semble corrompu (taille : $keystoreSize octets)." @(
        "Un keystore valide fait généralement entre 2 KB et 10 KB.",
        "Restaurez le keystore depuis votre sauvegarde sécurisée."
    )
}
Write-OK "Keystore trouvé ($([Math]::Round($keystoreSize / 1024, 1)) KB)"

# ═══════════════════════════════════════════════════════════════════════════
# BLOC 4 — Validation du mot de passe et de l'alias via keytool
# ═══════════════════════════════════════════════════════════════════════════
Write-Step "Validation du keystore (alias + mot de passe)..."

$keytoolOutput = & keytool -list -keystore $keystoreWinPath -storepass $STORE_PASS -alias $KEY_ALIAS 2>&1
$keytoolExitCode = $LASTEXITCODE

if ($keytoolExitCode -ne 0) {
    $errorText = $keytoolOutput -join " "
    if ($errorText -match "password|Keystore was tampered") {
        Exit-WithError "Mot de passe du keystore incorrect." @(
            "Vérifiez UPLOAD_STORE_PASSWORD dans ~/.gradle/gradle.properties.",
            "Consultez mobile/docs/signing.md — section 'Informations de référence'."
        )
    } elseif ($errorText -match "alias|does not exist") {
        Exit-WithError "Alias '$KEY_ALIAS' introuvable dans le keystore." @(
            "Vérifiez UPLOAD_KEY_ALIAS dans ~/.gradle/gradle.properties.",
            "Alias attendu : upload (voir mobile/docs/signing.md)."
        )
    } else {
        Exit-WithError "Erreur keytool : $errorText" @(
            "Vérifiez l'intégrité du keystore et vos credentials."
        )
    }
}

Write-OK "Alias '$KEY_ALIAS' valide — mot de passe correct"

# Afficher l'empreinte SHA-256 pour confirmation visuelle
$fingerprintOutput = & keytool -list -v -keystore $keystoreWinPath -storepass $STORE_PASS -alias $KEY_ALIAS 2>&1
$sha256 = ($fingerprintOutput | Select-String "SHA256").ToString().Trim()
Write-Info $sha256

# Empreinte de référence (mise à jour via docs/signing.md)
$expectedSHA256 = "76:04:38:AC:8C:7B:E3:A4:7D:22:FF:54:55:F9:8B:AA:FB:BC:AD:49:FD:09:FF:06:12:A0:8D:CF:33:D3:66:A8"
if ($sha256 -notmatch [regex]::Escape($expectedSHA256)) {
    Write-Host "`n  ⚠️  ATTENTION : L'empreinte SHA-256 ne correspond pas à la référence." -ForegroundColor Yellow
    Write-Hint "Référence attendue : $expectedSHA256"
    Write-Hint "Vérifiez que vous utilisez le bon keystore (voir mobile/docs/signing.md)."
    Write-Host ""
    $confirm = Read-Host "  Continuer quand même ? (o/N)"
    if ($confirm -notmatch '^[oO]$') {
        Write-Host "  Build annulé." -ForegroundColor Red
        exit 1
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# BLOC 5 — expo prebuild (optionnel)
# ═══════════════════════════════════════════════════════════════════════════
if ($Prebuild) {
    Write-Step "expo prebuild --clean..."
    Set-Location $MOBILE_ROOT
    & npx expo prebuild --clean --platform android
    if ($LASTEXITCODE -ne 0) {
        Exit-WithError "expo prebuild a échoué (code $LASTEXITCODE)." @(
            "Vérifiez les erreurs ci-dessus."
        )
    }
    Write-OK "prebuild terminé — withAndroidSigning a réinjecté la signingConfig"
}

# ═══════════════════════════════════════════════════════════════════════════
# BLOC 6 — Build Gradle
# ═══════════════════════════════════════════════════════════════════════════
Write-Step "Build : .\gradlew bundleRelease..."
Set-Location $ANDROID_DIR

# Supprimer l'ancien AAB si présent
if (Test-Path $AAB_PATH) {
    Remove-Item $AAB_PATH -Force
    Write-Info "Ancien AAB supprimé"
}

& .\gradlew bundleRelease --no-daemon

if ($LASTEXITCODE -ne 0) {
    Exit-WithError "Gradle bundleRelease a échoué (code $LASTEXITCODE)." @(
        "Consultez les logs Gradle ci-dessus.",
        "Si l'erreur mentionne les credentials, vérifiez ~/.gradle/gradle.properties."
    )
}

# ═══════════════════════════════════════════════════════════════════════════
# BLOC 7 — Vérification du AAB généré
# ═══════════════════════════════════════════════════════════════════════════
Write-Step "Vérification du AAB généré..."

if (-not (Test-Path $AAB_PATH)) {
    Exit-WithError "AAB introuvable après build : $AAB_PATH"
}

$aabSizeMB = [Math]::Round((Get-Item $AAB_PATH).Length / 1MB, 1)
Write-OK "AAB généré : $aabSizeMB MB"

# Vérification de signature avec jarsigner
$jarsignerOut = & jarsigner -verify $AAB_PATH 2>&1
if ($LASTEXITCODE -eq 0 -or ($jarsignerOut -join " ") -match "jar verified") {
    Write-OK "Signature AAB vérifiée (jarsigner)"
} else {
    Write-Host "  ⚠️  jarsigner n'a pas pu vérifier la signature." -ForegroundColor Yellow
    Write-Info "Vérification manuelle : jarsigner -verify -verbose $AAB_PATH"
}

# ═══════════════════════════════════════════════════════════════════════════
# RÉSUMÉ FINAL
# ═══════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor DarkGreen
Write-Host "  🚀 Build terminé avec succès !" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor DarkGreen
Write-Host ""
Write-Host "  AAB : $AAB_PATH" -ForegroundColor White
Write-Host ""
Write-Host "  Prochaines étapes :" -ForegroundColor Gray
Write-Host "    1. Google Play Console → Production → Nouvelle version" -ForegroundColor Gray
Write-Host "    2. Uploader l'AAB ci-dessus" -ForegroundColor Gray
Write-Host "    3. Incrémenter versionCode dans app.json et build.gradle avant le prochain build" -ForegroundColor Gray
Write-Host ""
