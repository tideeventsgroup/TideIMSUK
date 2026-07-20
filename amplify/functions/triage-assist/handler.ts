import type { Schema } from '../../data/resource';
import { CATEGORIES, RADIO_CHANNELS } from '../../../src/constants/taxonomy';
import { ZONES } from '../../../src/constants/zones';

/**
 * Triage-assist: suggests category/subcategory/zone/priority/radio channel/
 * assigned agency/linked risk refs and a cleaned-up narrative from free text.
 * Never auto-submits and never declares a level — the Loggist always
 * confirms or overrides every suggested field (Build Plan Section 11 firm
 * boundary), and the frontend never applies escalation level automatically.
 */

type Handler = Schema['triageAssist']['functionHandler'];

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const CATEGORY_LINES = CATEGORIES.map(
  (c) => `${c.key} (${c.label})${c.subcategories.length ? ' — subcategories: ' + c.subcategories.join(' | ') : ''}`,
).join('\n');

const buildSystemPrompt = (riskContext: string | null) => `You are a triage assistant for an event control room incident log.
Given a free-text incident narrative (which may be rough, spoken-style, or shorthand from a radio call),
extract and suggest structured fields — do not invent values outside the fixed lists below.

Categories and their fixed subcategories:
${CATEGORY_LINES}

Zones: ${ZONES.map((z) => z.key).join(', ')}
Priority: Standard, Major
Radio channels: ${Object.entries(RADIO_CHANNELS).map(([n, label]) => `${n}=${label}`).join('; ')}
Escalation levels: Level1 (Minor), Level2 (Significant), Level3 (Major, Controller/Admin only), Level4 (Critical, Controller/Admin only)
${riskContext ? `\nActive event's risk register (ref: hazard) — suggest refs only when the narrative clearly matches a listed hazard:\n${riskContext}` : ''}

You are a suggestion tool only. You never declare an incident level and never
trigger evacuation/lockdown/emergency-service contact — a human decides that.
"narrativeSummary" should rewrite the narrative into one clear, factual, third-person
incident-log sentence or two (who/what/where/action-so-far) — never add facts not present
or implied in the source text, and never remove safety-critical detail.
Respond with strict JSON only, using null for any field you cannot confidently infer:
{"suggestedCategory": "...", "suggestedSubcategory": "...", "suggestedZone": "...",
"suggestedLevel": "...", "suggestedPriority": "Standard|Major", "suggestedRadioChannel": 1-5 or null,
"suggestedAssignedAgency": "..." or null, "suggestedRiskRefs": ["R01", ...],
"narrativeSummary": "...", "rationale": "one short sentence"}`;

export const handler: Handler = async (event) => {
  const { narrative, riskContext } = event.arguments;
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
        { role: 'system', content: buildSystemPrompt(riskContext ?? null) },
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
    suggestedCategory?: string | null;
    suggestedSubcategory?: string | null;
    suggestedZone?: string | null;
    suggestedLevel?: string | null;
    suggestedPriority?: string | null;
    suggestedRadioChannel?: number | null;
    suggestedAssignedAgency?: string | null;
    suggestedRiskRefs?: string[] | null;
    narrativeSummary?: string | null;
    rationale?: string | null;
  };

  return {
    suggestedCategory: parsed.suggestedCategory ?? null,
    suggestedSubcategory: parsed.suggestedSubcategory ?? null,
    suggestedZone: parsed.suggestedZone ?? null,
    suggestedLevel: parsed.suggestedLevel ?? null,
    suggestedPriority: parsed.suggestedPriority ?? null,
    suggestedRadioChannel: parsed.suggestedRadioChannel ?? null,
    suggestedAssignedAgency: parsed.suggestedAssignedAgency ?? null,
    suggestedRiskRefs: parsed.suggestedRiskRefs ?? null,
    narrativeSummary: parsed.narrativeSummary ?? null,
    rationale: parsed.rationale ?? null,
  };
};
