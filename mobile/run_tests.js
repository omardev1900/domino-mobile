const { spawn } = require('child_process');

const jest = spawn('npx.cmd', ['jest', '--verbose'], { shell: true });

jest.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
});

jest.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
});

jest.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
});
