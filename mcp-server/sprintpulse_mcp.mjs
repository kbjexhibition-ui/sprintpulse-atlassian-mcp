// -*- coding: utf-8 -*-
/**
 * SprintPulse Standard MCP Server (JSON-RPC 2.0 over stdio)
 * - Claude Desktop / Cursor / IDE 에이전트가 Atlassian Jira 스프린트 블로커를 직접 조회·해결
 */
import readline from 'node:readline';
import { scanSprintBlockers, draftUnblockPlan } from '../src/index.js';

const TOOLS = [
  {
    name: 'atlassian_scan_sprint_blockers',
    description: 'Scan active Jira sprint issues and rank hidden blockers and stale handoffs.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Jira project key (e.g. ENG)' },
        staleHoursThreshold: { type: 'number', description: 'Stale threshold in hours (default 48)' },
      },
      required: ['projectKey'],
    },
  },
  {
    name: 'atlassian_draft_unblock_plan',
    description: 'Generate a Confluence-ready standup unblock plan and owner assignment brief.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Jira project key (e.g. ENG)' },
      },
      required: ['projectKey'],
    },
  },
];

export async function handleRpcRequest(req) {
  const { id, method, params } = req;
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'sprintpulse-atlassian-mcp', version: '1.0.0' },
      },
    };
  }
  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  }
  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};
    let out;
    if (toolName === 'atlassian_scan_sprint_blockers') {
      out = await scanSprintBlockers(args);
    } else if (toolName === 'atlassian_draft_unblock_plan') {
      out = await draftUnblockPlan(args);
    } else {
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${toolName}` } };
    }
    return {
      jsonrpc: '2.0',
      id,
      result: { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] },
    };
  }
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unsupported method: ${method}` } };
}

if (process.argv[1] && process.argv[1].endsWith('sprintpulse_mcp.mjs')) {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    try {
      const req = JSON.parse(line);
      const res = await handleRpcRequest(req);
      process.stdout.write(JSON.stringify(res) + '\n');
    } catch (e) {
      process.stdout.write(
        JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: String(e) } }) + '\n'
      );
    }
  });
}
