import type { AIDraftRequest, AIDraftResponse } from './types';

export async function generateAIDraft(
  req: AIDraftRequest
): Promise<AIDraftResponse> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-draft`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `AI draft failed (${response.status}). ${text.slice(0, 200)}`
    );
  }

  const data = await response.json();

  if (!data.draft || typeof data.draft !== 'string') {
    throw new Error('AI returned an invalid response — missing draft field.');
  }

  return {
    draft: data.draft,
    severity: data.severity || 'medium',
    department: data.department || 'State PWD',
  };
}
