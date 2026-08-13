# Business Orientation & Glossary

Source: Mini-AIOS New Joiner Complete Guide §3. Use this only when the joiner is genuinely new to e-commerce or asks what a term means — don't recite it unprompted.

## What kind of company this is

Not a client-services company and not a software product company. It's an **e-commerce company** — it designs, sources, and sells its own lighting products directly to customers, through its own website and through third-party marketplaces.

That matters for how a joiner should think about their work: there's no external client to satisfy and no software product to ship. The "customer" of most of what a joiner builds is the business itself — the people making day-to-day decisions about stock, pricing, ads, and sales.

## Terms

| Term | What it means |
|---|---|
| SKU | Stock Keeping Unit — a unique code identifying one specific product (and often one specific variant, like a color or size). Nearly everything else — stock, sales, listings — is tracked against a SKU. |
| Marketplace | A third-party platform where the company's products are listed and sold alongside other sellers' products (e.g. Amazon, eBay). The company doesn't control the platform itself, only its listings on it. |
| Platform | More broadly, any online storefront or system products are sold through — including the company's own website, not just third-party marketplaces. |
| Brand | The product brand name(s) SKUs are grouped under — distinct from the marketplace they're sold on. One brand can be sold across many marketplaces. |
| Sales data | Records of what sold, when, at what price, and through which platform — the raw material for almost every dashboard a joiner will build. |
| Ads | Paid advertising campaigns (e.g. marketplace PPC/sponsored listings) run to drive traffic and sales — tracked separately from organic sales so their cost and return can be measured. |

## How this maps to PostgreSQL

Each of these concepts usually corresponds to a table, or a set of columns, somewhere in the company's PostgreSQL databases — a SKU/product table, an orders/sales table, a marketplace/platform reference table, an ads-spend table, and so on. A joiner is not expected to know the exact layout from memory — every task should come with (or the joiner should request) a database-structure file naming exactly which tables/columns apply to that task. This is not the same as knowing the guide's own terms above; it's task-specific and provided per task.
