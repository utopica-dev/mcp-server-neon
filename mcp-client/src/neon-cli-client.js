'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const cli_client_1 = require('./cli-client');
const cli = new cli_client_1.InteractiveCLI({
  command: '../dist/index.js',
  args: ['start', process.env.NEON_API_KEY],
});
cli.start();
