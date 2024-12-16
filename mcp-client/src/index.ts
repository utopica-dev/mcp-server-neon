import { Anthropic } from '@anthropic-ai/sdk';

import {
  StdioClientTransport,
  StdioServerParameters,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  ListToolsResultSchema,
  CallToolResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import chalk from 'chalk';
import readline from 'readline/promises';
import { Tool } from '@anthropic-ai/sdk/resources/index.mjs';

const EXIT_COMMAND = 'exit';

const styles = {
  prompt: chalk.green('You: '),
  assistant: chalk.blue('Claude: '),
  tool: {
    name: chalk.cyan.bold,
    args: chalk.yellow,
    bracket: chalk.dim,
  },
  error: chalk.red,
  info: chalk.blue,
  success: chalk.green,
  warning: chalk.yellow,
  separator: chalk.gray('─'.repeat(50)),
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export class InteractiveCLI {
  private anthropicClient: Anthropic;
  private messages: Message[] = [];
  private mcpClient: Client;
  private transport: StdioClientTransport;
  private tools: Tool[] = [];
  private rl: readline.Interface;

  constructor(serverConfig: StdioServerParameters) {
    this.anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    this.mcpClient = new Client(
      { name: 'cli-client', version: '1.0.0' },
      { capabilities: {} },
    );

    this.transport = new StdioClientTransport(serverConfig);
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async start() {
    try {
      console.log(styles.separator);
      console.log(styles.info('🤖 Interactive Claude CLI'));
      console.log(
        styles.info(`Type your queries or "${EXIT_COMMAND}" to exit`),
      );
      console.log(styles.separator);

      await this.mcpClient.connect(this.transport);
      await this.initMCPTools();

      await this.chat_loop();
    } catch (error) {
      console.error(styles.error('Failed to initialize tools:'), error);
      process.exit(1);
    } finally {
      this.rl.close();
      process.exit(0);
    }
  }

  private async initMCPTools() {
    const toolsResults = await this.mcpClient.request(
      { method: 'tools/list' },
      ListToolsResultSchema,
    );
    this.tools = toolsResults.tools.map(({ inputSchema, ...tool }) => ({
      ...tool,
      input_schema: inputSchema,
    }));
  }

  private formatToolCall(toolName: string, args: any): string {
    return (
      '\n' +
      styles.tool.bracket('[') +
      styles.tool.name(toolName) +
      styles.tool.bracket('] ') +
      styles.tool.args(JSON.stringify(args, null, 2)) +
      '\n'
    );
  }

  private formatJSON(json: string): string {
    return json
      .replace(/"([^"]+)":/g, chalk.blue('"$1":'))
      .replace(/: "([^"]+)"/g, ': ' + chalk.green('"$1"'));
  }

  private async processQuery(query: string) {
    try {
      this.messages.push({ role: 'user', content: query });

      const response = await this.anthropicClient.messages.create({
        messages: this.messages,
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        tools: this.tools,
      });

      let final_text = [];

      for (const content of response.content) {
        if (content.type === 'text') {
          process.stdout.write(styles.assistant + content.text);
          final_text.push(content.text);
        } else if (content.type === 'tool_use') {
          const toolName = content.name;
          const toolArgs = content.input;

          console.log(this.formatToolCall(toolName, toolArgs));

          const toolResult = await this.mcpClient.request(
            {
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: toolArgs,
              },
            },
            CallToolResultSchema,
          );

          if (
            content &&
            'text' in content &&
            typeof content.text === 'string'
          ) {
            this.messages.push({
              role: 'assistant',
              content: content.text,
            });
          }

          const formattedResult = this.formatJSON(
            JSON.stringify(toolResult.content[0].text),
          );
          this.messages.push({
            role: 'user',
            content: formattedResult,
          });

          const nextResponse = await this.anthropicClient.messages.create({
            messages: this.messages,
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 8192,
          });

          if (nextResponse.content[0].type === 'text') {
            process.stdout.write(
              styles.assistant + nextResponse.content[0].text,
            );
            final_text.push(nextResponse.content[0].text);
          }
        }
      }

      return final_text.join('\n');
    } catch (error) {
      console.error(styles.error('\nError during query processing:'), error);
    }
  }

  private async chat_loop() {
    while (true) {
      try {
        const query = (await this.rl.question(styles.prompt)).trim();
        if (query.toLowerCase() === EXIT_COMMAND) {
          console.log(styles.warning('\nGoodbye! 👋'));
          break;
        }

        await this.processQuery(query);
        console.log('\n' + styles.separator);
      } catch (error) {
        console.error(styles.error('\nError:'), error);
      }
    }
  }
}
