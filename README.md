# Matt Beard portfolio and blog

A static homepage and Markdown blog. Authors edit Markdown and local images;
Node.js generates HTML for preview and deployment. The published site uses
HTML and CSS with optional consent-based analytics JavaScript, and no database,
API or CMS server.

## Structure

- `content/blog/<date>/index.md`: article source with YAML metadata.
- `content/blog/<date>/images/`: that article's screenshots, GIFs and other images.
- `content/blog-history.json`: imported-post provenance, legacy URLs, original
  RSS identifiers, media checksums and content regression fingerprints.
- `site/`: static source files, including the homepage, shared blog CSS,
  favicon, custom 404 and base Azure configuration.
- `site/assets/`: locally hosted official community-event logos.
- `scripts/blog-content.mjs`: Markdown loading, metadata validation and HTML rendering.
- `scripts/build-blog.mjs`: static site generation and local-link validation.
- `scripts/serve.mjs`: local preview with redirects, headers and the custom 404.
- `dist/`: generated deployment files. Ignored by Git; never edit these by hand.
- `tests/`: source validation, publishing workflow and migration regression tests.
- `.github/agents/blog-author.agent.md`: the Blog author agent.

The site uses Google Fonts with system fallbacks. Cookie-free page-load counting
runs until a visitor rejects analytics. The Application Insights SDK loads only
after consent on `https://www.mbeard.co.uk` or localhost. It counts page views,
visitors and sessions with approximate geographic breakdowns.
Old design mocks remain in the ignored `mocks/` folder.

### Community-event branding

The cards retain the organiser roles and use the events' official logos without
recolouring them. Assets are hosted locally, so viewing the page does not send
image requests to the event websites.

- Scottish Summit: [official logo](https://scottishsummit.com/_next/static/image/src/images/logo.994c8c82e41624859d6b2693fffcf483.svg),
  with navy `#29235c` and pink `#e31673` from the official site's palette.
- D365PPUG: [official white logo](https://www.d365ppug.com/wp-content/uploads/2022/01/D365PPUG-Generic-logo-initials-white.png),
  with navy `#24385e` and purple `#742774` from the official site's palette.
  The same group branding is used for Manchester and London, with separate links.

## Local preview

Install Node.js 24 or newer, then run:

```powershell
npm ci
npm start
```

Open `http://localhost:4280` or `http://localhost:4280/blog/`.
`npm start` builds the site and serves `dist/`. Stop with Ctrl+C.
After editing content, run `npm run build` and refresh. The preview is not a
watch server. Restart it if you change redirect configuration.

```powershell
npm run build
npm test
```

`npm test` builds before running all checks. `npm run blog:build` remains an
alias for the build command. Generation needs no access to the retired blog.

## Blog

The index shows the two latest published posts, followed by the year-grouped
"More from the blog" archive. Topic pages and an RSS feed are generated too.
All 33 imported articles retain their dates, wording, code and local images.
Native posts do not display the imported articles' historical-software notice.

### Writing a post

Create a folder such as `content/blog/2026-10-22/` and add `index.md`:

````markdown
---
title: A practical Dataverse example
published: "2026-10-22T12:00:00Z"
description: An outline covering setup, examples and results.
tags:
  - Dataverse
category: Power Platform
draft: false
illustration: none
---

This outline describes the example to build.

## Setup

Describe the environment and prerequisites.

## Example

```js
const answer = 42;
```

![An example screenshot](images/example.png)

## Results

Record the outcome.
````

Only include an image link after saving the image in the adjacent `images/`
folder. Local image links and links to full-size images use that same folder.
Shared images have a separate copy per article.

Required metadata:

- `title` and `description` are plain text.
- `published` is a UTC timestamp ending in `Z` and matches the folder date.
- `tags` is a list of topic names, or `[]`. Reuse existing spelling and case.
- `draft` is a boolean. `false` includes the post immediately, including future
  dates. `true` excludes its page, images, index entries, topic entries and RSS
  item. There is no scheduled publishing.

Optional `category` defaults to "From the blog". Optional `illustration` accepts
`validation`, `retention` or `none` and controls the text-free featured image.
Omitting it uses `none`.

The folder determines the permanent URL, such as `/blog/2026-10-22/`.
For another post on the same day, use `2026-10-22-2`, then `2026-10-22-3`.
Existing folder names stay fixed; reordering posts does not rename them.
The generator sorts by publication timestamp. Keep both source folders when
publishing multiple posts on one day.

Markdown supports headings, lists, links, images, fenced code and tables.
Use `##` for article sections because the template supplies the page's `h1`.
Write links explicitly as `[text](URL)` or `<URL>`. Some imported captions and
code retain inline HTML to preserve their original formatting and exact whitespace.
Unsupported embeds, scripts, invalid metadata, missing images and broken local
links fail the build.

### Using the Blog author agent

Select **Blog author** in VS Code Chat's agent selector. For example:

```text
Create a post structure about Dataverse data quality dated 2026-10-22,
with sections for setup, examples and results. Update the blog list too.
```

The agent creates Markdown, regenerates the list and runs checks. New outlines
appear in the local blog immediately and are labelled as outlines in their
descriptions. Ask for a draft to keep one unpublished.
The agent does not commit, push or deploy unless asked.

### Imported history

`content/blog-history.json` is migration metadata, not another article store.
It contains no editable article bodies. Native posts need no history entry.
The original RSS identifiers remain stable so subscribers do not receive the
imported archive as new posts.

The 140 distinct imported images have 141 article-owned copies because one image
appears in two posts. One LinkedIn image in "The learning never stops" returns
HTTP 403; its article retains a visible notice and original source link.
WordPress comments, drafts, themes and plugins were not migrated.
The import scripts and old JSON article store have been removed.

Regression tests preserve the imported article text, exact code and media
checksums. If you intentionally revise an imported article, review and update
only its corresponding history fingerprints. Native articles have normal
structure and publishing tests without fixed content fingerprints.

## Build and deployment

Commit Markdown, source images, templates, styles and the package lockfile.
Do not commit generated HTML. The build replaces only `dist/`, copies static
files, renders published Markdown, copies article images and generates archives,
RSS and redirects. It checks local links and article anchors before succeeding.

Both GitHub workflows install dependencies using `npm ci` and run `npm test`.
The Azure workflow then uploads `dist/` with Azure build detection disabled.
The validation workflow does not deploy. Pull requests use Azure preview
environments; pushes to `main` deploy to production.

For a new Azure Static Web App connection:

- Use the `mattybeard/mbeardcouk` repository and `main` branch.
- Use a Custom build preset. Generate `dist/` with Node.js 24 and `npm test`
  in the workflow before upload.
- Set the deploy action's `app_location` to `./dist`, `api_location` and
  `output_location` to empty strings, and `skip_app_build` to `true`.
- Keep Azure credentials in GitHub secrets, not source files.

The existing Azure workflow already applies these settings. Canonical and RSS
URLs use `https://mbeard.co.uk`. Configure the domain and HTTPS through the
Azure resource's Custom domains page.

### Redirects and old-domain cutover

The base hosting configuration lives in `site/staticwebapp.config.json`.
The generated version in `dist/` adds redirects for all original dated article
paths, previous post-name URLs, old topic paths, feed paths and the prototype URL.
Both variants of an old article path, with and without its trailing slash, lead
directly to the date-based page. Unknown paths remain genuine 404 responses.
Azure treats route paths with and without a trailing slash as equivalent.
The generator emits one rule per path, rejects equivalent duplicate routes and
self-redirects, and the local preview uses the same trailing-slash matching.

Configure the old domain separately when ready:

- Send `https://blog.mbeard.co.uk/` to `https://mbeard.co.uk/blog/`.
- Send other old-domain paths to the same path on `https://mbeard.co.uk`,
  preserving their path and query string. The generated article redirects then
  send old dated paths to `/blog/yyyy-MM-dd/`.

Deploy and check the main-domain pages before switching the old host.
Redirecting every article to the index would discard article links.
Old `/wp-content/uploads/` paths are no longer published or redirected;
all migrated articles link to their own `/blog/<date>/images/` files.

Security headers permit local scripts, the Microsoft analytics CDN, the configured
East US 2 ingestion endpoint, and Google Fonts styles and fonts. Embeds remain
blocked. Change the policy deliberately if the site later needs other resources.

### Visitor analytics

`site/analytics.js` uses the public browser connection string for Application
Insights. It is not an Azure management credential. No backend is needed.
`site/privacy.html` describes collection and consent. The blog page template in
`scripts/build-blog.mjs` includes the same tracking and consent controls.

- `www.mbeard.co.uk` over HTTPS and localhost support basic counting and
  consent-based visitor analytics. Azure
  preview hostnames and the apex domain do not load the SDK. Canonical blog URLs
  still use the apex domain, so visits there are excluded as requested.
- Before a choice, a direct request sends one `BasicPageView` custom event per
  page load without loading the SDK. It contains only the time, event name and
  hostname, with `ai.location.ip` set to `0.0.0.0` to avoid geographic lookup.
  Requests omit credentials and referrers. No visitor/session identifiers, page
  paths or device details are included in the event. Azure still receives network
  IP and HTTP request information, so do not describe collection as fully anonymous.
  Confirm the stored event has no geographic fields when checking Azure ingestion.
  Cookie-free counting is not automatically exempt from applicable consent rules.
- Reject stops basic counting as well as consent-based analytics, including on
  future page loads until the choice expires. An in-flight basic request is
  cancelled where possible, but counts already received cannot be undone. Storage
  errors disable basic counting until a preference can be read or saved.
- Basic events also count accepted visits. Acceptance on the same page does not
  send a second basic event. Do not add `BasicPageView` counts to `pageViews`;
  accepted visits occur in both datasets.
- Localhost, `127.0.0.1` and IPv6 loopback use the real consent and tracking flow.
  Local counts and accepted visits appear in the same Application Insights resource
  as production visits. Filter basic events by hostname and page views by URL.
  Run `npm start` and open
  `http://localhost:4280`. Follow the footer's **Privacy** link and use
  **Analytics settings** on the privacy page to reopen the
  prompt after choosing. To test a fresh visit, run
  `localStorage.removeItem('analytics-consent-v1'); location.reload();` in the
  browser console. Choices are separate for each browser origin.
- Accept and reject have equal controls. The choice lasts 180 days in local
  storage. Analytics settings lets visitors change it. Withdrawing consent
  deletes host-only `ai_user` and `ai_session` cookies and reloads without flushing
  queued telemetry. Other tabs also stop when the preference changes.
  Dismissing the prompt moves keyboard focus to Analytics settings on the privacy
  page, or to a Privacy link on other pages, without scrolling.
- Only page-view telemetry is retained by the client initializer. Query strings,
  fragments and referrers are excluded. Automatic exception, request and route
  tracking are disabled. The SDK does not persist telemetry buffers in browser
  storage. Anchor navigation does not count as another page view.
- Counts describe consenting browsers, not all visitors or distinct people.
  Blockers and deleted cookies affect the totals. Geographic estimates use IP
  lookup and can be wrong, especially with VPNs.

Before deploying, confirm the linked workspace's data location and retention in
Azure and update the privacy notice if needed. The supplied ingestion endpoint
is in East US 2. Keep default IP masking enabled. Set a budget alert and review
the Application Insights and workspace ingestion limits. Those settings are
managed in Azure, not in this repository.

In the Application Insights resource, open **Logs** and run:

```kusto
customEvents
| where timestamp >= ago(30d) and name == "BasicPageView"
| where tostring(customDimensions.hostname) == "www.mbeard.co.uk"
| summarize PageLoads = count() by bin(timestamp, 1d)
| order by timestamp asc
```

This includes visits without a consent choice and accepted visits, but excludes
visits with a saved rejection. It does not measure unique people. In workspace
Logs use `AppEvents`, `TimeGenerated`, `Name` and `Properties` instead.

For consent-based visitor and geographic reporting:

```kusto
pageViews
| where timestamp >= ago(30d)
| summarize PageViews = count(), Visitors = dcount(user_Id),
    Sessions = dcount(session_Id) by Country = client_CountryOrRegion
| order by PageViews desc
```

Add `client_StateOrProvince` or `client_City` to the grouping for finer geographic
reports. `dcount` is approximate. From the linked workspace's Logs view, use
`AppPageViews` with `TimeGenerated`, `UserId`, `SessionId` and `ClientCountryOrRegion`
instead. The Azure Usage views also provide user and session reports.

After deployment, accept analytics on the production hostname and check the
browser Network panel for a successful `/v2/track` request. Data can take several
minutes to appear in Logs. Reject analytics and confirm that no further telemetry
requests occur and that the analytics cookies disappear. Local tests mock the SDK
and basic ingestion. Browser validation confirmed Azure accepted a localhost
basic event; other browser flow checks intercept ingestion.
