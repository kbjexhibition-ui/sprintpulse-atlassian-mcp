import assert from 'node:assert/strict';
import { scanSprintBlockers, draftUnblockPlan } from '../src/index.js';
import { handleRpcRequest } from '../mcp-server/sprintpulse_mcp.mjs';

const scan = await scanSprintBlockers({ projectKey: 'ENG', staleHoursThreshold: 48 });
assert.equal(scan.sprintHealth, 'RED');
assert.equal(scan.rankedIssues[0].key, 'ENG-399');

const plan = await draftUnblockPlan({ projectKey: 'ENG' });
assert.ok(plan.digestMarkdown.includes('ENG-399'));
assert.ok(plan.digestMarkdown.includes('ENG-412'));

const listRes = await handleRpcRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
assert.equal(listRes.result.tools.length, 2);

const callRes = await handleRpcRequest({
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: { name: 'atlassian_scan_sprint_blockers', arguments: { projectKey: 'ENG' } },
});
const parsed = JSON.parse(callRes.result.content[0].text);
assert.equal(parsed.highRiskCount, 2);

console.log('[CODEGEIST SMOKE TEST PASS] Forge Rovo Actions + MCP Server verified:', {
  sprintHealth: parsed.sprintHealth,
  topBlocker: parsed.rankedIssues[0].key,
  mcpTools: listRes.result.tools.map((t) => t.name),
});
