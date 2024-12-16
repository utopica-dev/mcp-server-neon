import { InteractiveCLI } from './index.js';

const cli = new InteractiveCLI({
  command: '../dist/index.js',
  args: ['start', process.env.NEON_API_KEY!],
});
cli.start();
