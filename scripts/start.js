const path = require('path');
const { spawn } = require('child_process');

const appName = process.env.APP_NAME || 'api';
const mainPath = path.join(__dirname, '..', 'dist', 'apps', appName, 'main.js');

const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, '--no-deprecation'].filter(Boolean).join(' '),
};

spawn(process.execPath, [mainPath], {
  stdio: 'inherit',
  env,
  cwd: path.join(__dirname, '..'),
})
  .on('error', (err) => {
    console.error(err);
    process.exit(1);
  })
  .on('exit', (code) => {
    process.exit(code != null ? code : 0);
  });
