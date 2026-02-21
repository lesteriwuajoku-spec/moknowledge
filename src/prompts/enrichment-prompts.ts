/**
 * Example prompts for LLM-based enrichment of scraped knowledge base data.
 * These would be used to transform raw scraped content into structured,
 * high-quality fields for MoSocial, MoMail, and MoBlogs.
 */

export const PROMPT_COMPANY_PITCH = `You are a brand strategist. Given the following raw text extracted from a company website, write a compelling 2-3 sentence company pitch that clearly states why a customer should choose this business. Use their tone and key differentiators. Do not invent facts; only synthesize what is provided.

Raw content:
{{SCRAPED_OVERVIEW}}

Metadata: {{META_DESCRIPTION}}

Output only the pitch text, no preamble.`;

export const PROMPT_WRITING_STYLE = `You are analyzing a company's voice for content generation. From the provided website excerpts, extract and describe their writing style in 3-5 bullet points. Include: tone (e.g. professional, casual, authoritative), sentence structure, vocabulary level, use of humor or formality, and any recurring phrases or patterns. This will guide AI-generated social posts, emails, and blog content to match their brand.

Website excerpts:
{{PARAGRAPH_SAMPLES}}

Headings and CTAs: {{HEADINGS_AND_CTAS}}

Output a concise writing-style description (bullet list).`;

export const PROMPT_IDEAL_CUSTOMER = `Using only the following information from a company website, infer and describe their ideal customer persona in 2-4 sentences. Include: who they are (role/industry), what they need, and what problems the company solves for them. If the site does not clearly indicate this, say "Insufficient data" and list what signals were considered.

Content:
{{SCRAPED_CONTENT}}

Target/audience mentions: {{TARGET_MENTIONS}}

Output the persona description or "Insufficient data" with brief reasoning.`;

export const PROMPT_FILL_GAPS = `You are enriching a knowledge base record. The following JSON has missing or empty fields. For each field that is empty, suggest a single plausible value based only on the non-empty fields and the "rawText" excerpt. If you cannot infer a value, leave the field as null. Output valid JSON only.

Current record:
{{KNOWLEDGE_JSON}}

Raw text excerpt:
{{RAW_TEXT}}

Output the same JSON structure with filled-in suggestions where possible.`;
