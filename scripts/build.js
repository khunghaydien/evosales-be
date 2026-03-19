const path = require('path');
const { spawnSync } = require('child_process');

const appName = process.env.APP_NAME || 'api';
const result = spawnSync('npx', ['nest', 'build', appName], {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, '..'),
});

process.exit(result.status != null ? result.status : 0);
