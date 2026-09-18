/**
 * @file        ai.js
 * @description AI utilities
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.6-flash';

export function aiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function getModel() {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

export async function generateContent({ prompt, system, maxOutputTokens = 8192, temperature = 0.9 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = getModel();
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens,
      temperature,
      responseMimeType: 'application/json',
    },
  };
  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Gemini ${res.status}: ${err.slice(0, 300)}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) throw new Error('Empty Gemini response');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateJson({ prompt, system, maxOutputTokens = 8192, temperature = 0.9 }) {
  const raw = await generateContent({ prompt, system, maxOutputTokens, temperature });
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  return JSON.parse(cleaned);
}
