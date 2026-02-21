# Data Quality and Fallbacks

A lot of small-business sites don't have clean structured data, so the scraper is built to handle missing stuff.

**In the scraper:** For overview we try meta description, then og:description, then the first long paragraph, then the page title. For company name we try og:site_name, title, first h1, then fall back to the domain. Social links only get added if the href matches a known platform—no guessing. Colors and logos come from styles only, no fabrication. For key people and offerings we look for sections with "team", "service", or "product" in the class names.

**If LLM enrichment gets added later:** Required fields shouldn't be fabricated—leave empty or flag for review when unsure. Optional fields can use "Insufficient data" or null when confidence is low. Keep values consistent across related fields where it makes sense.

**Before save:** URL has to be valid and normalized. We expect at least one of overview, company pitch, or alternative names to be non-empty. Empty arrays are fine as long as the structure is valid.
