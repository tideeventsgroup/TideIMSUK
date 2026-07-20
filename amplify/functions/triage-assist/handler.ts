import type { Schema } from '../../data/resource';
import { CATEGORIES } from '../../../src/constants/taxonomy';
import { ZONES } from '../../../src/constants/zones';

/**
 * Triage-assist: suggests category/zone/level from free-text narrative.
 * Never auto-submits and never declares a level — the Loggist always
 * confirms or overrides (Build Plan Section 11 firm boundary).
 */

type Handler = Schema['triageAssist']['functionHandler'];

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are a triage assistant for an event control room incident log.
Given a free-text incident narrative, suggest the most likely category, zone, and
escalation level (Level1-4) from these fixed lists — do not invent new values:

Categories: ${CATEGORIES.map((c) => c.key).join(', ')}
Zones: ${ZONES.map((z) => z.key).join(', ')}
Escalation levels: Level1 (Minor), Level2 (Significant), Level3 (Major, Controller/Admin only), Level4 (Critical, Controller/Admin only)

You are a suggestion tool only. You never declare an incident level and never
trigger evacuation/lockdown/emergency-service contact — a human decides that.
Respond with strict JSON only: {"suggestedCategory": "...", "suggestedZone": "...", "suggestedLevel": "...", "rationale": "one short sentence"}`;

export const handler: Handler = async (event) => {
  const narrative = event.arguments.narrative;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: narrative },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq request failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const content = body.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content) as {
    suggestedCategory?: string;
    suggestedZone?: string;
    suggestedLevel?: string;
    rationale?: string;
  };

  return {
    suggestedCategory: parsed.suggestedCategory ?? null,
    suggestedZone: parsed.suggestedZone ?? null,
    suggestedLevel: parsed.suggestedLevel ?? null,
    rationale: parsed.rationale ?? null,
  };
};
