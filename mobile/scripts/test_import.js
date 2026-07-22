const fs = require('fs');
try {
    require('./outBots.cjs');
    console.log("Import successful");
} catch (e) {
    fs.writeFileSync('import_error.txt', e.stack);
}
