# Static web quality

1. Use `site.crawl` for returned-HTML technical coverage and `site.page_audit`
   for a focused URL.
2. Report response behavior, metadata, headings, links, canonicals, robots, and
   JSON-LD syntax that AItraffic actually observes.
3. Do not claim Core Web Vitals, accessibility, rendered layout, JavaScript
   behavior, or visual quality from the static crawler.
4. If the user requests those missing surfaces, explain that they require a
   separate browser, Lighthouse, PageSpeed Insights, CrUX, or accessibility
   workflow. Do not invent an AItraffic command that is not registered.
5. Keep those external observations separate from the AItraffic evidence
   envelope unless an explicit connector is available.
