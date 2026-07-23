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

// Les moteurs de jeu sont generes au build afin de conserver le mobile comme
// source unique sans committer une seconde copie volumineuse.
const gameCoreDir = path.resolve(__dirname, 'src/gameCore');
const gameCoreServicesDir = path.join(gameCoreDir, 'services');
fs.mkdirSync(gameCoreServicesDir, { recursive: true });

[
    'types.ts',
    'store.types.ts',
    'constants.ts',
    'DominoEngine.ts',
    'ScoringEngine.ts',
    'LogicEngine.ts',
    'BotEngine.ts',
    'MeytKayaliEngine.ts',
].forEach(file => {
    fs.copyFileSync(path.join(srcDir, file), path.join(gameCoreDir, file));
});

const gameCoreAiDir = path.join(gameCoreDir, 'ai');
fs.mkdirSync(gameCoreAiDir, { recursive: true });
[
    'EndgameAnalyzer.ts',
    'MonteCarlo.ts',
    'OpponentModeler.ts',
    'TileTracker.ts',
].forEach(file => {
    fs.copyFileSync(path.join(srcDir, 'ai', file), path.join(gameCoreAiDir, file));
});

fs.copyFileSync(
    path.resolve(__dirname, 'src/core/services/LogService.ts'),
    path.join(gameCoreServicesDir, 'LogService.ts')
);

console.log('✅ Synchronisation reussie : Fichiers coeurs copies vers le backend.');
