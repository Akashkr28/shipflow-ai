import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, streamText } from "ai";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const model = anthropic("claude-sonnet-4-6");

export { generateText, streamText };

function parseJSON(text: string) {
  const stripped = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(stripped);
}

export async function generatePRD(featureTitle: string, featureDescription: string, clarifications: string) {
  const { text } = await generateText({
    model,
    system: `You are a senior product manager at a top tech company. Generate comprehensive, structured PRDs that engineering teams can act on immediately. Always respond with valid JSON only.`,
    prompt: `Generate a complete PRD for this feature request.

Feature Title: ${featureTitle}
Description: ${featureDescription}
Additional Context from Clarification: ${clarifications}

Respond with a JSON object with these exact keys:
{
  "problemStatement": "string - clear problem being solved",
  "goals": ["array of specific, measurable goals"],
  "nonGoals": ["array of explicit out-of-scope items"],
  "userStories": [{"as": "role", "iWant": "action", "soThat": "benefit"}],
  "acceptanceCriteria": ["array of testable criteria"],
  "edgeCases": ["array of edge cases to handle"],
  "successMetrics": [{"metric": "name", "target": "value", "measurement": "how"}]
}`,
  });

  return parseJSON(text);
}

export async function generateTasks(prd: Record<string, unknown>, featureTitle: string) {
  const { text } = await generateText({
    model,
    system: `You are a senior engineering lead. Break down PRDs into concrete, actionable engineering tasks. Always respond with valid JSON only.`,
    prompt: `Break down this PRD into engineering tasks.

Feature: ${featureTitle}
PRD: ${JSON.stringify(prd, null, 2)}

Respond with a JSON array of tasks:
[{
  "title": "string - concise task title",
  "description": "string - detailed description of what needs to be done",
  "priority": "LOW|MEDIUM|HIGH|CRITICAL",
  "order": number
}]

Create 5-12 specific, implementable tasks covering: data models, API endpoints, UI components, business logic, tests, and deployment concerns.`,
  });

  return parseJSON(text);
}

export async function clarifyRequirements(
  featureTitle: string,
  featureDescription: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
) {
  const { text } = await generateText({
    model,
    system: `You are a senior product manager conducting a requirements discovery session. Your job is to:
1. First check if this feature already exists or is already addressed
2. Determine if this feature is truly needed
3. Gather missing context through targeted questions
4. Be concise - ask max 2-3 questions at a time
5. When you have enough info, respond with exactly: "READY_FOR_PRD" on its own line followed by a summary`,
    messages: [
      {
        role: "user",
        content: `Feature Request: ${featureTitle}\n\nDescription: ${featureDescription}`,
      },
      ...conversationHistory,
    ],
  });

  return text;
}

export async function reviewPullRequest(params: {
  prTitle: string;
  prBody: string;
  diff: string;
  prd: Record<string, unknown>;
  tasks: Array<{ title: string; description: string }>;
  acceptanceCriteria: string[];
}) {
  const { text } = await generateText({
    model,
    system: `You are a senior QA engineer and code reviewer. You evaluate pull requests against product requirements, not just syntax. You give actionable, specific feedback. Always respond with valid JSON only.`,
    prompt: `Review this pull request against the PRD requirements.

PR Title: ${params.prTitle}
PR Description: ${params.prBody || "No description provided"}

PRD:
${JSON.stringify(params.prd, null, 2)}

Engineering Tasks:
${params.tasks.map((t) => `- ${t.title}: ${t.description}`).join("\n")}

Acceptance Criteria:
${params.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Code Changes (diff):
\`\`\`diff
${params.diff.slice(0, 15000)}
\`\`\`

Respond with:
{
  "summary": "Overall assessment paragraph",
  "score": 0-100,
  "approved": boolean,
  "issues": [
    {
      "file": "filename or null",
      "line": number or null,
      "severity": "BLOCKING|NON_BLOCKING|SUGGESTION",
      "category": "requirements|security|performance|edge_case|code_quality|tests",
      "body": "Specific issue description with recommendation"
    }
  ]
}`,
  });

  return parseJSON(text);
}

export async function checkReleaseReadiness(params: {
  feature: Record<string, unknown>;
  prd: Record<string, unknown>;
  tasks: Array<{ title: string; status: string }>;
  reviews: Array<{ score: number; approved: boolean; issues: unknown[] }>;
}) {
  const { text } = await generateText({
    model,
    system: `You are a release manager. Evaluate if a feature is ready for production release. Always respond with valid JSON only.`,
    prompt: `Evaluate release readiness for this feature.

Feature: ${JSON.stringify(params.feature, null, 2)}
PRD Goals: ${JSON.stringify((params.prd as Record<string, unknown>).goals)}
Tasks Completion: ${params.tasks.map((t) => `${t.title}: ${t.status}`).join(", ")}
Latest Review Score: ${params.reviews[0]?.score ?? "No reviews"}
Review Approved: ${params.reviews[0]?.approved ?? false}
Outstanding Issues: ${JSON.stringify(params.reviews[0]?.issues ?? [])}

Respond with:
{
  "ready": boolean,
  "confidence": 0-100,
  "summary": "Release readiness summary",
  "blockers": ["list of blocking issues"],
  "recommendations": ["list of recommendations"]
}`,
  });

  return parseJSON(text);
}
