interface DraftRequest {
  description: string;
  category: string;
  address?: string | null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CATEGORY_CONTEXT: Record<string, string> = {
  pothole: "a pothole on a road",
  broken_road: "a broken or damaged road surface",
  waterlogging: "waterlogging/flooding on a road",
  signage: "missing or damaged road signage",
  streetlight: "a broken or non-functional streetlight",
  other: "a road infrastructure issue",
};

const GROQ_MODEL = "llama-3.3-70b-versatile";

function buildFallbackDraft(req: DraftRequest): {
  draft: string;
  severity: string;
  department: string;
} {
  const issue = CATEGORY_CONTEXT[req.category] || "a road infrastructure issue";
  const location = req.address || "the location specified above";

  const draft = `Subject: Formal Grievance Regarding ${issue}

To,
The Concerned Authority,

I am writing to bring to your attention ${issue} at ${location}.

Details of the issue:
${req.description}

This matter requires urgent attention as it poses inconvenience and potential safety risks to commuters and residents in the area. I request you to kindly inspect the site and take necessary corrective action at the earliest.

Thank you for your attention to this matter.

Sincerely,
A Concerned Citizen`;

  const severityByCategory: Record<string, string> = {
    pothole: "high",
    broken_road: "high",
    waterlogging: "high",
    signage: "medium",
    streetlight: "medium",
    other: "medium",
  };

  const deptByCategory: Record<string, string> = {
    pothole: "State PWD / Municipal Corporation",
    broken_road: "State PWD",
    waterlogging: "Municipal Corporation / Urban Development",
    signage: "Traffic & Transport Authority",
    streetlight: "Municipal Corporation / Electricity Board",
    other: "State PWD",
  };

  return {
    draft,
    severity: severityByCategory[req.category] || "medium",
    department: deptByCategory[req.category] || "State PWD",
  };
}

async function callGroq(messages: Array<{ role: string; content: string }>): Promise<string> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Groq API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Groq returned empty response");
  }
  return content;
}

async function extractJSON(content: string): Promise<Record<string, string>> {
  // Try to find JSON in the response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // fall through
    }
  }
  throw new Error("Could not parse JSON from LLM response");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { description, category, address } = (await req.json()) as DraftRequest;

    if (!description || !category) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: description, category" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GROQ_API_KEY");

    // If no Groq key, return fallback draft
    if (!apiKey) {
      const fallback = buildFallbackDraft({ description, category, address });
      return new Response(
        JSON.stringify({
          draft: fallback.draft,
          severity: fallback.severity,
          department: fallback.department,
          source: "fallback",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const issueType = CATEGORY_CONTEXT[category] || "a road infrastructure issue";
    const locationStr = address || "the location pin on the map";

    // Step 1: Classification (severity + department)
    const classificationMessages = [
      {
        role: "system",
        content:
          "You are a civic infrastructure analyst. Classify road complaints for Indian government grievance systems. Respond ONLY with valid JSON.",
      },
      {
        role: "user",
        content: `Classify this road complaint:
Category: ${category}
Description: "${description}"
Location: ${locationStr}

Return JSON with exactly these fields:
{"severity": "low"|"medium"|"high", "department": "name of the appropriate Indian government department"}

Guidelines:
- severity "high": immediate safety risk (large potholes, severe waterlogging, road collapse)
- severity "medium": significant inconvenience (damaged surface, broken streetlight)
- severity "low": minor issue (faded signage, small crack)
- department: the most appropriate Indian authority (e.g. "State PWD", "Municipal Corporation", "MoRTH", "Traffic & Transport Authority", "Electricity Board")`,
      },
    ];

    let classification: { severity: string; department: string } = {
      severity: "medium",
      department: "State PWD",
    };

    try {
      const classResult = await callGroq(classificationMessages);
      const parsed = await extractJSON(classResult);
      classification = {
        severity: parsed.severity || "medium",
        department: parsed.department || "State PWD",
      };
    } catch (err) {
      console.error("Classification step failed:", err.message);
      // Continue with defaults
    }

    // Step 2: Draft generation (uses classification context)
    const draftMessages = [
      {
        role: "system",
        content:
          "You are an expert at writing formal grievance letters for Indian government portals (CPGRAMS, state PWD, municipal corporations). Write in formal, respectful English. Keep it concise (150-250 words). Structure: Subject, salutation, body paragraphs, closing.",
      },
      {
        role: "user",
        content: `Write a formal grievance letter for submission to ${classification.department}.

Issue type: ${issueType}
Location: ${locationStr}
Severity: ${classification.severity}
Citizen's description: "${description}"

The letter should:
1. Have a clear subject line
2. Be addressed to "The Concerned Authority"
3. Describe the issue clearly and formally
4. Mention the location
5. Explain the impact on commuters/residents
6. Request inspection and corrective action
7. Be signed "A Concerned Citizen"

Output ONLY the letter text, no preamble or explanation.`,
      },
    ];

    let draftText: string;
    try {
      draftText = await callGroq(draftMessages);
    } catch (err) {
      console.error("Draft generation failed, using fallback:", err.message);
      const fallback = buildFallbackDraft({ description, category, address });
      return new Response(
        JSON.stringify({
          draft: fallback.draft,
          severity: classification.severity,
          department: classification.department,
          source: "fallback",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        draft: draftText.trim(),
        severity: classification.severity,
        department: classification.department,
        source: "ai",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
