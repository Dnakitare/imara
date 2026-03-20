import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { AuditStore } from '@imara/store';
import type { PolicyEngine } from '@imara/policy';
import { ToolCallInterceptor } from './interceptor.js';

export interface ProxyConfig {
  downstreamCommand: string;
  downstreamArgs: string[];
  serverName: string;
  store: AuditStore;
  policyEngine: PolicyEngine;
  sessionId?: string;
  env?: Record<string, string>;
}

export async function startProxy(config: ProxyConfig): Promise<void> {
  const sessionId = config.sessionId ?? randomUUID();

  const interceptor = new ToolCallInterceptor({
    store: config.store,
    policyEngine: config.policyEngine,
    serverName: config.serverName,
    sessionId,
  });

  // Create downstream client transport — spawns the real MCP server
  const downstreamTransport = new StdioClientTransport({
    command: config.downstreamCommand,
    args: config.downstreamArgs,
    env: config.env ? { ...process.env, ...config.env } as Record<string, string> : undefined,
  });

  const downstreamClient = new Client(
    { name: `imara-proxy-${config.serverName}`, version: '0.1.0' },
    { capabilities: {} }
  );

  // Connect to the downstream (real) MCP server
  await downstreamClient.connect(downstreamTransport);

  // Create the upstream server that Claude Code will talk to
  const upstreamServer = new Server(
    { name: `imara-proxy-${config.serverName}`, version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  // Handle tools/list — mirror downstream tools
  upstreamServer.setRequestHandler(ListToolsRequestSchema, async () => {
    const result = await downstreamClient.listTools();
    return { tools: result.tools };
  });

  // Handle tools/call — intercept, evaluate policy, forward or block
  upstreamServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const toolArgs = (request.params.arguments ?? {}) as Record<string, unknown>;

    // Evaluate policy
    const policyResult = interceptor.evaluatePolicy(toolName, toolArgs);

    if (policyResult.decision === 'deny') {
      // Log the blocked call
      interceptor.createAndStoreEvent({
        toolName,
        toolArguments: toolArgs,
        policyDecision: 'deny',
        policyReason: policyResult.reason,
        policiesEvaluated: policyResult.policiesEvaluated,
        resultStatus: 'blocked',
        resultSummary: `Blocked by policy: ${policyResult.reason}`,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `[IMARA] Tool call blocked: ${policyResult.reason}`,
          },
        ],
        isError: true,
      };
    }

    // Forward to downstream
    const startTime = Date.now();
    let resultStatus: 'success' | 'error' = 'success';
    let resultSummary: string | undefined;
    let result: any;

    try {
      result = await downstreamClient.callTool({
        name: toolName,
        arguments: toolArgs,
      });
      resultSummary = summarizeResult(result);
      if (result.isError) {
        resultStatus = 'error';
      }
    } catch (err) {
      resultStatus = 'error';
      resultSummary = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const latencyMs = Date.now() - startTime;

      // Log the event
      interceptor.createAndStoreEvent({
        toolName,
        toolArguments: toolArgs,
        policyDecision: policyResult.decision,
        policyReason: policyResult.reason,
        policiesEvaluated: policyResult.policiesEvaluated,
        resultStatus,
        resultSummary,
        resultLatencyMs: latencyMs,
      });
    }

    return result;
  });

  // Connect the upstream server to stdio (Claude Code talks to us via stdin/stdout)
  const upstreamTransport = new StdioServerTransport();
  await upstreamServer.connect(upstreamTransport);

  // Handle shutdown
  const shutdown = async () => {
    await downstreamClient.close();
    await upstreamServer.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function summarizeResult(result: any): string {
  if (!result?.content) return 'No content';
  const content = result.content;
  if (Array.isArray(content)) {
    const textParts = content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text);
    const summary = textParts.join(' ').slice(0, 200);
    return summary || `${content.length} content item(s)`;
  }
  return 'Unknown result format';
}
