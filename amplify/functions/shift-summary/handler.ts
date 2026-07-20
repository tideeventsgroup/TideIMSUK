import type { Schema } from '../../data/resource';

type Handler = Schema['shiftSummary']['functionHandler'];

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are drafting a shift handover summary for an event control room, from
structured incident-log data (counts by category/zone, open Level 3/4 incidents).
Write 3-5 short sentences in plain English: overall picture, any notable
concentration of incidents in one zone/category, and outstanding Level 3/4
incidents that need handing over. Do not invent incidents not present in the
data. Do not recommend declaring, escalating, or resolving anything — you are
drafting a summary for a human to review, not making a decision.`;

export const handler: Handler = async (event) => {
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
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: event.arguments.summaryJson },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq request failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as { choices: { message: { content: string } }[] };
  return body.choices[0]?.message?.content ?? '';
};
