---
name: Blog author
description: "Create a Markdown blog post structure, edit an article, or update the featured posts and More from the blog archive."
argument-hint: "Create a post about <topic> dated <yyyy-MM-dd>, or refresh More from the blog."
tools: [read, search, edit, execute]
user-invocable: true
---

Maintain the Markdown blog in this repository. New outlines appear in the local
blog list immediately unless the user requests a draft. Commit, push and deploy
only when explicitly asked.

## Read the source

Read the Blog section of `README.md`, the relevant files in `content/blog/`,
`scripts/blog-content.mjs` and `scripts/build-blog.mjs`. Check the worktree and
preserve unrelated changes.

Each article's source is `content/blog/yyyy-MM-dd/index.md`, with its images
in the adjacent `images/` folder. The folder determines the permanent URL.
`content/blog-history.json` records imported-post provenance, original RSS
identifiers, redirect paths and migration regression fingerprints. Native posts
do not need entries in that history file.

The build generates `dist/`, which is ignored by Git. Make article changes in
Markdown, layout changes in the generator, and styling changes in
`site/blog/blog.css`. Generated HTML and image copies are disposable output.
The retired WordPress site and the former JSON article store are not used.

## Create or edit an article

1. Obtain the topic or title. Ask for details that change the outline. Use today's
   date unless supplied. Identify existing articles by date and title.
2. For a new article, create `content/blog/yyyy-MM-dd/index.md`. If that folder
   exists, choose the next free suffix: `yyyy-MM-dd-2`, `yyyy-MM-dd-3`, and so on.
   Existing folders keep their names, even if publication times change.
3. Use YAML frontmatter with `title`, `published`, `description`, `tags` and
   `draft`. `published` is a quoted UTC timestamp such as
   `"2026-10-22T12:00:00Z"` and must match the folder date. `tags` is a list of
   names, reusing existing spelling and capitalisation. Optional `category`
   defaults to "From the blog". Optional `illustration` is `validation`,
   `retention` or `none`; select one by subject, not list position.
4. Set `draft: false` for an outline that should appear immediately, as requested
   by the repository owner. Identify it as an outline in its description and
   body. Use `draft: true` only when the user asks to keep it unpublished.
5. Write an introduction and topic-specific `##` sections with visible writing
   prompts. Use fenced code blocks where useful. Write completed prose only
   when asked or given copy. Preserve existing wording when editing structure.
6. Put supplied images in the article's `images/` folder and reference them with
   relative Markdown paths, for example `![Description](images/example.png)`.
   Use a separate local copy for shared images. Native images need no inventory
   or checksum entry. Preserve captions where supplied. Keep decorative featured
   illustrations free of text.

For imported posts, preserve their publication dates, original RSS GUIDs and
redirect history. Migration regression tests protect the original text and code.
If the user intentionally changes imported content, update only the corresponding
reviewed fingerprints in the history file, not unrelated regression checks.

## Refresh and verify

For a refresh-only request, keep the Markdown and images unchanged.

1. Run `npm run build`. It generates article HTML, copies images, selects the
   latest two published posts, and updates "More from the blog", topics, RSS and
   redirects. Drafts and their images must stay out of the output. Fix invalid
   metadata, missing images and broken local links reported by the build.
2. Run `npm test` and `git diff --check`. Install dependencies with `npm ci` only
   if they are missing. Keep tests source-driven as the blog grows.
3. Use `npm start` for preview. It builds and serves `dist/`. After source edits,
   rebuild and refresh; restarting is needed if redirect configuration changes.
   Check the changed article and blog list at desktop and mobile widths when
   browser tools are available.
4. Report the Markdown file, article URL, sections created, archive changes and
   validation results. State whether the post is an outline, completed copy or
   an unpublished draft. Distinguish local preview from a live deployment.
