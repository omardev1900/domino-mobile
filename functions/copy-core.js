const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../mobile/src/core');
const destDir = path.resolve(__dirname, 'src/core');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

// Les fichiers centraux dont le backend a besoin pour fonctionner de manière synchrone
const filesToCopy = [
    'economy.types.ts', 
    'economy.constants.ts', 
    'store.types.ts', 
    'types.ts', 
    'RewardEngine.ts'
];

filesToCopy.forEach(file => {
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
});

console.log('✅ Synchronisation reussie : Fichiers coeurs copies vers le backend.');
