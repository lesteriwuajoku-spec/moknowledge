# MoKnowledge – Knowledge Builder

A web app that scrapes a company website and turns the data into a structured knowledge base for MoFlo Cloud (MoSocial, MoMail, MoBlogs).

## What MoKnowledge Does

- **Scrape & Build:** Enter a company URL, run the scraper, then review and edit the results in sections and save as JSON.
- **View & Manage:** List saved knowledge bases, switch between card/table/detail view, search and filter, view full JSON, delete as needed.

Scraping runs on the server with fetch + Cheerio. There’s no LLM in the app—just example prompts in the codebase for you’d do AI enrichment later.

## Tech Stack

- Next.js 15 (App Router), TypeScript, Tailwind
- State: React context + localStorage
- Scraping: Cheerio for HTML parsing

## Setup and Run

1. `cd moknowledge && npm install`
2. `npm run dev`
3. Open http://localhost:3000 — use Scrape & Build to add a URL and scrape, View & Manage to see saved bases.

## Key Features

- URL input with basic validation and error handling
- Loading state while scraping
- Results grouped by the assignment categories (Company Foundation, Positioning, Market & Customers, Branding & Style, Online Presence, Key People, Offerings, Extended)
- Edit in place before saving
- Save to a local list, export as JSON
- View & Manage: card, table, and detail views; search/filter; delete
- Responsive layout

## Knowledge Base Schema

Full types are in `src/types/knowledge.ts`. Short version:

- **Company Foundation:** overview, website, industry, year founded, locations, alternative names, etc.
- **Positioning:** company pitch, founding story
- **Market & Customers:** target buyers, customer needs, ideal persona, CTAs, channels
- **Branding & Style:** writing style, colors (hex), logo URLs
- **Online Presence:** social links (LinkedIn, Facebook, etc.)
- **Key People:** name, title, role, description
- **Offerings:** products/services with features, pricing, category
- **Extended:** content themes, testimonials, FAQ, USPs

## Scraping and Data Extraction

The scraper (`src/lib/scraper.ts`) fetches the URL (with a timeout and User-Agent), then parses the HTML with Cheerio. It pulls meta tags, headings, paragraphs, links (including social), colors from styles, logo-like images, CTAs, team/service sections, FAQ patterns, and testimonials, and maps it all into the knowledge base structure. No AI is called.

For JS-heavy sites: if the initial HTML has almost no text, it tries to get content from `__NEXT_DATA__` or `__NUXT_DATA__` (Next.js/Nuxt). If it’s still thin and Playwright is installed, it can fetch again with a headless browser and use the rendered HTML. Run `npx playwright install` after npm install to enable that.

## Example Prompts for AI Enrichment

In `src/prompts/enrichment-prompts.ts` there are example prompts for: (1) company pitch from overview + meta, (2) writing style from paragraph/CTA samples, (3) ideal customer from scraped content, (4) filling gaps in partial JSON. More on fallbacks in `docs/DATA_QUALITY_AND_FALLBACKS.md` and other ideas in `docs/ENRICHMENT_IDEAS.md`.

## Database Schema Design

`docs/DATABASE_SCHEMA.md` has the table design (companies, knowledge_bases with versioning, optional knowledge_base_sections), relationships, RLS notes, and a Supabase SQL sketch for the bonus.

## Assumptions and Limitations

- Scraping is server-side so CORS isn’t an issue, but some sites may block or throttle non-browser requests.
- Only the single URL is scraped per run—no sitemap or multi-page crawl.
- No login; knowledge bases are stored in localStorage per browser.
- No LLM in the app; enrichment is just documented as prompts.

## Screenshots

Screenshots for the submission are in the `screenshots/` folder (Scrape & Build and View & Manage).

## Troubleshooting

- **Build fails with readlink / EINVAL (Windows/OneDrive):** Delete the `.next` folder and run `npm run build` again, or build from a path outside OneDrive.
- **Playwright:** Can be removed from devDependencies if it causes issues; the scraper still works without the browser fallback.
- **Site won’t load / browser not running:** The app runs at http://localhost:3000 after `npm run dev`. For Playwright errors, run `npx playwright install` once.

## What’s in the Repo

Source code, this README, `example-knowledge-base.json` (one full scrape; can regenerate via `npm run example:json` or `npm run example:json -- <url>`), `QUESTIONS.txt` with the five answers, and screenshots in `screenshots/`.
