import path from 'path';
import { MCPClient } from '../../mcp-client/src';

export async function evaluateTask(input: string) {
  const client = new MCPClient({
    command: path.resolve(__dirname, '../../dist/index.js'),
    args: ['start', process.env.NEON_API_KEY!],
    loggerOptions: {
      mode: 'error',
    },
  });

  await client.start();
  const response = await client.processQuery(input);
  await client.stop();

  if (!response) {
    throw new Error('No response from MCP Client');
  }

  const finalMessage = response[response.length - 1];
  return finalMessage;
}
