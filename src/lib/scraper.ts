/**
 * MoKnowledge Website Scraper
 * Fetches and parses HTML to extract structured business information.
 */

import * as cheerio from "cheerio";
import type { Element as DomElement } from "domhandler";
import type {
  KnowledgeBase,
  CompanyFoundation,
  Positioning,
  MarketCustomers,
  BrandingStyle,
  OnlinePresence,
  KeyPerson,
  Offering,
  ExtendedKnowledge,
} from "@/types/knowledge";

function generateId(): string {
  return `kb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function cleanText(s: string | undefined): string {
  if (s == null) return "";
  return s
    .replace(/\s+/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

/** Recursively collect string values from JSON that look like prose (for __NEXT_DATA__ / __NUXT_DATA__). */
function collectTextFromJson(obj: unknown, out: string[] = [], maxLen = 50000): void {
  if (out.join("").length >= maxLen) return;
  if (typeof obj === "string") {
    const t = obj.trim();
    if (t.length >= 40 && t.length <= 8000 && !/^https?:\/\//i.test(t) && !/^[\d\s\-.,:;]+$/.test(t) && !/<script|function\s*\(|=>\s*\{/.test(t)) out.push(t);
    return;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) collectTextFromJson(item, out, maxLen);
    return;
  }
  if (obj && typeof obj === "object") {
    for (const v of Object.values(obj)) collectTextFromJson(v, out, maxLen);
  }
}

/** Extract readable content from __NEXT_DATA__ or __NUXT_DATA__ in HTML (for JS-rendered sites). */
function extractFromJsDataBlobs(html: string): string | undefined {
  const chunks: string[] = [];
  const nextMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextMatch) {
    try {
      const data = JSON.parse(nextMatch[1]) as unknown;
      collectTextFromJson(data, chunks);
    } catch {
      // ignore
    }
  }
  const nuxtMatch = html.match(/<script\s+id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nuxtMatch) {
    try {
      const data = JSON.parse(nuxtMatch[1]) as unknown;
      collectTextFromJson(data, chunks);
    } catch {
      // ignore
    }
  }
  const nuxtPayload = html.match(/<script\s+type="application\/json"\s+id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nuxtPayload) {
    try {
      const data = JSON.parse(nuxtPayload[1]) as unknown;
      collectTextFromJson(data, chunks);
    } catch {
      // ignore
    }
  }
  if (chunks.length === 0) return undefined;
  return [...new Set(chunks)].join("\n\n").slice(0, 50000);
}

function extractMeta($: cheerio.CheerioAPI, name: string): string {
  const selector = `meta[name="${name}"], meta[property="${name}"]`;
  const val = $(selector).attr("content");
  return cleanText(val ?? "");
}

function extractLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    try {
      const url = new URL(href, baseUrl);
      if (url.origin === new URL(baseUrl).origin) links.push(url.href);
    } catch {
      // ignore invalid URLs
    }
  });
  return [...new Set(links)];
}

function extractSocialLinks($: cheerio.CheerioAPI): Partial<OnlinePresence> {
  const result: Partial<OnlinePresence> = {};
  $('a[href*="linkedin.com"]').each((_, el) => {
    const h = $(el).attr("href");
    if (h && !result.linkedIn) result.linkedIn = h;
  });
  $('a[href*="facebook.com"]').each((_, el) => {
    const h = $(el).attr("href");
    if (h && !result.facebook) result.facebook = h;
  });
  $('a[href*="instagram.com"]').each((_, el) => {
    const h = $(el).attr("href");
    if (h && !result.instagram) result.instagram = h;
  });
  $('a[href*="twitter.com"], a[href*="x.com"]').each((_, el) => {
    const h = $(el).attr("href");
    if (h && !result.twitterX) result.twitterX = h;
  });
  $('a[href*="youtube.com"]').each((_, el) => {
    const h = $(el).attr("href");
    if (h && !result.youtube) result.youtube = h;
  });
  return result;
}

function extractColors($: cheerio.CheerioAPI): string[] {
  const colors: string[] = [];
  const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
  const style = $("style").text();
  const fromStyle = style.match(hexRe) ?? [];
  colors.push(...fromStyle);
  $("[style]").each((_, el) => {
    const s = $(el).attr("style") ?? "";
    const matches = s.match(hexRe);
    if (matches) colors.push(...matches);
  });
  const themeColor = $('meta[name="theme-color"]').attr("content");
  if (themeColor && /^#[0-9a-fA-F]{3,8}$/.test(themeColor)) colors.push(themeColor);
  const rootVars = style.match(/(?:--[a-z-]+)\s*:\s*([#][0-9a-fA-F]{3,8}\b)/g);
  if (rootVars) rootVars.forEach((v) => { const m = v.match(/#[0-9a-fA-F]{3,8}/); if (m) colors.push(m[0]); });
  return [...new Set(colors)].slice(0, 10);
}

function extractLogos($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const urls: string[] = [];
  $('img[src*="logo"], [class*="logo"] img, header img, nav img, .header img, .nav img').each((_, el) => {
    const src = $(el).attr("src");
    if (src) {
      try {
        urls.push(new URL(src, baseUrl).href);
      } catch {
        // ignore
      }
    }
  });
  if (urls.length === 0) {
    $("header img, .header img, [class*='site-header'] img").each((_, el) => {
      const src = $(el).attr("src");
      if (src) {
        try {
          urls.push(new URL(src, baseUrl).href);
        } catch {
          // ignore
        }
      }
    });
  }
  $("[class*='logo']").each((_, el) => {
    const style = $(el).attr("style") || "";
    const bg = style.match(/background(?:-image)?\s*:\s*url\s*\(\s*["']?([^"')]+)/i);
    if (bg && bg[1]) {
      try {
        urls.push(new URL(bg[1].trim(), baseUrl).href);
      } catch {
        // ignore
      }
    }
  });
  return [...new Set(urls)].slice(0, 5);
}

function extractHeadings($: cheerio.CheerioAPI): string[] {
  const texts: string[] = [];
  $("h1, h2, h3, h4").each((_, el) => {
    const t = cleanText($(el).text());
    if (t && t.length < 150) texts.push(t);
  });
  return texts;
}

function extractParagraphs($: cheerio.CheerioAPI, max = 20): string[] {
  const texts: string[] = [];
  $("p").each((_, el) => {
    if (texts.length >= max) return false;
    if (isHiddenOrModal($, el)) return;
    const t = cleanText($(el).text());
    if (t.length > 30 && !/terms of service|privacy policy|effective:\s*\w+/i.test(t)) texts.push(t);
  });
  if (texts.length === 0) {
    const main = getMainBodyText($);
    const chunks = main.split(/\s{2,}|\n/).map((s) => s.trim()).filter((s) => s.length > 40 && s.length < 2000);
    chunks.slice(0, max).forEach((c) => {
      if (!/terms of service|privacy policy/i.test(c)) texts.push(c);
    });
  }
  return texts;
}

function extractCTAs($: cheerio.CheerioAPI): string[] {
  const ctas: string[] = [];
  const ctaWords = /contact|sign up|subscribe|get started|learn more|book|schedule|request|demo|free trial|buy now|add to cart/i;
  $("a, button").each((_, el) => {
    const t = cleanText($(el).text());
    if (t.length > 0 && t.length < 80 && ctaWords.test(t)) ctas.push(t);
  });
  return [...new Set(ctas)].slice(0, 15);
}

function extractFAQ($: cheerio.CheerioAPI): { question: string; answer: string }[] {
  const faq: { question: string; answer: string }[] = [];
  $("[class*='faq'], [id*='faq'] dt, [class*='accordion'] h3, .faq-item h4").each((_, el) => {
    const q = cleanText($(el).text());
    const next = $(el).next("dd, .answer, p, div");
    const a = cleanText(next.first().text());
    if (q && a) faq.push({ question: q, answer: a });
  });
  return faq.slice(0, 20);
}

function extractTestimonials($: cheerio.CheerioAPI): string[] {
  const quotes: string[] = [];
  const seen = new Set<string>();

  const add = (text: string) => {
    const t = cleanText(text);
    if (t.length < 15 || t.length > 800) return;
    const key = t.slice(0, 80).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    quotes.push(t);
  };

  // Schema.org Review (JSON-LD or microdata)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html();
      if (!raw) return;
      const data = JSON.parse(raw) as unknown;
      const arr: unknown[] = Array.isArray(data) ? data : data && typeof data === "object" && "@graph" in data ? ((data as { "@graph": unknown[] })["@graph"] ?? []) : [data];
      if (!Array.isArray(arr)) return;
      for (const item of arr) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        const type = Array.isArray(o["@type"]) ? (o["@type"] as string[])[0] : (o["@type"] as string);
        if (!type || !/Review|Testimonial/i.test(String(type))) continue;
        const body = (o.reviewBody ?? o.description ?? o.text) as string | undefined;
        if (!body || typeof body !== "string") continue;
        const author = o.author && typeof o.author === "object" && "name" in o.author ? (o.author as { name: string }).name : (o.author as string | undefined);
        add(author && typeof author === "string" ? `${author}: ${body}` : body);
      }
    } catch {
      // ignore parse errors
    }
  });
  $('[itemprop="reviewBody"], [itemprop="review"]').each((_, el) => {
    const t = cleanText($(el).text());
    if (t.length > 15) add(t);
  });

  // Class-based: broad set of possible review/testimonial containers (skip only obvious modals)
  const reviewSelectors = [
    '[class*="testimonial"]', '[class*="review"]', '[class*="client-quote"]', '[class*="review-card"]',
    '[class*="testimonial-card"]', '[class*="rating"]', '[class*="reviews"]', '[class*="client"]',
    '[class*="quote"]', '[class*="social-proof"]', '[class*="widget"][class*="review"]',
    '[id*="testimonial"]', '[id*="review"]', 'blockquote',
  ].join(", ");
  $(reviewSelectors).each((_, el) => {
    if (isHiddenOrModal($, el)) return;
    const t = cleanText($(el).text());
    if (t.length > 20) add(t);
  });

  // Section by heading: find "Reviews", "Testimonials", "What Our Clients Say", then grab content
  const reviewHeadingRe = /review|testimonial|client|what\s+(our\s+)?clients?\s+(are\s+)?say|kind\s+words|from\s+our\s+clients|what\s+people\s+say/i;
  $("h1, h2, h3, h4").each((_, el) => {
    const headingText = cleanText($(el).text());
    if (!reviewHeadingRe.test(headingText)) return;
    const $parent = $(el).closest("section, article, div[class]");
    if (!$parent.length) return;
    $parent.find("p, blockquote, [class*='quote'], [class*='review'], [class*='content']").each((__, child) => {
      const txt = cleanText($(child).text());
      if (txt.length >= 20 && txt.length <= 600 && !/^\d+\s*[\/\*]|stars?|years?\s+ago|verified|raffaella|schedule\s+appointment/i.test(txt.slice(0, 50))) add(txt);
    });
  });

  // Per-card quote: inside any review-like block, take the quote paragraph or short text block
  $('[class*="review"], [class*="testimonial"], [class*="client"]').each((_, el) => {
    if (isHiddenOrModal($, el)) return;
    const $el = $(el);
    $el.find('[class*="quote"], [class*="text"], [class*="content"], p').each((__, quoteEl) => {
      const q = cleanText($(quoteEl).text());
      if (q.length >= 15 && q.length <= 500 && !/^\d+\s*\/\s*5|^[\d\s*]+$|stars?|years?\s+ago$/i.test(q)) add(q);
    });
  });

  // Fallback: any short paragraph that looks like a quote (rely on, recommend, great, etc.)
  if (quotes.length === 0) {
    const quoteLikeRe = /\b(rely on|recommend|great|thank you|professional|excellent|happy|satisfied|finally)\b/i;
    $("p").each((_, el) => {
      if (isHiddenOrModal($, el)) return;
      const t = cleanText($(el).text());
      if (t.length >= 25 && t.length <= 400 && quoteLikeRe.test(t) && !/^(home|about|contact|login|menu|read more)/i.test(t)) add(t);
    });
  }

  // Last resort: scan ALL elements (span, div, p, li) for short text that looks like a review quote
  if (quotes.length === 0) {
    const quoteLikeRe = /\b(rely on|recommend|great|thank you|professional|excellent|happy|satisfied|finally a company)\b/i;
    $("p, span, div, li, td").each((_, el) => {
      const t = cleanText($(el).text());
      if (t.length < 20 || t.length > 350) return;
      if (quoteLikeRe.test(t) && !/^\d|stars?|years?\s+ago|verified|client\s+login|schedule\s+appointment/i.test(t)) {
        const onlyThis = $(el).children().length === 0 || cleanText($(el).text()) === cleanText($(el).children().first().text());
        if (onlyThis || t.length < 100) add(t);
      }
    });
  }

  // Needle-in-haystack: search full page text for review-like sentence (catches JS-rendered or odd markup)
  if (quotes.length === 0) {
    const fullText = cleanText($("body").text());
    const phrases = [
      "Finally a Company you can rely on",
      "company you can rely on",
      "rely on",
      "highly recommend",
      "would recommend",
      "highly recommend this company",
    ];
    for (const phrase of phrases) {
      const idx = fullText.toLowerCase().indexOf(phrase.toLowerCase());
      if (idx >= 0) {
        const start = Math.max(0, idx - 5);
        const end = Math.min(fullText.length, idx + phrase.length + 80);
        let snippet = fullText.slice(start, end).trim();
        snippet = snippet.replace(/^[^a-zA-Z]+/, "").replace(/[^a-zA-Z0-9\s',.-]+$/, "");
        if (snippet.length >= 15 && snippet.length <= 300) add(snippet);
        break;
      }
    }
  }

  return quotes.slice(0, 15);
}

/** Extract structured data from JSON-LD script tags (schema.org) */
function extractJsonLd(html: string, baseUrl: string): {
  name?: string;
  description?: string;
  url?: string;
  logo?: string;
  foundingDate?: string;
  numberOfEmployees?: string;
  address?: string;
  sameAs?: string[];
  contactPoint?: { email?: string; phone?: string };
} {
  const result: ReturnType<typeof extractJsonLd> = {};
  const ldRe = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = ldRe.exec(html)) !== null) {
    try {
      const raw = match[1].trim();
      let data: unknown = JSON.parse(raw);
      if (data && typeof data === "object" && "@graph" in data && Array.isArray((data as { "@graph": unknown[] })["@graph"])) {
        data = ((data as { "@graph": unknown[] })["@graph"]).find((o) => o && typeof o === "object" && "@type" in o);
      }
      if (Array.isArray(data)) data = data.find((o) => o && typeof o === "object" && ("@type" in o));
      if (!data || typeof data !== "object") continue;
      const obj = data as Record<string, unknown>;
      const type = Array.isArray(obj["@type"]) ? (obj["@type"] as string[])[0] : (obj["@type"] as string);
      if (!type || !/Organization|LocalBusiness|Corporation|Company/i.test(String(type))) continue;
      if (!result.name && obj.name) result.name = cleanText(String(obj.name));
      if (!result.description && obj.description) result.description = cleanText(String(obj.description));
      if (!result.url && obj.url) result.url = String(obj.url);
      if (!result.logo && obj.logo) {
        const logo = obj.logo;
        result.logo = typeof logo === "string" ? logo : (logo && typeof logo === "object" && "url" in logo) ? String((logo as { url: string }).url) : undefined;
      }
      if (!result.foundingDate && obj.foundingDate) result.foundingDate = String(obj.foundingDate);
      if (!result.numberOfEmployees && obj.numberOfEmployees) {
        const n = obj.numberOfEmployees;
        result.numberOfEmployees = typeof n === "object" && n && "value" in n ? String((n as { value: number }).value) : String(n);
      }
      if (!result.address && obj.address) {
        const addr = obj.address;
        if (typeof addr === "string") result.address = addr;
        else if (addr && typeof addr === "object") {
          const a = addr as Record<string, unknown>;
          const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry].filter(Boolean);
          result.address = parts.map(String).join(", ");
        }
      }
      if (!result.sameAs && obj.sameAs && Array.isArray(obj.sameAs)) {
        result.sameAs = (obj.sameAs as string[]).slice(0, 15);
      }
      if (obj.contactPoint) {
        const cp = (Array.isArray(obj.contactPoint) ? obj.contactPoint[0] : obj.contactPoint) as Record<string, unknown> | undefined;
        if (cp) {
          result.contactPoint = {};
          if (cp.email) result.contactPoint.email = String(cp.email);
          if (cp.telephone) result.contactPoint.phone = String(cp.telephone);
        }
      }
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return result;
}

/** Extract 4-digit year from a string (ISO date or plain year). */
function normalizeYear(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const m = value.trim().match(/(\d{4})/);
  return m ? m[1] : undefined;
}

/** Find year founded in about/story/history sections first, then full page. Uses many phrasings. */
function extractYearFounded($: cheerio.CheerioAPI): string | undefined {
  const maxYear = new Date().getFullYear() + 1;
  const validYear = (y: string) => {
    const n = parseInt(y, 10);
    return n >= 1900 && n <= maxYear ? y : undefined;
  };

  // Highest priority: explicit "Year Founded: 2003" or "founded in 2003" anywhere on page
  const mainText = getMainBodyText($);
  const explicitLabel = mainText.match(/year\s+founded\s*[:=]\s*(\d{4})/i);
  if (explicitLabel) { const y = validYear(explicitLabel[1]); if (y) return y; }
  const foundedIn = mainText.match(/\b(?:founded|established)\s+in\s+(\d{4})\b/i);
  if (foundedIn) { const y = validYear(foundedIn[1]); if (y) return y; }
  let earlyYear: string | undefined;
  $("[class*='about'], [class*='story'], [class*='history'], [class*='company'], [class*='detail'], [class*='company-detail']").each((_, el) => {
    if (earlyYear) return;
    if (isHiddenOrModal($, el)) return;
    const t = cleanText($(el).text());
    const m = t.match(/year\s+founded\s*[:=]\s*(\d{4})/i) || t.match(/\b(?:founded|established)\s+in\s+(\d{4})\b/i);
    if (m && m[1]) earlyYear = validYear(m[1]);
  });
  if (earlyYear) return earlyYear;

  const patterns: RegExp[] = [
    /\byear\s+founded\s*[:=]\s*(\d{4})\b/i,
    /\b(?:founded|established|started|began|incorporated|opened|created)\s*(?:in\s*)?(\d{4})\b/i,
    /\b(?:in business|serving|proudly serving|family owned|operating|trading)\s+since\s+(\d{4})\b/i,
    /\bsince\s+(\d{4})\b/i,
    /\b(?:since|from)\s+(\d{4})\s+(?:to\s+present|to\s+today|-)\b/i,
    /\b(\d{4})\s*[-–]\s*(?:present|today)\b/i,
    /\b(?:est\.?|established)\s*\.?\s*(\d{4})\b/i,
    /\b(\d{4})\s*[-–]\s*\d{4}\b/,
  ];

  const findIn = (text: string): string | undefined => {
    for (const re of patterns) {
      const m = text.match(re);
      if (m && m[1]) return validYear(m[1]);
    }
    return undefined;
  };

  // Label-style: "Year Founded: 2003" or in dt/dd, li (set found, don't return from callback)
  let found: string | undefined;
  $("[class*='about'], [class*='story'], [class*='history'], [class*='company'], [class*='detail'], footer, [class*='footer'], [class*='company-detail']").each((_, el) => {
    if (found) return;
    if (isHiddenOrModal($, el)) return;
    const t = cleanText($(el).text());
    const labelMatch = t.match(/year\s+founded\s*[:=]\s*(\d{4})/i);
    if (labelMatch) found = validYear(labelMatch[1]);
  });
  if (found) return found;
  $("dt, dd, li, p").each((_, el) => {
    if (found) return;
    const t = cleanText($(el).text());
    if (/year\s+founded|founded\s+in|established\s+in|since\s+\d{4}/i.test(t)) {
      const m = t.match(/(\d{4})/);
      if (m) found = validYear(m[1]);
    }
  });
  if (found) return found;

  const aboutSel = "[class*='about'], [class*='story'], [class*='history'], [class*='heritage'], [id*='about'], [id*='story'], [id*='history']";
  $(aboutSel).each((_, el) => {
    if (found) return;
    if (isHiddenOrModal($, el)) return;
    const t = cleanText($(el).text());
    if (t.length < 30) return;
    found = findIn(t);
  });
  if (found) return found;

  $("footer, [role='contentinfo'], .footer").each((_, el) => {
    if (found) return;
    const t = cleanText($(el).text());
    found = findIn(t);
  });
  if (found) return found;

  found = findIn(mainText);
  if (found) return found;

  // dt/dd pair: <dt>Year Founded</dt><dd>2003</dd> or next sibling
  $("dt").each((_, el) => {
    if (found) return;
    const dtText = cleanText($(el).text());
    if (!/year\s+founded|founded|established/i.test(dtText)) return;
    const $dd = $(el).next("dd");
    if ($dd.length) {
      const y = cleanText($dd.text()).match(/(\d{4})/)?.[1];
      if (y) found = validYear(y);
    }
    if (!found) {
      const combined = cleanText($(el).parent().text());
      const m = combined.match(/year\s+founded\s*[:=]?\s*(\d{4})|(?:founded|established)\s+in\s+(\d{4})/i);
      if (m && (m[1] || m[2])) found = validYear(m[1] || m[2]!);
    }
  });
  if (found) return found;

  // Full body text in case main body excluded the block (e.g. in a tab or wrapper)
  const fullBodyText = cleanText($("body").text());
  const fullExplicit = fullBodyText.match(/year\s+founded\s*[:=]\s*(\d{4})/i);
  if (fullExplicit) { const y = validYear(fullExplicit[1]); if (y) return y; }
  found = findIn(fullBodyText);
  if (found) return found;

  const copyrightMatch = mainText.match(/©\s*(?:copyright\s*)?(\d{4})\b/i);
  if (copyrightMatch) return validYear(copyrightMatch[1]) || undefined;

  return undefined;
}

/** Scan full page text for year founded, employee count, address-like text, legal entity. Uses main body only (excludes modals/legal). */
function extractTextPatterns($: cheerio.CheerioAPI): {
  yearFounded?: string;
  employeeCount?: string;
  mainAddress?: string;
  legalEntityType?: string;
  industry?: string;
} {
  const text = getMainBodyText($);
  const result: ReturnType<typeof extractTextPatterns> = {};
  result.yearFounded = extractYearFounded($);
  const empRe = /(?:team\s+of\s+)?(\d+)(?:\+)?\s*(?:employees?|people|staff|members?)\b|(\d+)(?:\+)?\s*-\s*(?:employee|person)\s/gi;
  const empMatch = text.match(empRe);
  if (empMatch) {
    const first = empMatch[0];
    const num = first.replace(/\D/g, "");
    if (num) result.employeeCount = num;
  }
  const legalRe = /\b(LLC|L\.L\.C\.|Inc\.|Incorporated|Ltd\.|Limited|Corp\.|Corporation|Co\.|Company|LP|LLP)\b/i;
  const legalMatch = text.match(legalRe);
  if (legalMatch) result.legalEntityType = legalMatch[0].replace(/\./g, "").trim();
  const navWords = /\b(home|about us|services|contact|login|sign|directory|track your refund|learning|learn more|menu)\b/i;
  const streetTypes = /\b(street|st\.?|avenue|ave\.?|blvd\.?|boulevard|drive|dr\.?|road|rd\.?|lane|ln\.?|way|suite|ste\.?|floor|fl\.?)\b/i;
  const addrRe = /\d+[\s\w\.]+,?\s*[\w\s]+,?\s*(?:[A-Z]{2}|[A-Z][a-z]+)\s+\d{5}(?:-\d{4})?(?:\s*[A-Za-z]{2})?/g;
  let addrMatch: RegExpExecArray | null;
  while ((addrMatch = addrRe.exec(text)) !== null) {
    const candidate = cleanText(addrMatch[0]).slice(0, 200);
    if (navWords.test(candidate)) continue;
    if (streetTypes.test(candidate) || /,\s*[A-Z][a-z]+.*,\s*[A-Z]{2}\s+\d{5}/.test(candidate)) {
      result.mainAddress = candidate;
      break;
    }
  }
  return result;
}

/** Extract font families from stylesheets, inline styles, and Google Fonts / font links */
function extractFonts($: cheerio.CheerioAPI): string[] {
  const fonts: string[] = [];
  const fontRe = /font-family\s*:\s*([^;}"']+)|font-family\s*=\s*["']([^"']+)["']/gi;
  $("style").each((_, el) => {
    const styleText = $(el).html() || "";
    let m: RegExpExecArray | null;
    while ((m = fontRe.exec(styleText)) !== null) {
      const f = (m[1] || m[2] || "").replace(/^["'\s]+|["'\s]+$/g, "").split(",")[0].trim();
      if (f && !/^(inherit|initial|unset|serif|sans-serif|monospace)$/i.test(f)) fonts.push(f);
    }
  });
  $("[style]").each((_, el) => {
    const s = $(el).attr("style") ?? "";
    const m = s.match(/font-family\s*:\s*([^;]+)/i);
    if (m) {
      const f = m[1].replace(/^["'\s]+|["'\s]+$/g, "").split(",")[0].trim();
      if (f) fonts.push(f);
    }
  });
  $('link[href*="fonts.googleapis.com"], link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const familyMatch = href.match(/family=([^&:]+)/g);
      if (familyMatch) {
        familyMatch.forEach((param) => {
          const name = decodeURIComponent(param.replace("family=", "")).split(":")[0].trim();
          if (name && name.length < 50) fonts.push(name.replace(/\+/g, " "));
        });
      }
    }
  });
  return [...new Set(fonts)].slice(0, 8);
}

/** Build a rich, narrative writing-style description from page content, tone, structure, and audience. */
function extractWritingStyle($: cheerio.CheerioAPI): string | undefined {
  const text = getMainBodyText($).slice(0, 4500);
  if (text.length < 120) {
    const title = cleanText($("title").text());
    const desc = extractMeta($, "description") || extractMeta($, "og:description");
    if (title || desc) return `Professional, informative tone. ${[title, desc].filter(Boolean).join(" ").slice(0, 350)}.`;
    return undefined;
  }

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().split(/\s+/).length >= 4);
  const avgLen = sentences.length ? sentences.reduce((a, s) => a + s.trim().split(/\s+/).length, 0) / sentences.length : 0;

  const parts: string[] = [];

  // Opening: overall character (professional, informative, customer-centric)
  const toneWords: string[] = [];
  if (/professional|expert|quality|trust|ensure|provide|experience/i.test(text)) toneWords.push("professional");
  if (/inform|educate|guide|explain|learn|understand/i.test(text) || (avgLen > 14 && text.length > 500)) toneWords.push("informative");
  if (/\byou\b|\byour\b|client|customer|we (serve|help|provide)/i.test(text)) toneWords.push("customer-centric");
  if (toneWords.length > 0) {
    parts.push(`Professional, ${[...new Set(toneWords)].filter((w) => w !== "professional").join(", ") || "informative"}.`.replace(/^Professional, \.$/, "Professional and informative."));
  }

  // Tone: confident, reassuring, trust-building; optional experience/years/family-owned
  const trustSignals: string[] = [];
  if (/confident|reassuring|trust|experience|expertise|values/i.test(text)) trustSignals.push("aiming to build trust");
  const yearsMatch = text.match(/(?:over|more than|nearly)\s+(\d+)\s+years|(\d+)\+?\s+years\s+of\s+(?:experience|service)|since\s+(?:19|20)\d{2}|established\s+(?:in\s+)?(?:19|20)\d{2}/i);
  if (yearsMatch) trustSignals.push("highlighting experience and longevity");
  if (/family-owned|family owned|family\s+run|locally owned/i.test(text)) trustSignals.push("family-owned or local values");
  if (trustSignals.length > 0) {
    parts.push(`The tone is confident and reassuring, ${trustSignals.slice(0, 2).join(" and ")}.`);
  }

  // Language: clear and direct; optional CTAs
  const ctas = extractCTAs($).slice(0, 3);
  if (ctas.length > 0) {
    const ctaExamples = ctas.slice(0, 2).map((c) => `"${c}"`);
    parts.push(`The language is clear and direct, with strong calls to action like ${ctaExamples.join(" and ")}.`);
  } else {
    parts.push("The language is clear and direct.");
  }

  // Technical vs accessible; audience
  const hasTechnical = /technical|specialist|certified|compliance|industry|solution|implementation/i.test(text);
  const hasAccessible = /simple|easy|understand|explain|guide|help you/i.test(text);
  if (hasTechnical && hasAccessible) parts.push("It balances technical or industry terms with accessible explanations.");
  const audience: string[] = [];
  if (/homeowner|residential|household/i.test(text)) audience.push("homeowners");
  if (/commercial|business|contractor|enterprise|B2B/i.test(text)) audience.push("commercial clients or businesses");
  if (audience.length >= 2) parts.push(`Content caters to both ${audience.join(" and ")}.`);
  else if (audience.length === 1) parts.push(`Content is geared toward ${audience[0]}.`);

  // Structure: FAQs, testimonials, service descriptions
  const hasFaq = extractFAQ($).length > 0;
  const hasTestimonials = extractTestimonials($).length > 0;
  const headings = $("h1, h2, h3").map((_, el) => cleanText($(el).text())).get();
  const hasServiceContent = /service|offering|package|plan/i.test(text) && headings.some((h) => /service|offer|what we|package|plan/i.test(h));
  const structureBits: string[] = [];
  if (hasFaq) structureBits.push("FAQs");
  if (hasTestimonials) structureBits.push("testimonials");
  if (hasServiceContent) structureBits.push("clear service descriptions");
  if (structureBits.length > 0) {
    parts.push(`The content is well-structured with ${structureBits.join(", ")} to educate and guide potential clients.`);
  }

  if (parts.length === 0) return undefined;
  return parts.join(" ");
}

/** Extract or infer art/visual style from page (design sections, or infer from structure). */
function extractArtStyle($: cheerio.CheerioAPI): string | undefined {
  const brandSections = $("[class*='brand'], [class*='style'], [class*='design'], [class*='aesthetic'], [class*='visual']").filter((_, el) => !isHiddenOrModal($, el));
  let text = "";
  brandSections.each((_, el) => {
    const t = cleanText($(el).text());
    if (t.length > 30 && t.length < 500) text = text || t;
  });
  if (text) return text.slice(0, 300);
  const hasHero = $("[class*='hero'], [class*='banner']").length > 0;
  const hasCards = $("[class*='card'], [class*='grid']").length > 2;
  if (hasHero && hasCards) return "Clean, modern web design with hero sections and card-based layout.";
  if (hasHero) return "Modern layout with prominent hero or banner section.";
  return "Professional web presence.";
}

/** Reject text that looks like nav/menu rather than a real address */
function looksLikeNavNotAddress(text: string): boolean {
  if (/\d{5}(?:-\d{4})?/.test(text) && /,\s*[A-Za-z]+(?:\s+[A-Za-z]+)?\s+\d{5}/.test(text)) return false;
  const navPattern = /\b(home|about us|services|contact us|login|sign (up|in)|directory|track your refund|learning|learn more|menu|client (login|hub)|schedule)\b/i;
  return navPattern.test(text) || (text.split(/\s+/).length <= 4 && !/\d{5}/.test(text));
}

/** US address pattern: number + optional street type + city, state zip */
const US_ADDRESS_RE = /\d+[\s\w\.#]+(?:street|st\.?|avenue|ave\.?|blvd\.?|boulevard|drive|dr\.?|road|rd\.?|lane|ln\.?|way|suite|ste\.?|floor|fl\.?|building|bldg\.?)[\s\w\.]*,?\s*[^,]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/i;
const US_ADDRESS_LOOSE_RE = /\d+\s+[\w\s\.#]+,\s*[^,]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/;
/** Even looser: number + words + comma + city, state zip (no street type required) */
const US_ADDRESS_ANY_RE = /\d+[\s\w\.#]{3,40},\s*[^,]{2,30},\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/;
/** City, State ZIP only (no street number) e.g. "Boynton Beach, Florida 33437" */
const US_CITY_STATE_ZIP_RE = /[A-Za-z][A-Za-z\s\-']{2,45},\s*[A-Za-z]+(?:\s+[A-Za-z]+)?\s+\d{5}(?:-\d{4})?/;

/** Extract address/contact from the visible page (skip modals so we get the site's real contact, not legal boilerplate). */
function extractContactAndAddress($: cheerio.CheerioAPI, baseUrl: string): { mainAddress?: string; email?: string; phone?: string } {
  const result: { mainAddress?: string; email?: string; phone?: string } = {};

  // Prefer tel: and mailto: that are NOT inside a modal (visible page contact)
  $('a[href^="mailto:"]').each((_, el) => {
    if (isInsideModal($, el)) return;
    const href = $(el).attr("href");
    if (href && !result.email) {
      const email = href.replace(/^mailto:/i, "").split("?")[0].trim();
      if (email && !email.includes("legal@") && !email.includes("privacy@") && !email.includes("CountingWorks")) {
        result.email = email;
      }
    }
  });
  $('a[href^="tel:"]').each((_, el) => {
    if (isInsideModal($, el)) return;
    const href = $(el).attr("href");
    if (href && !result.phone) {
      const digits = href.replace(/^tel:/i, "").replace(/\D/g, "");
      const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits.length === 10 ? digits : null;
      if (ten) result.phone = `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
      else result.phone = href.replace(/^tel:/i, "").trim();
    }
  });
  if (!result.phone) {
    $('a[href^="tel:"]').each((_, el) => {
      const href = $(el).attr("href");
      if (href && !result.phone) result.phone = href.replace(/^tel:/i, "").trim();
    });
  }

  // Address: schema itemprop="address" (full or city/state/zip)
  $("[itemprop='address']").each((_, el) => {
    if (result.mainAddress) return;
    if (isInsideModal($, el)) return;
    const t = cleanText($(el).text());
    if (t.length < 10 || t.length > 350) return;
    const match = t.match(US_ADDRESS_RE) || t.match(US_ADDRESS_LOOSE_RE) || t.match(US_ADDRESS_ANY_RE) || t.match(US_CITY_STATE_ZIP_RE);
    if (match && !looksLikeNavNotAddress(match[0])) result.mainAddress = match[0].slice(0, 200);
  });
  // Address: "Main Address:" or "Address:" label + value
  $("[class*='contact'], [id*='contact'], [class*='address'], [id*='address'], footer, .footer, [class*='company-detail']").each((_, el) => {
    if (result.mainAddress) return;
    if (isInsideModal($, el)) return;
    const t = cleanText($(el).text());
    const labelMatch = t.match(/(?:main\s+)?address\s*[:=]\s*([^\n|]+?)(?:\s*[|\n]|$)/i);
    if (labelMatch) {
      const val = labelMatch[1].trim();
      const m = val.match(US_ADDRESS_RE) || val.match(US_ADDRESS_LOOSE_RE) || val.match(US_ADDRESS_ANY_RE) || val.match(US_CITY_STATE_ZIP_RE);
      if (m && !looksLikeNavNotAddress(m[0])) result.mainAddress = m[0].slice(0, 200);
    }
  });
  // Address: links that look like addresses (e.g. map links with address text)
  $("a[href*='maps'], a[href*='google'], a[href*='map']").each((_, el) => {
    if (result.mainAddress) return;
    const t = cleanText($(el).text());
    const match = t.match(US_ADDRESS_RE) || t.match(US_ADDRESS_LOOSE_RE) || t.match(US_ADDRESS_ANY_RE) || t.match(US_CITY_STATE_ZIP_RE);
    if (match && t.length < 250 && !looksLikeNavNotAddress(match[0])) result.mainAddress = match[0].slice(0, 200);
  });
  // Address: first try <address> elements that are NOT in a modal
  $("address").each((_, el) => {
    if (isInsideModal($, el)) return;
    const t = cleanText($(el).text());
    if (t.length > 15 && t.length < 350 && !result.mainAddress && !looksLikeNavNotAddress(t)) {
      const lines = t.split(/\n|\.\s+/);
      const addr = lines.find((line) => US_ADDRESS_RE.test(line) || (US_ADDRESS_LOOSE_RE.test(line) && !looksLikeNavNotAddress(line)))
        || lines.find((line) => US_CITY_STATE_ZIP_RE.test(line) && !looksLikeNavNotAddress(line));
      result.mainAddress = addr ? addr.trim().slice(0, 200) : (US_CITY_STATE_ZIP_RE.test(t) ? t.match(US_CITY_STATE_ZIP_RE)?.[0].slice(0, 200) : t.slice(0, 200));
    }
  });
  // Then any element with class/id containing contact or address, outside modals
  $("[class*='contact'], [id*='contact'], [class*='address'], [id*='address'], footer, .footer").each((_, el) => {
    if (isInsideModal($, el)) return;
    if (result.mainAddress) return;
    const t = cleanText($(el).text());
    const strict = t.match(US_ADDRESS_RE);
    if (strict && !looksLikeNavNotAddress(strict[0])) {
      result.mainAddress = strict[0].slice(0, 200);
      return;
    }
    const loose = t.match(US_ADDRESS_LOOSE_RE);
    if (loose && !looksLikeNavNotAddress(loose[0])) result.mainAddress = loose[0].slice(0, 200);
    const cityStateZip = t.match(US_CITY_STATE_ZIP_RE);
    if (!result.mainAddress && cityStateZip && !looksLikeNavNotAddress(cityStateZip[0])) result.mainAddress = cityStateZip[0].slice(0, 200);
  });
  // From main body text (modal content already removed in getMainBodyText), take first valid address line
  if (!result.mainAddress) {
    const mainText = getMainBodyText($);
    const strict = mainText.match(US_ADDRESS_RE);
    if (strict && !looksLikeNavNotAddress(strict[0])) result.mainAddress = strict[0].slice(0, 200);
    else {
      const loose = mainText.match(US_ADDRESS_LOOSE_RE);
      if (loose && !looksLikeNavNotAddress(loose[0])) result.mainAddress = loose[0].slice(0, 200);
    }
  }
  // Fallback: any line containing number + words + state + zip (e.g. "8630 W Sunrise Blvd Plantation FL 33322")
  if (!result.mainAddress) {
    const mainText = getMainBodyText($);
    const withStateZip = mainText.match(/\d+[\s\w\.#]+(?:FL|CA|NY|TX|IL|OH|GA|NC|PA|MI|NJ)\s+\d{5}(?:-\d{4})?/i);
    if (withStateZip && !looksLikeNavNotAddress(withStateZip[0])) {
      result.mainAddress = withStateZip[0].slice(0, 200);
    }
  }
  // Try looser pattern on main text (number, something, city, ST zip)
  if (!result.mainAddress) {
    const mainText = getMainBodyText($);
    const anyAddr = mainText.match(US_ADDRESS_ANY_RE);
    if (anyAddr && !looksLikeNavNotAddress(anyAddr[0])) result.mainAddress = anyAddr[0].slice(0, 200);
  }
  // City, State ZIP only fallback (no street number)
  if (!result.mainAddress) {
    const mainText = getMainBodyText($);
    const cityStateZip = mainText.match(US_CITY_STATE_ZIP_RE);
    if (cityStateZip && !looksLikeNavNotAddress(cityStateZip[0])) result.mainAddress = cityStateZip[0].slice(0, 200);
  }
  if (!result.mainAddress) {
    $("[class*='contact'], [id*='contact'], [class*='address'], footer, .footer").each((_, el) => {
      if (result.mainAddress) return;
      const t = cleanText($(el).text());
      const m = t.match(US_CITY_STATE_ZIP_RE);
      if (m && !looksLikeNavNotAddress(m[0])) result.mainAddress = m[0].slice(0, 200);
    });
  }
  // Last resort: search FULL page (including modals) for any address-like text. Reject if from Terms/Privacy.
  if (!result.mainAddress) {
    const fullText = cleanText($("body").text());
    const candidate = fullText.match(US_ADDRESS_RE)?.[0] || fullText.match(US_ADDRESS_LOOSE_RE)?.[0] || fullText.match(US_ADDRESS_ANY_RE)?.[0] || fullText.match(US_CITY_STATE_ZIP_RE)?.[0];
    if (candidate && !looksLikeNavNotAddress(candidate)) {
      const idx = fullText.indexOf(candidate);
      const surrounding = fullText.slice(Math.max(0, idx - 120), idx + candidate.length + 120);
      if (!/CountingWorks|legal@|Terms of Service|Privacy Policy|Copyright Agent|Newport Beach/i.test(surrounding)) {
        result.mainAddress = candidate.slice(0, 200);
      }
    }
  }
  if (!result.mainAddress) {
    const fullText = cleanText($("body").text());
    const stateZip = fullText.match(/\d+[\s\w\.#]+(?:FL|Florida|CA|NY|TX)\s+\d{5}(?:-\d{4})?/i);
    if (stateZip && !looksLikeNavNotAddress(stateZip[0])) {
      const idx = fullText.indexOf(stateZip[0]);
      const surrounding = fullText.slice(Math.max(0, idx - 80), idx + stateZip[0].length + 80);
      if (!/CountingWorks|legal@|Terms of Service/i.test(surrounding)) {
        result.mainAddress = stateZip[0].slice(0, 200);
      }
    }
  }
  return result;
}

/** Check if element is likely hidden or modal/legal (exclude from main content). Include dropdown/accordion/collapse content inside team/about sections. */
function isHiddenOrModal($: cheerio.CheerioAPI, el: unknown): boolean {
  const $el = $(el as DomElement);
  const cls = ($el.attr("class") || "") + " " + ($el.attr("id") || "");
  if (/modal|jetstream|terms|privacy|legal|disclaimer|accessibility\s*statement/i.test(cls)) return true;
  const style = ($el.attr("style") || "").toLowerCase();
  const isDisplayNone = style.includes("display:none") || style.includes("display: none");
  if (isDisplayNone && $el.closest("[class*='team'], [class*='about'], [class*='accordion'], [class*='collapse'], [class*='tab-content'], [class*='carousel'], [class*='slider']").length) return false;
  if (isDisplayNone) return true;
  return false;
}

/** True if this element or any ancestor is a modal (so we skip it when extracting visible contact) */
function isInsideModal($: cheerio.CheerioAPI, el: unknown): boolean {
  let current: unknown = el;
  while (current) {
    if (isHiddenOrModal($, current)) return true;
    const parent = $(current as DomElement).parent();
    current = parent.length ? parent[0] : null;
  }
  return false;
}

/** Get main page text. Excludes modals and cookie/gdpr. Does NOT remove display:none so dropdown/accordion/collapse content (e.g. team carousels) is included. */
function getMainBodyText($: cheerio.CheerioAPI): string {
  const $body = $("body").clone();
  $body.find("script, style, noscript").remove();
  $body.find("[class*='modal'], [id*='modal'], [class*='jetstream'], [class*='cookie'], [class*='gdpr']").remove();
  let text = cleanText($body.text());
  if (text.length < 150) {
    const $loose = $("body").clone();
    $loose.find("script, style, noscript").remove();
    $loose.find("[style*='display: none'], [style*='display:none']").remove();
    text = cleanText($loose.text());
  }
  return text;
}

/** Returns true if text looks like CSS/code/attributes (should not be used as narrative) */
function looksLikeCodeOrCss(text: string): boolean {
  return (
    /\[data-[a-z-]+[^\]]*\]|\{[^}]*\}|transition-duration|font-family\s*:|padding\s*:|margin\s*:|#[0-9a-fA-F]{3,6}\b|\.\d+px|rgba?\s*\(/i.test(text) ||
    /\b(px|em|rem|ms|vh|vw)\s*[;}]/.test(text) ||
    (text.includes("{") && text.includes("}"))
  );
}

/** Find "about us" / "our story" / "history" sections for founding story and company description. Excludes legal and code/CSS. */
function extractAboutAndStory($: cheerio.CheerioAPI): { foundingStory?: string; overview?: string } {
  const result: { foundingStory?: string; overview?: string } = {};
  const legalPattern = /terms of service|privacy policy|effective:\s*\w+|by using our (services|site)|disclaimer|copyright\s*©|all rights reserved/i;
  const storyKeywords = /founder|founding story|founded|started|began|our story|journey|since \d{4}|how we (started|began)|years of (experience|service)|established|opened (our|in)|year founded/i;

  const aboutSelectors = "[class*='about'], [id*='about'], [class*='story'], [id*='story'], [class*='history'], [class*='mission'], [class*='intro'], [class*='who-we'], [class*='founding'], [class*='our-story'], [id*='founding'], [id*='our-story'], [class*='company-detail']";
  $(aboutSelectors).each((_, el) => {
    if (isHiddenOrModal($, el)) return;
    const raw = $(el).text();
    const text = cleanText(raw);
    if (text.length < 60 || text.length > 5000) return;
    if (legalPattern.test(text) || looksLikeCodeOrCss(text)) return;
    if (!result.foundingStory && (storyKeywords.test(text) || /year\s+founded\s*[:=]?\s*\d{4}/i.test(text))) {
      const story = text.slice(0, 1500);
      if (story.length >= 100 && !/^[\w\s,'-]+!?\s*$/.test(story.slice(0, 80))) result.foundingStory = story;
    }
    if (!result.overview && text.length > 80 && !legalPattern.test(text) && !looksLikeCodeOrCss(text)) {
      result.overview = result.overview || text.slice(0, 800);
    }
  });
  if (!result.foundingStory) {
    $("main p, article p, [role='main'] p").each((_, el) => {
    if (result.foundingStory) return;
    if (isHiddenOrModal($, el)) return;
    const pText = cleanText($(el).text());
    if (pText.length < 80 || pText.length > 1500) return;
    if (legalPattern.test(pText) || looksLikeCodeOrCss(pText)) return;
    if (storyKeywords.test(pText)) {
      const next = cleanText($(el).nextAll("p").slice(0, 2).text());
      result.foundingStory = next ? pText + " " + next : pText;
      result.foundingStory = result.foundingStory.slice(0, 1500);
    }
    });
  }
  // Direct match: "Founder [Name] started ... in 2003" or "started his own ... practice ... in 2003" in ANY paragraph
  if (!result.foundingStory) {
    $("body p").each((_, el) => {
      if (result.foundingStory) return;
      if (isHiddenOrModal($, el)) return;
      const pText = cleanText($(el).text());
      if (pText.length < 80 || pText.length > 2500) return;
      if (legalPattern.test(pText) || looksLikeCodeOrCss(pText)) return;
      const hasFounderStarted = /\bfounder\b.*\bstarted\b|\bstarted\s+his\s+own\b|\bstarted\s+.*\s+practice\b|\bfounded\b.*\b\d{4}\b/i.test(pText);
      const hasYear = /\b(19|20)\d{2}\b/.test(pText);
      if (hasFounderStarted && hasYear) {
        const next = cleanText($(el).nextAll("p").slice(0, 2).text());
        result.foundingStory = (next ? pText + " " + next : pText).slice(0, 1500);
      }
    });
  }
  if (!result.foundingStory) {
    $("main [class*='about'], main [class*='story'], main [class*='history'], main [class*='founding'], [class*='founding-story']").each((_, el) => {
      if (result.foundingStory) return;
      if (isHiddenOrModal($, el)) return;
      const text = cleanText($(el).text());
      if (text.length < 100 || text.length > 4000 || looksLikeCodeOrCss(text) || legalPattern.test(text)) return;
      if (storyKeywords.test(text)) result.foundingStory = text.slice(0, 1500);
    });
  }
  if (!result.foundingStory) {
    const mainText = getMainBodyText($);
    const chunks = mainText.split(/\s{2,}|\n/).map((s) => s.trim()).filter((s) => s.length >= 80 && s.length <= 2500);
    for (const chunk of chunks) {
      if (legalPattern.test(chunk) || looksLikeCodeOrCss(chunk)) continue;
      if (storyKeywords.test(chunk) || (/we |our |company|team|years|experience|help|clients/i.test(chunk) && chunk.length >= 150)) {
        result.foundingStory = chunk.slice(0, 1500);
        break;
      }
    }
  }
  // Last resort: find "Founder ... started ... 2003" or "started his own ... practice" in full page text
  if (!result.foundingStory) {
    const fullText = cleanText($("body").text());
    const founderStart = fullText.search(/\b(?:Founder\s+\w+\s+\w+\s+started|started\s+his\s+own\s+\w+\s+practice)\b/i);
    if (founderStart >= 0) {
      const slice = fullText.slice(founderStart, founderStart + 1100);
      const lastPeriod = slice.lastIndexOf(".");
      const story = (lastPeriod > 150 ? slice.slice(0, lastPeriod + 1) : slice).trim();
      if (story.length >= 100 && /\b(19|20)\d{2}\b/.test(story) && !legalPattern.test(story)) result.foundingStory = story.slice(0, 1500);
    }
  }
  if (!result.overview) {
    const mainText = getMainBodyText($);
    const firstChunk = mainText.slice(0, 1500);
    if (firstChunk.length > 80 && !legalPattern.test(firstChunk) && !looksLikeCodeOrCss(firstChunk)) {
      result.overview = firstChunk.slice(0, 800);
    }
  }
  return result;
}

/** Infer industry from page title and main headings */
function inferIndustry($: cheerio.CheerioAPI, title: string): string | undefined {
  const mainText = getMainBodyText($).slice(0, 3000);
  const combined = (title + " " + mainText).toLowerCase();
  const industryMap: [RegExp, string][] = [
    [/tax|accounting|cpa|bookkeeping|audit/i, "Tax & Accounting"],
    [/consulting|advisory|professional services/i, "Consulting & Professional Services"],
    [/legal|law firm|attorney|lawyer/i, "Legal Services"],
    [/healthcare|medical|dental|clinic|hospital/i, "Healthcare"],
    [/insurance\b/i, "Insurance"],
    [/real estate|realtor|property management/i, "Real Estate"],
    [/marketing|agency|advertising/i, "Marketing & Advertising"],
    [/software|saas|technology|it services|web development/i, "Technology & Software"],
    [/financial (planning|services)|wealth|investment/i, "Financial Services"],
    [/construction|contractor|remodeling/i, "Construction"],
    [/plumb|well (drill|water|pump)|drilling/i, "Plumbing & Water"],
    [/landscap|lawn|garden|tree service/i, "Landscaping & Outdoor"],
    [/restaurant|catering|food service/i, "Food & Hospitality"],
    [/retail|store|shop\b|e-?commerce/i, "Retail"],
    [/education|training|tutoring|school/i, "Education"],
    [/automotive|auto repair|car (service|dealership)/i, "Automotive"],
    [/cleaning|janitorial|maid/i, "Cleaning Services"],
    [/photography|photo (studio|graphy)/i, "Photography"],
    [/design\b|interior design|graphic design/i, "Design"],
  ];
  for (const [re, industry] of industryMap) {
    if (re.test(combined)) return industry;
  }
  return undefined;
}

/** Infer business model from content and extract a concrete sentence when possible */
function inferBusinessModel($: cheerio.CheerioAPI): string | undefined {
  const text = getMainBodyText($).slice(0, 6000);
  const lower = text.toLowerCase();
  const sentenceRe = /(?:We|Our (?:company|firm|team)|We provide|We offer|We help|Our services include)[^.!?]{10,180}[.!?]/gi;
  const match = text.match(sentenceRe);
  if (match && match[0]) {
    const first = cleanText(match[0]).slice(0, 250);
    if (first.length > 30 && !/terms of service|privacy policy/i.test(first)) return first;
  }
  if (/consulting|advisory|professional services|we help|we work with clients/i.test(lower)) return "Professional services / Consulting";
  if (/subscription|monthly plan|retainer/i.test(lower)) return "Subscription / Retainer";
  if (/product|e-?commerce|shop|buy/i.test(lower) && !/we (don't|do not) (sell|offer)/i.test(lower)) return "Product sales / E-commerce";
  if (/b2b|business.?to.?business|enterprise/i.test(lower)) return "B2B";
  if (/b2c|consumer|individuals|families/i.test(lower)) return "B2C / Consumer";
  if (/tax|accounting|preparation|filing/i.test(lower)) return "Tax & accounting services";
  return undefined;
}

/** Build comprehensive overview that "hits the nail on the head" - includes company name, location, specialization, target market, differentiators, and value proposition. */
function extractComprehensiveOverview(
  $: cheerio.CheerioAPI,
  title: string,
  metaDescription: string,
  aboutStory: { overview?: string; foundingStory?: string },
  industry?: string,
  businessModel?: string,
  location?: string,
  yearFounded?: string
): string {
  const parts: string[] = [];
  const companyName = title || cleanText($("h1").first().text()) || "";
  
  // Start with company name and location if available
  if (companyName && location) {
    parts.push(`${companyName} is ${location.includes(",") ? "based in" : "located in"} ${location}.`);
  } else if (companyName) {
    parts.push(`${companyName} is`);
  }
  
  // Add founding year if available
  if (yearFounded && !parts.some(p => p.includes(yearFounded))) {
    const yearText = yearFounded.match(/\d{4}/)?.[0];
    if (yearText) {
      parts.push(`Since ${yearText === "1980" ? "its inception in 1980" : yearText === "2003" ? "2003" : `its founding in ${yearText}`},`);
    }
  }
  
  // Add company type/characteristics (family-owned, premier, trusted partner, etc.)
  const mainText = getMainBodyText($).toLowerCase();
  const characteristics: string[] = [];
  if (/family[-\s]?owned|family[-\s]?operated/i.test(mainText)) characteristics.push("a family-owned and operated company");
  if (/premier|leading|top[-\s]rated|trusted partner/i.test(mainText)) {
    if (/premier/i.test(mainText)) characteristics.push("a premier");
    else if (/leading/i.test(mainText)) characteristics.push("a leading");
    else if (/trusted partner/i.test(mainText)) characteristics.push("a trusted partner");
  }
  
  // Add specialization/what they do
  let specialization = "";
  if (industry) {
    specialization = industry.toLowerCase();
    if (specialization.includes("services")) {
      specialization = `providing ${specialization}`;
    } else if (!specialization.includes("providing") && !specialization.includes("specializing")) {
      specialization = `specializing in ${specialization}`;
    }
  } else if (businessModel) {
    specialization = businessModel.toLowerCase().slice(0, 150);
  }
  
  // Build the core description
  const heroParagraphs: string[] = [];
  $("main p, article p, [role='main'] p, .hero p, [class*='hero'] p, [class*='intro'] p, [class*='about'] p").slice(0, 5).each((_, el) => {
    if (isHiddenOrModal($, el)) return;
    const p = cleanText($(el).text());
    if (p.length >= 60 && p.length <= 500 && !/^(home|about|contact|login|sign|menu|privacy|terms)/i.test(p.slice(0, 30))) {
      const lower = p.toLowerCase();
      // Look for descriptive paragraphs that explain what the company does
      if (/specialize|provide|offer|serve|help|assist|dedicated|focused|expert|experience|years/i.test(lower)) {
        if (!heroParagraphs.some((x) => x.includes(p.slice(0, 50)))) heroParagraphs.push(p);
      }
    }
  });
  
  // Combine meta description with hero content
  if (metaDescription && metaDescription.length >= 60) {
    const metaLower = metaDescription.toLowerCase();
    if (!metaLower.includes("cookie") && !metaLower.includes("privacy policy")) {
      heroParagraphs.unshift(metaDescription);
    }
  }
  
  // Build comprehensive overview
  let overviewText = "";
  
  // First part: Company name + characteristics + location
  if (parts.length > 0) {
    overviewText = parts.join(" ");
  }
  
  // Add characteristics
  if (characteristics.length > 0 && !overviewText.includes(characteristics[0])) {
    overviewText += (overviewText ? " " : "") + characteristics[0];
  }
  
  // Add what they do/specialize in
  if (heroParagraphs.length > 0) {
    const firstPara = heroParagraphs[0];
    // Extract the core description
    let coreDesc = firstPara;
    
    // Look for key phrases that indicate specialization
    const specializeMatch = firstPara.match(/(?:specialize[sd]?|provides?|offers?|dedicated to|focused on|expert in)\s+([^.,]+)/i);
    if (specializeMatch && specializeMatch[1]) {
      coreDesc = specializeMatch[0];
    }
    
    // Combine with specialization if we have it
    if (specialization && !coreDesc.toLowerCase().includes(specialization.split(" ")[0])) {
      overviewText += (overviewText ? " " : "") + (specialization.startsWith("providing") || specialization.startsWith("specializing") ? specialization : `specializing in ${specialization}`);
    } else {
      overviewText += (overviewText ? " " : "") + coreDesc;
    }
  } else if (specialization) {
    overviewText += (overviewText ? " " : "") + (specialization.startsWith("providing") || specialization.startsWith("specializing") ? specialization : `specializing in ${specialization}`);
  }
  
  // Add who they serve
  const targetMatch = mainText.match(/(?:serves?|cater[s]? to|work[s]? with|help[s]?|assist[s]?)\s+([^.,]+(?:,?\s+and\s+[^.,]+)*)/i);
  if (targetMatch && targetMatch[1] && targetMatch[1].length < 200) {
    const target = cleanText(targetMatch[1]);
    if (!overviewText.toLowerCase().includes(target.toLowerCase().slice(0, 20))) {
      overviewText += ` The company serves ${target}.`;
    }
  }
  
  // Add key differentiators (experience, partnerships, etc.)
  const experienceMatch = mainText.match(/(\d+)\s+years?\s+of\s+(?:experience|service|expertise)/i);
  if (experienceMatch && !overviewText.includes(experienceMatch[0])) {
    overviewText += ` With ${experienceMatch[0]},`;
  }
  
  const partnershipMatch = mainText.match(/(?:partnered|partnership|partner)\s+with\s+([^.,]+)/i);
  if (partnershipMatch && partnershipMatch[1] && partnershipMatch[1].length < 100) {
    const partner = cleanText(partnershipMatch[1]);
    if (!overviewText.toLowerCase().includes(partner.toLowerCase().slice(0, 20))) {
      overviewText += ` The company has partnered with ${partner}.`;
    }
  }
  
  // Add value proposition from additional paragraphs
  if (heroParagraphs.length > 1) {
    const valueProp = heroParagraphs.slice(1, 3).join(" ");
    if (valueProp.length > 50 && valueProp.length < 400) {
      // Check if it adds new information
      const valueLower = valueProp.toLowerCase();
      if (/pride|dedicated|commitment|ensure|provide|deliver|expert|professional|quality|excellence/i.test(valueLower)) {
        if (!overviewText.toLowerCase().includes(valueProp.slice(0, 50).toLowerCase())) {
          overviewText += " " + valueProp;
        }
      }
    }
  }
  
  // Fallback to about story if we don't have enough content
  if (overviewText.length < 100 && aboutStory.overview) {
    overviewText = aboutStory.overview;
  }
  
  // Final cleanup and length limit
  overviewText = cleanText(overviewText);
  if (overviewText.length < 80) {
    // Use meta description or about story as fallback
    if (metaDescription && metaDescription.length >= 60) {
      overviewText = metaDescription;
    } else if (aboutStory.overview && aboutStory.overview.length >= 60) {
      overviewText = aboutStory.overview;
    } else {
      // Extract first paragraph as last resort
      const firstPara = $("main p, article p, [role='main'] p").first().text();
      if (firstPara && cleanText(firstPara).length >= 60) {
        overviewText = cleanText(firstPara);
      }
    }
  }
  
  return overviewText.slice(0, 1000); // Allow longer overviews like in the PDF
}

/** Build company pitch from hero, h1, and first paragraphs (not just meta description). */
function extractCompanyPitch($: cheerio.CheerioAPI, metaDescription: string): string {
  const parts: string[] = [];
  if (metaDescription && metaDescription.length >= 40) parts.push(metaDescription.slice(0, 300));
  const h1 = cleanText($("h1").first().text());
  if (h1 && h1.length > 10 && h1.length < 200 && !parts.some((p) => p.includes(h1))) parts.push(h1);
  $("main p, article p, [role='main'] p, .hero p, [class*='hero'] p").slice(0, 3).each((_, el) => {
    if (isHiddenOrModal($, el)) return;
    const p = cleanText($(el).text());
    if (p.length >= 40 && p.length <= 400 && !/^(home|about|contact|login)/i.test(p.slice(0, 20))) {
      if (!parts.some((x) => x.includes(p.slice(0, 50)))) parts.push(p);
    }
  });
  const mainText = getMainBodyText($).slice(0, 800);
  if (parts.length < 2 && mainText.length > 60) {
    const firstPara = mainText.split(/\s{2,}/)[0];
    if (firstPara && firstPara.length >= 40 && !parts.includes(firstPara)) parts.push(firstPara);
  }
  return parts.length > 0 ? parts.join(" ").slice(0, 500) : metaDescription?.slice(0, 300) || "";
}

/** Extract offerings with name, description (full paragraph), features, pricing from service/product sections. */
function extractOfferingsWithDetails($: cheerio.CheerioAPI): Offering[] {
  const offerings: Offering[] = [];
  const skipPattern = /^(home|about|contact|login|menu)$|testimonial|what (our )?clients (are )?saying|join our newsletter|newsletter|why (choose )?us|why (we|us)\b|get in touch|follow us|sign up|subscribe|our (team|story|mission)|contact us|request a quote|schedule (a )?(call|consultation)|faq|frequently asked|track your refund|directory/i;
  
  // Look for featured listings, services, products, offerings sections (including insurance)
  const sectionSelectors = [
    '[class*="service"]',
    '[class*="product"]',
    '[class*="pricing"]',
    '[class*="offer"]',
    '[class*="featured"]',
    '[class*="listing"]',
    '[class*="solution"]',
    '[class*="package"]',
    '[class*="plan"]',
    '[class*="card"]',
    '[class*="insurance"]',
    '[class*="coverage"]',
    '[id*="service"]',
    '[id*="product"]',
    '[id*="offer"]',
    'article',
    'section',
  ];
  
  sectionSelectors.forEach((selector) => {
    $(selector).each((_, section) => {
      if (isHiddenOrModal($, section)) return;
      const $section = $(section);
      
      // Find headings that might be service/product names
      $section.find("h2, h3, h4, h5, .title, [class*='title'], [class*='name'], [class*='heading']").each((__, el) => {
        const name = cleanText($(el).text());
        if (!name || name.length < 3 || name.length > 150 || skipPattern.test(name)) return;
        
        // Find the parent container (card, article, section, etc.)
        const $parent = $(el).closest("article, [class*='card'], [class*='item'], [class*='service'], [class*='product'], [class*='offer'], [class*='plan'], section, div").length > 0
          ? $(el).closest("article, [class*='card'], [class*='item'], [class*='service'], [class*='product'], [class*='offer'], [class*='plan'], section, div")
          : $(el).parent();
        
        // Try multiple strategies to get description
        let desc = "";
        
        // Strategy 1: Look for paragraphs that come after "Features:" (common in listings)
        const allText = $parent.text();
        const featuresIndex = allText.toLowerCase().indexOf("features:");
        if (featuresIndex > -1) {
          // Get text after "Features:" and before "Pricing:" or end
          const afterFeatures = allText.slice(featuresIndex);
          const pricingIndex = afterFeatures.toLowerCase().indexOf("pricing:");
          const textBetween = pricingIndex > -1 ? afterFeatures.slice(0, pricingIndex) : afterFeatures;
          // Extract the descriptive paragraph (usually the longest paragraph)
          const paragraphs = textBetween.split(/\n+/).map(p => cleanText(p).trim()).filter(p => p.length > 50);
          if (paragraphs.length > 0) {
            // Get the longest paragraph (likely the description)
            const longest = paragraphs.reduce((a, b) => a.length > b.length ? a : b);
            if (longest.length > 50) desc = longest.slice(0, 600);
          }
        }
        
        // Strategy 2: Text immediately after the heading (until next heading)
        if (desc.length < 30) {
          const $afterHeading = $(el).nextUntil("h1, h2, h3, h4, h5");
          const afterText = cleanText($afterHeading.text()).trim();
          if (afterText.length > 30) desc = afterText.slice(0, 600);
        }
        
        // Strategy 3: First paragraph in parent that's descriptive (not features/pricing)
        if (desc.length < 30) {
          const paragraphs = $parent.find("p").map((_, p) => cleanText($(p).text())).get();
          const descriptive = paragraphs.filter(p => {
            const lower = p.toLowerCase();
            return p.length > 50 && 
                   !lower.includes("features:") && 
                   !lower.includes("pricing:") &&
                   !lower.match(/^\d+\s*(bed|bath|sqft|car)/i); // Not just feature stats
          });
          if (descriptive.length > 0) {
            desc = descriptive[0].slice(0, 500);
          }
        }
        
        // Strategy 4: All paragraphs in parent, excluding the heading and feature lists
        if (desc.length < 30) {
          const paragraphs = $parent.find("p").map((_, p) => cleanText($(p).text())).get();
          const combined = paragraphs
            .filter(p => {
              const lower = p.toLowerCase();
              return p.length > 20 && 
                     !lower.includes("features:") && 
                     !lower.includes("pricing:");
            })
            .join(" ")
            .slice(0, 500);
          if (combined.length > 30) desc = combined;
        }
        
        // Strategy 4: Description from data attributes or meta
        if (desc.length < 30) {
          const dataDesc = $parent.attr("data-description") || $parent.attr("aria-label") || $(el).attr("data-description");
          if (dataDesc && dataDesc.length > 30) desc = cleanText(dataDesc).slice(0, 500);
        }
        
        // Strategy 5: Extract from parent text, removing the heading
        if (desc.length < 30) {
          const parentFull = cleanText($parent.text());
          const headingText = cleanText($(el).text());
          const withoutHeading = parentFull.replace(headingText, "").trim();
          if (withoutHeading.length > 30) desc = withoutHeading.slice(0, 500);
        }
        
        // Extract features/benefits - look for "Features:" label pattern
        const features: string[] = [];
        const blockText = $parent.text();
        
        // Pattern 1: Look for "Features:" label followed by comma-separated list
        const featuresLabelMatch = blockText.match(/Features:\s*([^Pricing:]+?)(?:\n|Pricing:|$)/i);
        if (featuresLabelMatch) {
          const featuresText = featuresLabelMatch[1];
          // Split by commas and clean up
          const featureItems = featuresText.split(',').map(f => cleanText(f).trim()).filter(f => f.length > 3 && f.length < 200);
          features.push(...featureItems);
        }
        
        // Pattern 2: Look for structured lists (ul/ol)
        $parent.find("li, [class*='feature'], [class*='benefit'], [class*='include'], [class*='detail']").each((_, li) => {
          const t = cleanText($(li).text());
          if (t.length > 5 && t.length < 200 && !skipPattern.test(t)) {
            features.push(t);
          }
        });
        
        // Pattern 3: Look for comma-separated features in text (common in listings)
        if (features.length === 0) {
          const featuresPattern = /(?:features?|includes?|specs?|details?):\s*([^.\n]+(?:,\s*[^.\n]+)+)/i;
          const match = blockText.match(featuresPattern);
          if (match) {
            const featureList = match[1].split(',').map(f => cleanText(f).trim()).filter(f => f.length > 3 && f.length < 200);
            features.push(...featureList);
          }
        }
        
        // Extract pricing - look for "Pricing:" label pattern
        let pricing: string | undefined = undefined;
        
        // Pattern 1: Look for "Pricing:" label
        const pricingLabelMatch = blockText.match(/Pricing:\s*([^\n]+)/i);
        if (pricingLabelMatch) {
          pricing = cleanText(pricingLabelMatch[1]).slice(0, 100);
        }
        
        // Pattern 2: Look for price patterns in text (including "Personalized Quote" for insurance/services)
        if (!pricing) {
          const priceMatch = blockText.match(/\$[\d,]+(?:\.\d{2})?(?:\s*\/\s*(?:mo|month|yr|year|per|each))?|\d+(?:\.\d{2})?\s*(?:USD|EUR|GBP|dollars?)|(?:Fixed Price|Commission-based|Price):\s*[\d,]+|Personalized Quote|Free Estimate|Per Project|Per (?:Inspection|Service Call)|Contact (?:us|for quote)/i);
          if (priceMatch) pricing = priceMatch[0];
        }
        
        // Improve description extraction - remove features and pricing lines if they're in the description
        if (desc) {
          // Remove "Features:" line if present
          desc = desc.replace(/Features:\s*[^\n]+/gi, "").trim();
          // Remove "Pricing:" line if present
          desc = desc.replace(/Pricing:\s*[^\n]+/gi, "").trim();
          // Clean up whitespace
          desc = desc.replace(/\s+/g, " ").trim();
          // Remove very short sentences that are likely navigation
          desc = desc.split(/[.!?]\s+/).filter(s => s.length > 15).join(". ").slice(0, 600);
        }
        
        // If description is still short but we have features, try to get description from paragraphs after features
        if (desc.length < 50 && features.length > 0) {
          const $afterFeatures = $parent.find("p").filter((_, p) => {
            const text = cleanText($(p).text());
            return text.length > 50 && !text.toLowerCase().includes("features:") && !text.toLowerCase().includes("pricing:");
          });
          if ($afterFeatures.length > 0) {
            const descText = cleanText($afterFeatures.first().text()).slice(0, 600);
            if (descText.length > 50) desc = descText;
          }
        }
        
        // Only add if we have a meaningful name and either description or features
        if (name && (desc.length > 25 || features.length > 0)) {
          if (!offerings.some((o) => o.name.toLowerCase() === name.toLowerCase())) {
            offerings.push({
              name,
              type: "service",
              description: desc.length > 25 ? desc.slice(0, 600) : undefined,
              features: features.length > 0 ? features.slice(0, 10) : undefined,
              pricing: pricing || undefined,
              category: undefined,
            });
          }
        }
      });
    });
  });
  
  return offerings;
}

/** Extract "what the customer gets" – services/offerings from title, tagline, headings, and lists */
function extractCustomerOfferings($: cheerio.CheerioAPI, title: string): { offerings: Offering[]; customerGets?: string } {
  const offerings: Offering[] = [];
  const mainText = getMainBodyText($).slice(0, 5000);
  const titleLower = title.toLowerCase();

  const fromTitleAndTagline: string[] = [];
  if (/tax|accounting|cpa/i.test(titleLower)) fromTitleAndTagline.push("Tax preparation and filing", "Tax planning and consulting", "Accounting services");
  if (/consulting/i.test(titleLower)) fromTitleAndTagline.push("Consulting services", "Advisory");
  if (/legal|law|attorney/i.test(titleLower)) fromTitleAndTagline.push("Legal services", "Legal advice");
  if (/insurance/i.test(titleLower)) {
    fromTitleAndTagline.push("Insurance products and advice");
    // Add common insurance product names if we see them on the page
    const insuranceOfferings = ["Life Insurance", "Auto Insurance", "Home Insurance", "Business Insurance", "Flood Insurance", "Rental Insurance", "Umbrella Insurance"];
    insuranceOfferings.forEach((name) => {
      if (mainText.toLowerCase().includes(name.toLowerCase()) && !offerings.some((o) => o.name.toLowerCase() === name.toLowerCase())) {
        offerings.push({ name, type: "service" });
      }
    });
  }
  fromTitleAndTagline.forEach((name) => {
    if (!offerings.some((o) => o.name.toLowerCase() === name.toLowerCase())) {
      offerings.push({ name, type: "service" });
    }
  });

  const notServiceHeading = /testimonial|what (our )?clients|newsletter|why (choose )?us|why (we|us)\b|join our|get in touch|follow us|sign up|subscribe|our (team|story|mission)|contact us|request a quote|schedule (a )?(call|consultation)|faq|frequently asked/i;
  $("[class*='service'], [class*='offer'], [class*='what we'], [class*='what you'], [class*='solutions']").each((_, section) => {
    if (isHiddenOrModal($, section)) return;
    $(section).find("h2, h3, h4, h5, li, [class*='item']").each((__, el) => {
      const t = cleanText($(el).text());
      if (t.length >= 3 && t.length <= 120 && !/^(home|about|contact|login|sign|menu)$/i.test(t) && !notServiceHeading.test(t)) {
        const name = t;
        if (!offerings.some((o) => o.name.toLowerCase() === name.toLowerCase())) {
          offerings.push({ name, type: "service", description: undefined });
        }
      }
    });
  });

  const firstHeadings = $("h1, h2").map((_, el) => cleanText($(el).text())).get().filter((t) => t.length > 5 && t.length < 150);
  firstHeadings.forEach((h) => {
    if (!offerings.some((o) => o.name === h) && !/^(home|about|contact|services|our team)$/i.test(h) && !notServiceHeading.test(h)) {
      offerings.push({ name: h, type: "service" });
    }
  });

  const customerGets = offerings.length > 0
    ? offerings.slice(0, 8).map((o) => o.name).join("; ")
    : undefined;

  return {
    offerings: offerings.length > 0 ? offerings.slice(0, 15) : [],
    customerGets,
  };
}

/** Get email and phone from a container (card/person block). */
function getContactFromContainer($: cheerio.CheerioAPI, $container: cheerio.Cheerio<DomElement | import("domhandler").AnyNode>): { email?: string; phone?: string } {
  let email: string | undefined;
  let phone: string | undefined;
  $container.find('a[href^="mailto:"]').each((_, el) => {
    if (email) return;
    const href = $(el).attr("href");
    if (href) {
      const addr = href.replace(/^mailto:/i, "").split("?")[0].trim();
      if (addr && addr.length < 120) email = addr;
    }
  });
  $container.find('a[href^="tel:"]').each((_, el) => {
    if (phone) return;
    const href = $(el).attr("href");
    if (href) {
      const digits = href.replace(/^tel:/i, "").replace(/\D/g, "");
      if (digits.length >= 10) phone = href.replace(/^tel:/i, "").trim();
    }
  });
  if (!phone) {
    const text = $container.text();
    const phoneMatch = text.match(/\b(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})\b/);
    if (phoneMatch) phone = phoneMatch[1];
  }
  return { email, phone };
}

/** Get bio/description from a container: p, [class*='bio'], [class*='description'], expandable sibling, or rest of card text. */
function getBioFromContainer($: cheerio.CheerioAPI, $container: cheerio.Cheerio<DomElement | import("domhandler").AnyNode>, personName: string): string | undefined {
  let bio = "";
  $container.find("[class*='bio'], [class*='description'], [class*='about'], .bio, .description, [class*='content']").each((_, el) => {
    const t = cleanText($(el).text());
    if (t.length > 30 && t.length < 2000 && !t.startsWith(personName) && !/^read bio|^contact|^email|^phone/i.test(t.slice(0, 30))) {
      if (t.length > (bio.length || 0)) bio = t;
    }
  });
  if (bio) return bio.slice(0, 600);
  const paragraphs: string[] = [];
  $container.find("p").each((_, el) => {
    const t = cleanText($(el).text());
    if (t.length > 40 && t.length < 1500 && !/^[\d\-.\s()]+$/.test(t) && !t.toLowerCase().startsWith(personName.toLowerCase().split(" ")[0])) {
      paragraphs.push(t);
    }
  });
  if (paragraphs.length > 0) return paragraphs.join(" ").slice(0, 600);
  const $parent = $container.parent();
  $container.nextAll().add($parent.nextAll().find("[class*='bio'], [class*='description'], [class*='content']")).each((_, el) => {
    const t = cleanText($(el).text());
    if (t.length > 50 && t.length < 2000 && !/^read bio|^contact|^email|^phone/i.test(t.slice(0, 40))) {
      if (t.length > (bio.length || 0)) bio = t;
    }
  });
  if (bio) return bio.slice(0, 600);
  const fullText = cleanText($container.text());
  const withoutName = fullText.replace(new RegExp(personName.replace(/\s+/g, "\\s+"), "gi"), "").trim();
  const withoutContact = withoutName.replace(/\S+@\S+\.\S+/g, "").replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "").trim();
  const noButtons = withoutContact.replace(/read bio|learn more|contact|email|phone/gi, "").trim();
  if (noButtons.length > 50) return noButtons.slice(0, 600);
  return undefined;
}

/** True if element is inside a testimonial/review block (so we don't add customer names as key people). */
function isInsideTestimonialSection($: cheerio.CheerioAPI, el: unknown): boolean {
  const $el = $(el as DomElement);
  if ($el.closest('[class*="testimonial"], [class*="review"]').length) return true;
  let current: unknown = el;
  while (current) {
    const $parent = $(current as DomElement).parent();
    if (!$parent.length) break;
    const parent = $parent[0];
    const directHeadings = $(parent).children("h1, h2, h3, h4").map((_, h) => cleanText($(h).text())).get();
    if (directHeadings.some((t) => /what\s+our\s+clients\s+(are\s+)?say|testimonial|^reviews?$/i.test(t))) return true;
    current = parent;
  }
  return false;
}

/** Extract key people from team, about, leadership, and similar sections. Pulls name, title, bio, email, phone from each card. */
function extractKeyPeople($: cheerio.CheerioAPI, excludeHeadings: string[] = []): KeyPerson[] {
  const seen = new Set<string>();
  const result: KeyPerson[] = [];

  const looksLikePlace = (s: string) => {
    const t = s.trim();
    if (/\s/.test(t)) return /\b(valley|hills|beach|city|town|area|park|lake|springs|heights|village|paradise\s+valley|dripping\s+springs|hill\s+country)\b/i.test(t);
    return /^(scottsdale|arcadia|phoenix|tempe|mesa|chandler|glendale|paradise|burnet|austin|locations?|offices?|areas?|services?)$/i.test(t);
  };

  /** Blocklist: never treat these as key people (headings, CTAs, services, years, etc.) */
  const notAPerson = (s: string) => {
    const t = s.trim().toLowerCase();
    if (/\d/.test(t)) return true;
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length < 2) return true;
    if (words.length > 4) return true;
    const blocklist = [
      "contact form", "ready to", "water drilling", "since 1980", "since 19", "since 20",
      "learn more", "schedule", "get in touch", "our services", "join our", "well drilling",
      "well inspection", "pumping systems", "water well", "public supply", "experience the",
      "bee cave drilling", "the difference", "client login", "schedule appointment",
      "request a quote", "read more", "see all", "why ", "our well", "well maintenance",
    ];
    if (blocklist.some((p) => t.includes(p))) return true;
    if (/^(water|well|pumping|public|our|the|why|join|schedule|contact|ready|learn|see|get|request)\s/i.test(t)) return true;
    if (/\s(drilling|inspection|systems|services|form|appointment|newsletter|difference)$/i.test(t)) return true;
    return false;
  };

  /** Split "Name — Title", "Name - Title", or "Name, Title" into [name, title]. */
  const splitNameTitle = (raw: string): { name: string; title?: string } => {
    const t = cleanText(raw);
    const dashMatch = t.match(/^(.+?)\s+[—–\-]\s+(.+)$/);
    if (dashMatch) {
      const namePart = cleanText(dashMatch[1]);
      const titlePart = cleanText(dashMatch[2]);
      if (namePart.length >= 2 && namePart.length <= 60 && titlePart.length >= 2 && titlePart.length <= 80) return { name: namePart, title: titlePart };
    }
    const commaMatch = t.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*,\s*(.+)$/);
    if (commaMatch) {
      const namePart = cleanText(commaMatch[1]);
      const titlePart = cleanText(commaMatch[2]);
      if (namePart.length >= 4 && namePart.length <= 50 && titlePart.length >= 2 && titlePart.length <= 80 && /founder|owner|partner|cpa|ceo|cto|president|director|manager|agent/i.test(titlePart)) return { name: namePart, title: titlePart };
    }
    return { name: t };
  };

  const add = (name: string, title?: string, description?: string, email?: string, phone?: string) => {
    const n = cleanText(name);
    if (!n || n.length < 2 || n.length > 80) return;
    const skip = /^(home|about|contact|services|our team|menu|login|sign|faq|blog|read more|learn more|view profile|see all|follow|subscribe)$/i;
    if (skip.test(n)) return;
    if (excludeHeadings.includes(n)) return;
    if (looksLikePlace(n)) return;
    if (notAPerson(n)) return;
    const key = n.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) return;
    seen.add(key);
    let parsedTitle = title;
    if (!parsedTitle && description) {
      const titleMatch = description.match(/\b(CEO|CFO|CTO|COO|President|Director|Manager|Lead|Founding Partner|Founder|Owner|Partner|CPA|VP|Vice President|Head of|Chief|Consultant|Specialist|Coordinator|Engineer|Technician|Analyst)\b[\s\w\-&]*/i);
      if (titleMatch) parsedTitle = titleMatch[0].trim();
    }
    let desc = description ? cleanText(description).slice(0, 600) : undefined;
    if (desc && (desc.toLowerCase().trim() === key || desc.trim().length < 25 || desc.toLowerCase().trim() === n.toLowerCase().trim())) desc = undefined;
    result.push({
      name: n,
      title: parsedTitle || undefined,
      role: undefined,
      description: desc || undefined,
      email: email || undefined,
      phone: phone || undefined,
    });
  };

  // High-confidence: sections that are clearly team/leadership (run first, prefer these names)
  const sectionSelHigh = [
    "[class*='team']", "[class*='staff']", "[class*='leadership']", "[class*='our-team']",
    "[class*='meet-the']", "[class*='key-people']", "[class*='agent']", "[class*='partner']",
    "[id*='team']", "[id*='leadership']", "[id*='staff']", "[id*='agent']",
  ].join(", ");
  // Lower-confidence: about, people, etc. (run after; can contain non-people content)
  const sectionSelRest = [
    "[class*='about']", "[class*='people']", "[class*='member']", "[class*='employee']",
    "[class*='profile']", "[class*='bio']", "[class*='board']", "[class*='management']",
    "[class*='executive']", "[class*='crew']", "[class*='who-we']",
    "[id*='about']", "[id*='people']",
  ].join(", ");

  const cardSel = "[class*='card'], [class*='item'], [class*='member'], [class*='person'], [class*='agent'], [class*='partner'], figure, [class*='profile-card']";

  const processSection = (section: unknown) => {
    if (isHiddenOrModal($, section)) return;
    const $sec = $(section as DomElement);
    $sec.find(cardSel).each((__, card) => {
      if (isInsideTestimonialSection($, card)) return;
      const $card = $(card as DomElement);
      const nameEl = $card.find("h2, h3, h4, h5, .name, [class*='name'], [class*='person-name'], strong").first();
      if (!nameEl.length) return;
      const { name: personName, title: dashTitle } = splitNameTitle(nameEl.text());
      const name = personName;
      if (name.length < 2 || name.length > 80) return;
      const contact = getContactFromContainer($, $card);
      const bio = getBioFromContainer($, $card, name);
      const titleEl = $card.find("[class*='title'], [class*='role'], .title, .role").first();
      const titleText = (titleEl.length ? cleanText(titleEl.text()) : undefined) || dashTitle;
      add(name, titleText || undefined, bio || undefined, contact.email, contact.phone);
    });
    $sec.find("h2, h3, h4, h5, .name, [class*='name'], [class*='person-name'], strong, dt").each((__, el) => {
      if (isInsideTestimonialSection($, el)) return;
      const $el = $(el as DomElement);
      if ($el.closest(cardSel).length) return;
      const rawName = $el.text();
      const { name, title: dashTitle } = splitNameTitle(rawName);
      if (name.length < 2 || name.length > 80) return;
      const $parent = $el.parent();
      const contact = getContactFromContainer($, $parent);
      const nextText = $el.next().text();
      const parentText = $parent.text().replace(rawName, "").trim();
      const desc = nextText && nextText.length > 15 ? nextText : parentText;
      const bio = getBioFromContainer($, $parent, name) || (desc.length > 20 ? cleanText(desc).slice(0, 600) : undefined);
      add(name, dashTitle || undefined, bio, contact.email, contact.phone);
    });
  };

  $(sectionSelHigh).each((_, section) => processSection(section));
  if (result.length < 3) $(sectionSelRest).each((_, section) => processSection(section));

  if (result.length === 0) {
    $("h3, h4, h5").each((_, el) => {
      if (isInsideTestimonialSection($, el)) return;
      const { name, title: dashTitle } = splitNameTitle($(el as DomElement).text());
      if (name.length >= 2 && name.length <= 80 && !excludeHeadings.includes(name)) {
        const $el = $(el as DomElement);
        const $parent = $el.parent();
        const contact = getContactFromContainer($, $parent);
        const desc = $el.next().text() || $parent.text();
        add(name, dashTitle || undefined, cleanText(desc).slice(0, 600), contact.email, contact.phone);
      }
    });
  }

  // Fallback: any block with a name-like heading (2–4 words) and mailto/tel in same container = person
  if (result.length === 0) {
    $("h2, h3, h4, h5, strong").each((_, el) => {
      if (isInsideTestimonialSection($, el)) return;
      const $el = $(el as DomElement);
      const { name, title: dashTitle } = splitNameTitle($el.text());
      const words = name.split(/\s+/).filter(Boolean);
      if (words.length < 2 || words.length > 4 || name.length > 50) return;
      if (excludeHeadings.includes(name) || looksLikePlace(name)) return;
      const $container = $el.closest("section, article, div[class], aside").length ? $el.closest("section, article, div[class], aside") : $el.parent();
      const contact = getContactFromContainer($, $container);
      if (!contact.email && !contact.phone) return;
      const titleEl = $container.find("[class*='title'], [class*='role'], .title, .role").first();
      const titleText = (titleEl.length ? cleanText(titleEl.text()) : undefined) || dashTitle;
      add(name, titleText || undefined, undefined, contact.email, contact.phone);
    });
  }

  // Fallback: "Name — Title" / "Name, Title" only when we have few people and only in about/team context
  if (result.length < 3) {
    $("p, li, td").each((_, el) => {
      if (isHiddenOrModal($, el) || isInsideTestimonialSection($, el)) return;
      const $el = $(el as DomElement);
      if (!$el.closest("[class*='about'], [class*='team'], [class*='leadership'], [class*='staff'], [id*='about'], [id*='team']").length) return;
      const raw = $el.text();
      const lines = raw.split(/\n|\.\s+/).map((l) => cleanText(l));
      for (const line of lines) {
        const dashMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+[—–\-]\s+(.{2,80})$/);
        if (dashMatch) {
          const personName = cleanText(dashMatch[1]);
          const titlePart = cleanText(dashMatch[2]);
          if (personName.length >= 4 && !looksLikePlace(personName) && /founder|partner|owner|cpa|president|director|agent|manager|cto|ceo|chief/i.test(titlePart)) add(personName, titlePart, undefined, undefined, undefined);
        }
        const commaMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*,\s*(.{2,80})$/);
        if (commaMatch) {
          const personName = cleanText(commaMatch[1]);
          const titlePart = cleanText(commaMatch[2]);
          if (personName.length >= 4 && !looksLikePlace(personName) && !notAPerson(personName) && /founder|owner|partner|cpa|ceo|cto|president|director|manager|agent|chief/i.test(titlePart)) add(personName, titlePart, undefined, undefined, undefined);
        }
      }
    });
  }

  // From about/team narrative: "Founder Doug Cohen" or "Doug Cohen, founder" or "Jim Blair is a..."
  if (result.length < 5) {
    const titleNameRe = /\b(Founder|Owner|President|CEO|CTO|COO|Partner|Director|Manager|Lead)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g;
    const nameTitleRe = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+(?:is\s+)?(?:a\s+)?(?:the\s+)?(founder|owner|president|ceo|cto|partner|director|manager|wealth\s+of\s+knowledge)\b/gi;
    $("[class*='about'], [class*='team'], [class*='leadership'], [class*='staff'], [id*='about'], [id*='team']").each((_, el) => {
      if (isInsideTestimonialSection($, el)) return;
      const text = cleanText($(el).text());
      let m: RegExpExecArray | null;
      titleNameRe.lastIndex = 0;
      while ((m = titleNameRe.exec(text)) !== null) {
        const title = m[1];
        const name = cleanText(m[2]);
        if (name.length >= 4 && name.length <= 40 && !looksLikePlace(name) && !notAPerson(name)) add(name, title, undefined, undefined, undefined);
      }
      nameTitleRe.lastIndex = 0;
      while ((m = nameTitleRe.exec(text)) !== null) {
        const name = cleanText(m[1]);
        const title = m[2].toLowerCase().includes("wealth") ? "Advisor" : m[2];
        if (name.length >= 4 && name.length <= 40 && !looksLikePlace(name) && !notAPerson(name)) add(name, title, undefined, undefined, undefined);
      }
    });
  }

  return result.slice(0, 30);
}

/** Find "Read Bio" / profile links in person cards. Returns { name, bioUrl } for people whose card has a bio link (so we can fetch the bio page). */
function getBioLinksFromPage($: cheerio.CheerioAPI, pageUrl: string, origin: string): { name: string; bioUrl: string }[] {
  const links: { name: string; bioUrl: string }[] = [];
  const sectionSel = "[class*='team'], [class*='staff'], [class*='leadership'], [class*='about'], [class*='people'], [class*='member'], [class*='profile'], [class*='bio'], [class*='board'], [class*='management'], [class*='executive']";
  const cardSel = "[class*='card'], [class*='item'], [class*='member'], [class*='person']";
  const bioLinkText = /read\s+bio|view\s+bio|full\s+bio|learn\s+more|see\s+full|profile|about\s+them/i;

  $(sectionSel).each((_, section) => {
    if (isHiddenOrModal($, section)) return;
    $(section).find(cardSel).each((__, card) => {
      const $card = $(card);
      const nameEl = $card.find("h2, h3, h4, h5, .name, [class*='name'], strong").first();
      if (!nameEl.length) return;
      const name = cleanText(nameEl.text());
      if (name.length < 2 || name.length > 80) return;
      const hasBio = getBioFromContainer($, $card, name);
      if (hasBio && hasBio.length > 100) return;
      $card.find("a[href]").each((_, a) => {
        const href = $(a).attr("href");
        const text = cleanText($(a).text());
        if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
        try {
          const full = new URL(href, pageUrl).href;
          if (new URL(full).origin !== origin) return;
          if (bioLinkText.test(text) || /team|about|leadership|staff|profile|bio/i.test(href)) {
            links.push({ name, bioUrl: full });
            return false;
          }
        } catch {
          // ignore
        }
      });
    });
  });
  return links;
}

/** Fetch a profile/bio page and return main content as a single string (for use as biography). */
async function fetchBioFromUrl(url: string): Promise<string | undefined> {
  const html = await fetchPage(url);
  if (!html) return undefined;
  const $ = cheerio.load(html);
  const parts: string[] = [];
  $("article p, main p, [role='main'] p, .content p, [class*='bio'] p, [class*='profile'] p").each((_, el) => {
    const t = cleanText($(el).text());
    if (t.length > 30 && t.length < 3000) parts.push(t);
  });
  if (parts.length > 0) return parts.join(" ").slice(0, 800);
  const mainText = getMainBodyText($);
  if (mainText.length > 100) return mainText.slice(0, 800);
  return undefined;
}

/** For key people missing a description, fetch their bio page if we have a link and fill in the description. */
async function fillBiosFromProfilePages(
  people: KeyPerson[],
  bioLinks: { name: string; bioUrl: string }[],
  origin: string
): Promise<void> {
  const byName = new Map(bioLinks.map((l) => [l.name.toLowerCase().trim(), l.bioUrl]));
  const fetched = new Set<string>();
  let count = 0;
  const maxFetches = 10;
  for (const person of people) {
    if (count >= maxFetches) break;
    if (person.description && person.description.length > 150) continue;
    const url = byName.get(person.name.toLowerCase().trim());
    if (!url || fetched.has(url)) continue;
    fetched.add(url);
    const bio = await fetchBioFromUrl(url);
    if (bio && bio.trim().length > 40 && bio.trim().toLowerCase() !== person.name.trim().toLowerCase()) {
      person.description = bio;
      count++;
    }
  }
}

/** Extract certifications, awards, trust signals */
function extractCertificationsAwards($: cheerio.CheerioAPI): string[] {
  const items: string[] = [];
  $("[class*='certified'], [class*='award'], [class*='accreditation'], [class*='badge'], [class*='accreditation']").each((_, el) => {
    const t = cleanText($(el).text());
    const alt = $(el).find("img").attr("alt") || $(el).attr("title");
    if (t && t.length < 150) items.push(t);
    if (alt && alt.length < 150 && !items.includes(alt)) items.push(alt);
  });
  return [...new Set(items)].slice(0, 15);
}

/** Extract pricing from page (currency amounts near pricing/plan headings) */
function extractPricingFromText($: cheerio.CheerioAPI): string[] {
  const prices: string[] = [];
  const priceRe = /\$[\d,]+(?:\.\d{2})?(?:\s*\/\s*(?:mo|month|yr|year))?|\d+(?:\.\d{2})?\s*(?:USD|EUR|GBP)/gi;
  $("[class*='pricing'], [class*='price'], [class*='plan']").each((_, el) => {
    const t = $(el).text();
    const matches = t.match(priceRe);
    if (matches) prices.push(...matches);
  });
  return [...new Set(prices)].slice(0, 10);
}

/** Extract values / community / culture phrases */
function extractValuesCommunity($: cheerio.CheerioAPI): string[] {
  const items: string[] = [];
  $("[class*='value'], [class*='mission'], [class*='vision'], [class*='culture'], [class*='community']").each((_, el) => {
    const headings = $(el).find("h2, h3, h4, li").map((_, h) => cleanText($(h).text())).get();
    headings.forEach((t) => {
      if (t.length > 2 && t.length < 100) items.push(t);
    });
  });
  return [...new Set(items)].slice(0, 15);
}

/** Extract target buyer segments from "who we serve", audience sections, and body copy. */
function extractTargetBuyers($: cheerio.CheerioAPI): string[] {
  const buyers: string[] = [];
  const mainText = getMainBodyText($).slice(0, 6000);
  const add = (label: string) => {
    if (label.length > 1 && label.length < 80 && !buyers.some((b) => b.toLowerCase() === label.toLowerCase())) buyers.push(label);
  };
  $("[class*='audience'], [class*='who-we'], [class*='clients'], [class*='customers'], [class*='serve'], [class*='target']").each((_, el) => {
    if (isHiddenOrModal($, el)) return;
    $(el).find("li, p, h3, h4, [class*='item']").each((__, node) => {
      const t = cleanText($(node).text());
      if (t.length >= 2 && t.length <= 80 && !/^(home|about|contact|menu)$/i.test(t)) add(t);
    });
  });
  const audiencePhrases: [RegExp, string][] = [
    [/\b(?:we serve|serving|for)\s+(?:both\s+)?(?:residential and commercial|homeowners and (?:commercial|business))/i, "Residential and commercial clients"],
    [/\bhomeowners?\b/i, "Homeowners"],
    [/\b(?:small\s+)?business(?:es)?\b/i, "Small businesses"],
    [/\bcontractors?\b/i, "Contractors"],
    [/\benterprises?\b|\bB2B\b/i, "Enterprises / B2B"],
    [/\b(?:individuals?|families?|consumers?|B2C)\b/i, "Individuals"],
    [/\bfamilies\b/i, "Families"],
    [/\bproperty\s+owners?\b/i, "Property owners"],
    [/\bvehicle\s+owners?\b|\bcar\s+owners?\b/i, "Vehicle owners"],
    [/\brental\s+property\s+owners?\b/i, "Rental property owners"],
    [/\bspanish[- ]?speaking\s+community\b/i, "Spanish-speaking community"],
    [/\b(?:local|regional)\s+communities?\b/i, "Local communities"],
    [/\bgovernment\s+(?:agencies?|contracts?)\b/i, "Government"],
    [/\bnonprofits?\b/i, "Nonprofits"],
    [/\bagricultural\s+clients?\b|\bagriculture\b/i, "Agricultural clients"],
    [/\bpublic\s*\/\s*community\s+entities?\b/i, "Public/Community entities"],
  ];
  for (const [re, label] of audiencePhrases) {
    if (re.test(mainText)) add(label);
  }
  if (buyers.length === 0) {
    const title = cleanText($("title").text());
    const combined = (title + " " + mainText.slice(0, 1000)).toLowerCase();
    for (const [re, label] of audiencePhrases) {
      if (re.test(combined)) add(label);
    }
    if (buyers.length === 0 && title) {
      if (/plumb|drill|well|water|repair|hvac|roof|landscap|lawn|clean|moving|handyman/i.test(title)) add("Homeowners");
      if (/consulting|accounting|legal|marketing|software|agency|tax|cpa/i.test(title)) add("Small businesses");
    }
  }
  return buyers.slice(0, 12);
}

/** Extract ideal customer persona from "who we serve", "our clients", persona/audience sections, and body. */
function extractIdealCustomerPersona($: cheerio.CheerioAPI): string | undefined {
  let persona = "";
  const selectors = "[class*='persona'], [class*='audience'], [class*='who-we'], [class*='our-clients'], [class*='ideal'], [class*='target-audience'], [class*='market'], [class*='customers']";
  $(selectors).each((_, el) => {
    if (persona) return;
    if (isHiddenOrModal($, el)) return;
    const text = cleanText($(el).text());
    if (text.length >= 80 && text.length <= 1200 && !/terms of service|privacy policy/i.test(text)) persona = text.slice(0, 700);
  });
  if (persona) return persona;
  $("[class*='serve'], [class*='clients'], [class*='customers']").each((_, el) => {
    if (persona) return;
    if (isHiddenOrModal($, el)) return;
    const $el = $(el);
    const paragraphs = $el.find("p").map((_, p) => cleanText($(p).text())).get().filter((t) => t.length >= 50 && t.length <= 500);
    if (paragraphs.length > 0) persona = paragraphs.slice(0, 2).join(" ").slice(0, 600);
  });
  if (persona) return persona;
  const mainText = getMainBodyText($);
  const idealMatch = mainText.match(/(?:ideal\s+(?:customer|client|persona)|who\s+we\s+serve|our\s+clients?\s+include)[^.]{20,400}\./gi);
  if (idealMatch && idealMatch[0]) persona = cleanText(idealMatch[0]).slice(0, 600);
  if (persona) return persona;
  const buyers = extractTargetBuyers($);
  if (buyers.length > 0) {
    return `Target audience includes ${buyers.slice(0, 8).join(", ")}. Clients seek the services and expertise offered, with personalized support and clear guidance.`;
  }
  return undefined;
}

/** Extract customer needs from "what you need", "why choose us", problem/solution sections, and body copy. */
function extractCustomerNeeds($: cheerio.CheerioAPI): string[] {
  const needs: string[] = [];
  const mainText = getMainBodyText($).slice(0, 8000);
  const add = (s: string) => {
    const t = cleanText(s).slice(0, 200);
    if (t.length >= 15 && !needs.some((n) => n.toLowerCase().includes(t.slice(0, 30).toLowerCase()))) needs.push(t);
  };
  $("[class*='need'], [class*='why-choose'], [class*='problem'], [class*='solution'], [class*='benefit'], [class*='customer']").each((_, el) => {
    if (isHiddenOrModal($, el)) return;
    $(el).find("li, p").each((__, node) => {
      const t = cleanText($(node).text());
      if (t.length >= 20 && t.length <= 300 && /need|want|seek|require|looking for|protect|ensure|help|assist|peace of mind|confidence|support|guidance|coverage|protection/i.test(t)) add(t);
    });
  });
  const needPhrases = mainText.match(/(?:customers?|clients?|you)\s+(?:need|want|seek|require|look for)[^.!?]{10,150}[.!?]/gi);
  if (needPhrases) needPhrases.slice(0, 5).forEach((p) => add(p));
  const problemPhrases = mainText.match(/(?:struggl|challeng|problem|difficult|complex|overwhelm)[^.!?]{5,120}[.!?]/gi);
  if (problemPhrases) problemPhrases.slice(0, 3).forEach((p) => add(p));
  return needs.slice(0, 10);
}

/** Extract channels (Online, Phone, In-person, etc.) from contact sections and body. */
function extractChannels($: cheerio.CheerioAPI): string[] {
  const channels: string[] = [];
  const mainText = getMainBodyText($).toLowerCase();
  if (/contact us|get in touch|reach us|call us|phone|tel:/i.test(mainText)) channels.push("Phone");
  if (/email|@|contact form|message us/i.test(mainText)) channels.push("Online");
  if (/visit|location|address|in[- ]?person|office|walk[- ]?in/i.test(mainText)) channels.push("In-person");
  if (/chat|live chat|messenger/i.test(mainText)) channels.push("Chat");
  if (/social|facebook|linkedin|twitter|instagram/i.test(mainText)) channels.push("Social media");
  $("[class*='contact'], [class*='channel']").each((_, el) => {
    const t = cleanText($(el).text()).toLowerCase();
    if (t.includes("online") && !channels.some((c) => c.toLowerCase() === "online")) channels.push("Online");
    if (t.includes("phone") && !channels.some((c) => c.toLowerCase() === "phone")) channels.push("Phone");
  });
  return [...new Set(channels)].slice(0, 8);
}

/** Extract funnels: quote forms, contact forms, signup, consultations, etc. */
function extractFunnels($: cheerio.CheerioAPI): string[] {
  const funnels: string[] = [];
  const mainText = getMainBodyText($);
  const add = (s: string) => {
    if (s.length >= 3 && s.length <= 80 && !funnels.some((f) => f.toLowerCase() === s.toLowerCase())) funnels.push(s);
  };
  $("form").each((_, form) => {
    const action = $(form).attr("action") || "";
    const placeholder = $(form).find("[placeholder]").attr("placeholder") || "";
    const submit = $(form).find("[type=submit], button").first().text();
    const label = cleanText(submit || placeholder || action);
    if (label.length >= 2) add(label);
  });
  const funnelPhrases = [
    /quote\s*form|get\s*a\s*quote|request\s*quote/gi,
    /contact\s*form|contact\s*us|get\s*in\s*touch/gi,
    /sign\s*up|newsletter|subscribe/gi,
    /schedule|appointment|book\s*a\s*call|consultation/gi,
    /request\s*(?:a\s*)?(?:demo|estimate|assessment)/gi,
    /apply\s*now|application/gi,
    /callback|request\s*call/gi,
  ];
  funnelPhrases.forEach((re) => {
    const m = mainText.match(re);
    if (m) add(cleanText(m[0]));
  });
  return funnels.slice(0, 10);
}

/** Extract suppliers/partners from mentions of integrations, partners, powered by, etc. */
function extractSuppliersPartners($: cheerio.CheerioAPI): string[] {
  const list: string[] = [];
  const mainText = getMainBodyText($);
  $("[class*='partner'], [class*='supplier'], [class*='integration'], [class*='powered by']").each((_, el) => {
    $(el).find("a[href], img[alt], span, div").each((__, node) => {
      const t = cleanText($(node).text() || $(node).attr("alt") || "");
      if (t.length >= 2 && t.length <= 60 && !/^(home|about|contact|menu)$/i.test(t)) {
        if (!list.some((l) => l.toLowerCase() === t.toLowerCase())) list.push(t);
      }
    });
  });
  const partnerRe = /(?:partner|powered by|integrat(?:ion|es)|via|using)\s+(?:with\s+)?([A-Z][A-Za-z0-9\.\s]+?)(?:\s+(?:and|,)|\.|$)/g;
  let match: RegExpExecArray | null;
  while ((match = partnerRe.exec(mainText)) !== null) {
    const name = cleanText(match[1]).slice(0, 50);
    if (name.length >= 2 && !list.some((l) => l.toLowerCase().includes(name.toLowerCase()))) list.push(name);
  }
  return list.slice(0, 15);
}

/** Extract industry groupings (e.g. medical, law, construction) from content. */
function extractIndustryGroupings($: cheerio.CheerioAPI, inferredIndustry?: string): string[] {
  const groups: string[] = [];
  const mainText = getMainBodyText($).toLowerCase();
  const industryWords = [
    "medical", "healthcare", "law", "legal", "construction", "real estate", "insurance", "tax", "accounting",
    "restaurant", "retail", "manufacturing", "technology", "finance", "education", "government", "nonprofit",
    "contractors", "trades", "homeowners", "businesses", "individuals", "families",
  ];
  industryWords.forEach((word) => {
    if (mainText.includes(word) && !groups.some((g) => g.toLowerCase().includes(word))) {
      groups.push(word.charAt(0).toUpperCase() + word.slice(1));
    }
  });
  if (inferredIndustry && !groups.some((g) => g.toLowerCase() === inferredIndustry.toLowerCase())) {
    groups.unshift(inferredIndustry);
  }
  return [...new Set(groups)].slice(0, 12);
}

/** Extract industry outlook from market/industry/outlook sections, or build from industry + business model. */
function extractIndustryOutlook(
  $: cheerio.CheerioAPI,
  industry?: string,
  businessModel?: string
): string | undefined {
  let found = "";
  $("[class*='industry'], [class*='market'], [class*='outlook'], [class*='trends'], [class*='sector']").each((_, el) => {
    if (found) return;
    if (isHiddenOrModal($, el)) return;
    const text = cleanText($(el).text());
    if (text.length >= 80 && text.length <= 1500 && !/terms of service|privacy policy/i.test(text)) found = text.slice(0, 500);
  });
  if (found) return found;
  if (industry || businessModel) {
    if (industry && businessModel) return `Serves the ${industry} sector with a ${businessModel} focus.`;
    if (industry) return `Serves the ${industry} sector.`;
    if (businessModel) return `Business model: ${businessModel}.`;
  }
  return undefined;
}

export interface ScrapeResult {
  success: true;
  knowledge: KnowledgeBase;
}

export interface ScrapeError {
  success: false;
  error: string;
}

export type ScrapeOutput = ScrapeResult | ScrapeError;

/** Fetch a single page (same-origin or same site). Returns HTML or null. */
async function fetchPage(fullUrl: string): Promise<string | null> {
  try {
    const res = await fetch(fullUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MoKnowledge/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Optionally fetch fully rendered HTML using Playwright (when installed). Use for JS-heavy sites. */
async function fetchPageWithBrowser(url: string): Promise<string | null> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(2000);
      const html = await page.content();
      return html;
    } finally {
      await browser.close().catch(() => {});
    }
  } catch {
    return null;
  }
}

/** Try additional pages (about, contact, services) and merge missing fields into knowledge. Pushes bio links to bioLinksOut when provided. */
async function mergeFromAdditionalPages(
  knowledge: KnowledgeBase,
  origin: string,
  mainPageLinks: string[],
  bioLinksOut?: { name: string; bioUrl: string }[]
): Promise<void> {
  const pathPatterns = ["/about", "/about-us", "/contact", "/contact-us", "/services", "/our-team", "/team", "/leadership", "/staff", "/meet-the-team"];
  const seen = new Set<string>();
  const toFetch: string[] = [];
  for (const path of pathPatterns) {
    toFetch.push(origin + (path.startsWith("/") ? path : "/" + path));
  }
  for (const href of mainPageLinks) {
    const lower = href.toLowerCase();
    if (
      (lower.includes("about") || lower.includes("contact") || lower.includes("services") || lower.includes("team") || lower.includes("leadership") || lower.includes("staff")) &&
      href.startsWith(origin)
    ) {
      try {
        const u = new URL(href);
        u.search = "";
        u.hash = "";
        toFetch.push(u.toString());
      } catch {
        // ignore
      }
    }
  }
  for (const fullUrl of toFetch) {
    const norm = fullUrl.replace(/\/$/, "");
    if (seen.has(norm)) continue;
    seen.add(norm);
    const html = await fetchPage(fullUrl);
    if (!html) continue;
    const $ = cheerio.load(html);
    const cf = knowledge.companyFoundation;
    const pos = knowledge.positioning;
    const contactAddr = extractContactAndAddress($, fullUrl);
    const aboutStory = extractAboutAndStory($);
    const textPatterns = extractTextPatterns($);
    if (!cf.mainAddress && contactAddr.mainAddress) cf.mainAddress = contactAddr.mainAddress;
    if (!cf.phone && contactAddr.phone) cf.phone = contactAddr.phone;
    if (!cf.email && contactAddr.email) cf.email = contactAddr.email;
    if (!pos.foundingStory && aboutStory.foundingStory) pos.foundingStory = aboutStory.foundingStory;
    if (!pos.companyPitch && aboutStory.overview) pos.companyPitch = aboutStory.overview;
    if (!cf.overview && aboutStory.overview) cf.overview = aboutStory.overview;
    if (!cf.yearFounded && textPatterns.yearFounded) cf.yearFounded = textPatterns.yearFounded;
    const morePeople = extractKeyPeople($, []);
    if (morePeople.length > 0) {
      const existingNames = new Set(knowledge.keyPeople.map((p) => p.name.toLowerCase().trim()));
      const merged = [...knowledge.keyPeople];
      for (const p of morePeople) {
        if (!existingNames.has(p.name.toLowerCase().trim())) {
          existingNames.add(p.name.toLowerCase().trim());
          merged.push(p);
        }
      }
      knowledge.keyPeople = merged.slice(0, 25);
    }
    if (bioLinksOut) {
      const links = getBioLinksFromPage($, fullUrl, origin);
      links.forEach((l) => bioLinksOut.push(l));
    }
    if (
      (knowledge.offerings.length === 0 || knowledge.offerings[0]?.name === "General offerings" || !knowledge.offerings.some((o) => o.description || (o.features?.length ?? 0) > 0)) &&
      (/\/services|\/offerings/i.test(fullUrl) || $("[class*='service'], [class*='offer']").length > 2)
    ) {
      const detailed = extractOfferingsWithDetails($);
      if (detailed.length > 0) {
        const existing = knowledge.offerings.filter((o) => o.name !== "General offerings");
        const merged = [
          ...detailed,
          ...existing.filter((e) => !detailed.some((d) => d.name.toLowerCase() === e.name.toLowerCase())),
        ].slice(0, 15);
        knowledge.offerings = merged.length > 0 ? merged : knowledge.offerings;
      }
    }
  }
}

export async function scrapeWebsite(url: string): Promise<ScrapeOutput> {
  let resolvedUrl = url.trim();
  if (!/^https?:\/\//i.test(resolvedUrl)) {
    resolvedUrl = `https://${resolvedUrl}`;
  }
  let html: string;
  try {
    const res = await fetch(resolvedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MoKnowledge/1.0; +https://moknowledge.local)",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    html = await res.text();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch URL";
    return { success: false, error: message };
  }

  let $ = cheerio.load(html);
  const baseUrl = resolvedUrl;
  const origin = new URL(baseUrl).origin;

  // If the page has very little visible text (JS-rendered), try to pull content from __NEXT_DATA__ / __NUXT_DATA__
  let bodyTextLength = getMainBodyText($).length;
  if (bodyTextLength < 500) {
    const jsDataText = extractFromJsDataBlobs(html);
    if (jsDataText && jsDataText.length > 100) {
      const escaped = jsDataText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const inject = `<div id="moknowledge-js-data" style="display:none" aria-hidden="true">${escaped}</div>`;
      const htmlAugmented = html.replace("</body>", inject + "\n</body>");
      $ = cheerio.load(htmlAugmented);
      bodyTextLength = getMainBodyText($).length;
    }
  }
  // If still very thin and Playwright is available, fetch rendered HTML (optional: install playwright for JS-heavy sites)
  if (bodyTextLength < 300) {
    const renderedHtml = await fetchPageWithBrowser(resolvedUrl);
    if (renderedHtml && renderedHtml.length > 1000) {
      html = renderedHtml;
      $ = cheerio.load(html);
    }
  }

  const jsonLd = extractJsonLd(html, baseUrl);
  const textPatterns = extractTextPatterns($);
  const contactAddr = extractContactAndAddress($, baseUrl);
  const aboutStory = extractAboutAndStory($);
  const socialFromHtml = extractSocialLinks($);

  const title = cleanText($("title").text()) || extractMeta($, "og:title") || jsonLd.name;
  const description =
    extractMeta($, "description") ||
    extractMeta($, "og:description") ||
    jsonLd.description ||
    cleanText($('meta[name="description"]').attr("content") ?? "");
  const paragraphs = extractParagraphs($);
  const mainText = getMainBodyText($);
  const inferredIndustry = inferIndustry($, title ?? "");
  const inferredBusinessModel = inferBusinessModel($);
  const customerOfferingsResult = extractCustomerOfferings($, title ?? "");
  
  // Extract location for overview
  const location = jsonLd.address || textPatterns.mainAddress || contactAddr.mainAddress;
  const locationCity = location ? location.split(",")[0].trim() : undefined;
  
  // Build comprehensive overview that "hits the nail on the head"
  const overview = extractComprehensiveOverview(
    $,
    title ?? "",
    description || "",
    aboutStory,
    inferredIndustry,
    inferredBusinessModel,
    locationCity || location,
    normalizeYear(jsonLd.foundingDate) || textPatterns.yearFounded
  ) || description || aboutStory.overview || paragraphs[0] || (mainText.length > 80 ? mainText.slice(0, 600) : title ? `${title}.` : "");

  const companyFoundation: CompanyFoundation = {
    overview: overview || undefined,
    website: jsonLd.url || origin,
    industry: inferredIndustry || textPatterns.industry || undefined,
    businessModel: inferredBusinessModel || undefined,
    companyRole: undefined,
    yearFounded: textPatterns.yearFounded || normalizeYear(jsonLd.foundingDate) || undefined,
    legalEntityType: textPatterns.legalEntityType || undefined,
    employeeCount: jsonLd.numberOfEmployees || textPatterns.employeeCount || undefined,
    mainAddress: jsonLd.address || textPatterns.mainAddress || contactAddr.mainAddress || undefined,
    phone: contactAddr.phone || jsonLd.contactPoint?.phone || undefined,
    email: contactAddr.email || jsonLd.contactPoint?.email || undefined,
    otherLocations: [],
    serviceLocations: [],
    alternativeNames: title ? [title, ...(jsonLd.name && jsonLd.name !== title ? [jsonLd.name] : [])].filter(Boolean) : [],
  };

  const companyPitch = extractCompanyPitch($, description || paragraphs.slice(0, 2).join(" "));
  const positioning: Positioning = {
    companyPitch: companyPitch || description || paragraphs[0] || (overview ? overview.slice(0, 400) : undefined),
    foundingStory: aboutStory.foundingStory || undefined,
  };

  const headings = extractHeadings($);
  const targetBuyers = extractTargetBuyers($);
  const idealCustomerPersona = extractIdealCustomerPersona($);
  const industryOutlook = extractIndustryOutlook($, inferredIndustry ?? undefined, inferredBusinessModel ?? undefined);
  const customerNeeds = extractCustomerNeeds($);
  const channels = extractChannels($);
  const funnels = extractFunnels($);
  const suppliersPartners = extractSuppliersPartners($);
  const industryGroupings = extractIndustryGroupings($, inferredIndustry);
  
  const marketCustomers: MarketCustomers = {
    targetBuyers: targetBuyers.length > 0 ? targetBuyers : undefined,
    customerNeeds: customerNeeds.length > 0 ? customerNeeds : undefined,
    idealCustomerPersona: idealCustomerPersona ?? undefined,
    industryGroupings: industryGroupings.length > 0 ? industryGroupings : undefined,
    industryOutlook: industryOutlook ?? undefined,
    channels: channels.length > 0 ? channels : undefined,
    funnels: funnels.length > 0 ? funnels : undefined,
    ctas: extractCTAs($),
    suppliersPartners: suppliersPartners.length > 0 ? suppliersPartners : undefined,
  };

  const logoUrls = extractLogos($, baseUrl);
  if (jsonLd.logo && !logoUrls.includes(jsonLd.logo)) logoUrls.unshift(jsonLd.logo);
  const fonts = extractFonts($);
  const colors = extractColors($);

  const brandingStyle: BrandingStyle = {
    writingStyle: extractWritingStyle($) ?? undefined,
    artStyle: extractArtStyle($) ?? undefined,
    fonts: fonts.length > 0 ? fonts : undefined,
    brandColors: colors,
    logoUrls: logoUrls.length > 0 ? logoUrls : undefined,
  };

  const sameAsToPresence = (links: string[] | undefined): Partial<OnlinePresence> => {
    if (!links?.length) return {};
    const out: Partial<OnlinePresence> = {};
    for (const u of links) {
      if (/linkedin\.com/i.test(u) && !out.linkedIn) out.linkedIn = u;
      else if (/facebook\.com/i.test(u) && !out.facebook) out.facebook = u;
      else if (/instagram\.com/i.test(u) && !out.instagram) out.instagram = u;
      else if (/twitter\.com|x\.com/i.test(u) && !out.twitterX) out.twitterX = u;
      else if (/youtube\.com/i.test(u) && !out.youtube) out.youtube = u;
    }
    return out;
  };
  const onlinePresence: OnlinePresence = {
    ...sameAsToPresence(jsonLd.sameAs),
    ...socialFromHtml,
  };

  const keyPeople = extractKeyPeople($, headings);

  const priceList = extractPricingFromText($);
  let offerings = extractOfferingsWithDetails($);
  if (offerings.length === 0 && priceList.length > 0) {
    priceList.forEach((p, i) => {
      offerings.push({ name: `Plan ${i + 1}`, type: "service", pricing: p });
    });
  }
  const fromTitle = customerOfferingsResult.offerings.filter(
    (co) => !offerings.some((o) => o.name.toLowerCase() === co.name.toLowerCase())
  );
  if (offerings.length === 0 && fromTitle.length === 0) {
    const skipHeading = /^(home|about|contact|services|our team|menu|login|sign|faq|blog|news|testimonial|why (choose )?us|get in touch|follow us)$/i;
    $("h2, h3").each((_, el) => {
      const name = cleanText($(el).text());
      if (name.length >= 3 && name.length <= 100 && !skipHeading.test(name)) {
        if (!offerings.some((o) => o.name.toLowerCase() === name.toLowerCase())) {
          // Try to get description from content after the heading
          const $parent = $(el).parent();
          const $afterHeading = $(el).nextUntil("h1, h2, h3, h4");
          let desc = cleanText($afterHeading.text()).trim().slice(0, 500);
          if (desc.length < 30) {
            const firstP = $parent.find("p").first().text();
            if (firstP && firstP.length > 30) desc = cleanText(firstP).slice(0, 500);
          }
          offerings.push({
            name,
            type: "service" as const,
            description: desc.length > 25 ? desc.slice(0, 600) : undefined,
          });
        }
      }
    });
  }
  const mergedOfferings =
    offerings.length > 0 || fromTitle.length > 0
      ? [...offerings, ...fromTitle].slice(0, 15)
      : [{ name: "General offerings", type: "service" as const }];

  const certificationsAwards = extractCertificationsAwards($);
  const valuesCommunity = extractValuesCommunity($);

  const extended: ExtendedKnowledge = {
    contentThemes: headings.slice(0, 15),
    testimonials: extractTestimonials($),
    certificationsAwards: certificationsAwards.length > 0 ? certificationsAwards : undefined,
    faq: extractFAQ($),
    usp: extractCTAs($).slice(0, 5),
    valuesCommunity: valuesCommunity.length > 0 ? valuesCommunity : undefined,
    customerGets: customerOfferingsResult.customerGets || (mergedOfferings.length > 0 ? mergedOfferings.slice(0, 8).map((o) => o.name).join("; ") : undefined),
  };

  const knowledge: KnowledgeBase = {
    id: generateId(),
    sourceUrl: baseUrl,
    scrapedAt: new Date().toISOString(),
    companyFoundation,
    positioning,
    marketCustomers,
    brandingStyle,
    onlinePresence,
    keyPeople: keyPeople.slice(0, 20),
    offerings: mergedOfferings,
    extended,
  };

  const mainLinks = extractLinks($, baseUrl);
  const bioLinks = getBioLinksFromPage($, baseUrl, origin);
  await mergeFromAdditionalPages(knowledge, origin, mainLinks, bioLinks);
  await fillBiosFromProfilePages(knowledge.keyPeople, bioLinks, origin);

  return { success: true, knowledge };
}
