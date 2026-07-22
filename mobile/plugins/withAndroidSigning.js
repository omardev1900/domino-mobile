/**
 * withAndroidSigning.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Config Plugin Expo — Injecte la signingConfig release dans build.gradle
 * après chaque `npx expo prebuild` ou `npx expo prebuild --clean`.
 *
 * SÉCURITÉ :
 *   - Ce fichier ne contient aucun secret (aucun mot de passe, alias, chemin).
 *   - Les credentials sont lus à l'exécution depuis :
 *       Build local : ~/.gradle/gradle.properties
 *       EAS Build / CI : variables d'environnement
 *   - Ce fichier est versionné dans git : il ne doit contenir que de la structure.
 *
 * IDEMPOTENCE :
 *   - Le plugin détecte la présence du marqueur [withAndroidSigning]
 *     et ne réapplique pas le patch s'il est déjà en place.
 *
 * Propriétés Gradle requises (dans ~/.gradle/gradle.properties) :
 *   UPLOAD_KEYSTORE_PATH   — chemin absolu vers upload-keystore.jks (slashes /)
 *   UPLOAD_STORE_PASSWORD  — mot de passe du keystore
 *   UPLOAD_KEY_ALIAS       — alias de la clé (ex : upload)
 *   UPLOAD_KEY_PASSWORD    — mot de passe de la clé
 *
 * Variables d'environnement équivalentes (EAS Build / CI) :
 *   UPLOAD_KEYSTORE_PATH, UPLOAD_STORE_PASSWORD, UPLOAD_KEY_ALIAS, UPLOAD_KEY_PASSWORD
 *
 * Documentation complète : mobile/docs/signing.md
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { withAppBuildGradle } = require('@expo/config-plugins');

// Marqueur unique pour détecter si le plugin a déjà été appliqué (idempotence)
const MARKER = '// [withAndroidSigning]';

/**
 * Bloc Groovy injecté dans signingConfigs.
 * Aucun secret ici — les valeurs sont lues depuis les propriétés Gradle ou
 * les variables d'environnement au moment de l'exécution de Gradle.
 */
const RELEASE_SIGNING_BLOCK = `
        ${MARKER}
        release {
            // ─── Lecture des credentials de signature ──────────────────────────
            // Priorité 1 : Variables d'environnement (EAS Build, CI/CD)
            // Priorité 2 : ~/.gradle/gradle.properties (build local)
            // Aucun fallback — build échoue si credentials absents.
            // ───────────────────────────────────────────────────────────────────

            def keystorePath  = System.getenv("UPLOAD_KEYSTORE_PATH")
                             ?: (project.hasProperty("UPLOAD_KEYSTORE_PATH") ? UPLOAD_KEYSTORE_PATH : null)
            def storePass     = System.getenv("UPLOAD_STORE_PASSWORD")
                             ?: (project.hasProperty("UPLOAD_STORE_PASSWORD") ? UPLOAD_STORE_PASSWORD : null)
            def keyAlias_     = System.getenv("UPLOAD_KEY_ALIAS")
                             ?: (project.hasProperty("UPLOAD_KEY_ALIAS") ? UPLOAD_KEY_ALIAS : null)
            def keyPass       = System.getenv("UPLOAD_KEY_PASSWORD")
                             ?: (project.hasProperty("UPLOAD_KEY_PASSWORD") ? UPLOAD_KEY_PASSWORD : null)

            if (!keystorePath || !storePass || !keyAlias_ || !keyPass) {
                def missing = []
                if (!keystorePath) missing << "UPLOAD_KEYSTORE_PATH"
                if (!storePass)    missing << "UPLOAD_STORE_PASSWORD"
                if (!keyAlias_)    missing << "UPLOAD_KEY_ALIAS"
                if (!keyPass)      missing << "UPLOAD_KEY_PASSWORD"
                throw new GradleException("""

════════════════════════════════════════════════════════════
❌  BUILD INTERROMPU — Credentials de signature absents
    Propriétés manquantes : \${missing.join(", ")}

    → Build local : ajoutez dans ~/.gradle/gradle.properties
          UPLOAD_KEYSTORE_PATH=/chemin/absolu/upload-keystore.jks
          UPLOAD_STORE_PASSWORD=<mot_de_passe>
          UPLOAD_KEY_ALIAS=upload
          UPLOAD_KEY_PASSWORD=<mot_de_passe>

    → EAS Build / CI : définissez ces variables d'environnement.
    → Documentation : mobile/docs/signing.md
════════════════════════════════════════════════════════════""")
            }

            storeFile     file(keystorePath)
            storePassword storePass
            keyAlias      keyAlias_
            keyPassword   keyPass
        }`;

/**
 * Injecte le bloc release dans signingConfigs si le marqueur est absent.
 * @param {string} contents - Contenu actuel de build.gradle
 * @returns {string} - Contenu modifié
 */
function injectReleaseSigningConfig(contents) {
  if (contents.includes(MARKER)) {
    // Déjà patché — idempotence garantie
    return contents;
  }

  // Cherche la fin du bloc debug { } dans signingConfigs
  // Pattern robuste : fermeture du bloc debug suivie de la fermeture de signingConfigs
  const signingConfigsClosePattern = /(\s+debug \{[^}]*\}\n)((\s+)\}(\s+)buildTypes \{)/;
  const match = signingConfigsClosePattern.exec(contents);

  if (!match) {
    console.warn(
      '[withAndroidSigning] ⚠️  Impossible de localiser signingConfigs { debug { } } dans build.gradle.\n' +
      '  La structure du fichier a peut-être changé avec la nouvelle version d\'Expo.\n' +
      '  Vérifiez manuellement android/app/build.gradle.'
    );
    return contents;
  }

  // Insère le bloc release après le bloc debug, avant la fermeture de signingConfigs
  const insertionPoint = match.index + match[1].length;
  return contents.slice(0, insertionPoint) + RELEASE_SIGNING_BLOCK + '\n' + contents.slice(insertionPoint);
}

/**
 * Remplace signingConfig signingConfigs.debug par signingConfigs.release
 * dans le buildType release uniquement.
 * @param {string} contents
 * @returns {string}
 */
function fixReleaseBuildType(contents) {
  // Localise la section buildTypes
  const buildTypesIdx = contents.indexOf('    buildTypes {');
  if (buildTypesIdx === -1) {
    console.warn('[withAndroidSigning] ⚠️  Impossible de localiser buildTypes dans build.gradle.');
    return contents;
  }

  const beforeBuildTypes = contents.slice(0, buildTypesIdx);
  const buildTypesSection = contents.slice(buildTypesIdx);

  // Dans buildTypes, le bloc "release {" commence après le bloc "debug {"
  const releaseStart = buildTypesSection.indexOf('        release {');
  if (releaseStart === -1) {
    // Le bloc release n'existe pas encore dans buildTypes — Expo le génère toujours,
    // donc ce cas est inhabituel. On ne modifie pas.
    return contents;
  }

  // Remplace signingConfigs.debug par signingConfigs.release dans le bloc release
  const releaseSection = buildTypesSection.slice(releaseStart);
  const patched = releaseSection.replace(
    'signingConfig signingConfigs.debug',
    'signingConfig signingConfigs.release'
  );

  return beforeBuildTypes + buildTypesSection.slice(0, releaseStart) + patched;
}

/**
 * Plugin principal — appliqué par Expo lors de `expo prebuild`.
 */
const withAndroidSigning = (config) => {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      console.warn('[withAndroidSigning] build.gradle non-Groovy détecté — plugin non appliqué.');
      return modConfig;
    }

    let contents = modConfig.modResults.contents;

    contents = injectReleaseSigningConfig(contents);
    contents = fixReleaseBuildType(contents);

    modConfig.modResults.contents = contents;

    console.log('[withAndroidSigning] ✅ signingConfig release injectée dans build.gradle.');
    return modConfig;
  });
};

module.exports = withAndroidSigning;
