// -*- coding: utf-8 -*-
/**
 * SprintPulse MCP — Atlassian Forge Rovo Agent Action Handlers
 * - Jira 스프린트 블로커 자동 탐지, 장기 정체(Stale) 이슈 스코어링, 스탠드업 요약 마크다운 생성
 */

export const SAMPLE_SPRINT_ISSUES = [
  {
    key: 'ENG-412',
    summary: 'Migrate OAuth token refresh to Forge Remote endpoint',
    status: 'In Progress',
    priority: 'Highest',
    assignee: 'Mina Kim',
    hoursSinceUpdate: 74,
    blockedBy: ['ENG-399'],
    storyPoints: 8,
  },
  {
    key: 'ENG-399',
    summary: 'Provision staging API gateway TLS certificate',
    status: 'Blocked',
    priority: 'High',
    assignee: 'Unassigned',
    hoursSinceUpdate: 96,
    blockedBy: [],
    storyPoints: 3,
  },
  {
    key: 'ENG-425',
    summary: 'Add Confluence sprint digest export button',
    status: 'In Review',
    priority: 'Medium',
    assignee: 'Devon Park',
    hoursSinceUpdate: 18,
    blockedBy: [],
    storyPoints: 2,
  },
];

export function scoreIssueRisk(issue, staleHoursThreshold = 48) {
  let risk = 0;
  const reasons = [];

  if (issue.status === 'Blocked') {
    risk += 45;
    reasons.push('Explicitly marked Blocked');
  }
  if (issue.assignee === 'Unassigned') {
    risk += 30;
    reasons.push('No owner assigned');
  }
  if (issue.hoursSinceUpdate >= staleHoursThreshold) {
    risk += Math.min(35, Math.round((issue.hoursSinceUpdate - staleHoursThreshold) * 0.7) + 15);
    reasons.push(`Stale for ${issue.hoursSinceUpdate}h (threshold ${staleHoursThreshold}h)`);
  }
  if (issue.blockedBy && issue.blockedBy.length > 0) {
    risk += 20;
    reasons.push(`Waiting on ${issue.blockedBy.join(', ')}`);
  }
  if (issue.priority === 'Highest') {
    risk += 10;
  }

  return {
    key: issue.key,
    summary: issue.summary,
    status: issue.status,
    assignee: issue.assignee,
    riskScore: Math.min(100, risk),
    reasons,
  };
}

export async function scanSprintBlockers(payload = {}) {
  const projectKey = payload.projectKey || 'ENG';
  const threshold = Number(payload.staleHoursThreshold || 48);
  const issues = payload.issues || SAMPLE_SPRINT_ISSUES;

  const ranked = issues
    .map((iss) => scoreIssueRisk(iss, threshold))
    .sort((a, b) => b.riskScore - a.riskScore);

  const highRiskCount = ranked.filter((r) => r.riskScore >= 50).length;
  return {
    projectKey,
    staleHoursThreshold: threshold,
    totalScanned: ranked.length,
    highRiskCount,
    sprintHealth: highRiskCount === 0 ? 'GREEN' : highRiskCount === 1 ? 'AMBER' : 'RED',
    rankedIssues: ranked,
  };
}

export async function draftUnblockPlan(payload = {}) {
  const scan = await scanSprintBlockers(payload);
  const topRisks = scan.rankedIssues.filter((i) => i.riskScore >= 40);

  const actions = topRisks.map((item, idx) => {
    const step =
      item.assignee === 'Unassigned'
        ? `Assign an on-call owner immediately to unblock downstream dependencies.`
        : `Pair ${item.assignee} with dependency owner for a 15-min triage today.`;
    return `${idx + 1}. **${item.key}** (Risk ${item.riskScore}/100 — ${item.reasons.join('; ')}) -> ${step}`;
  });

  const digestMarkdown = [
    `## SprintPulse Daily Risk Brief (${scan.projectKey})`,
    `- **Sprint Health**: ${scan.sprintHealth} (${scan.highRiskCount} high-risk blockers / ${scan.totalScanned} scanned)`,
    ``,
    `### Recommended Unblock Actions`,
    ...(actions.length ? actions : ['- All active sprint items are flowing normally.']),
  ].join('\n');

  return {
    projectKey: scan.projectKey,
    sprintHealth: scan.sprintHealth,
    digestMarkdown,
  };
}
