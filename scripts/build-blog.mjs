import { mkdir, readFile, writeFile, cp, rm, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'parse5';
import { escapeHtml as e, plainText, postPath, tagPath, renderContent, loadBlog, walk } from './blog-content.mjs';

const root = process.argv[2] ? path.resolve(process.argv[2]) : fileURLToPath(new URL('../', import.meta.url));
const site = path.join(root, 'dist');
const archive = await loadBlog(root);
const { posts } = archive;
// Validate Markdown before replacing the generated preview.
for (const post of archive.allPosts) renderContent(post);
await rm(site, { recursive: true, force: true });
await cp(path.join(root, 'site'), site, { recursive: true });
const origin = 'https://mbeard.co.uk';
const footerYear = Math.max(...posts.map((post) => Number(post.published.slice(0, 4))));
const dateLabel = (post) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${post.date}Z`));
function excerpt(post) {
  return post.description;
}
function topic(post) {
  return post.category;
}
function meta(post) {
  return `<div class="meta"><time datetime="${e(post.date.slice(0, 10))}">${dateLabel(post)}</time><span class="topic">${e(topic(post))}</span></div>`;
}
function page({ title, description, pathname, body, article = false }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${e(title)} | Matt Beard</title>
  <meta name="description" content="${e(description)}">
  <meta name="theme-color" content="#365d60">
  <meta property="og:type" content="${article ? 'article' : 'website'}">
  <meta property="og:title" content="${e(title)}">
  <meta property="og:description" content="${e(description)}">
  <meta property="og:url" content="${e(origin + pathname)}">
  <link rel="canonical" href="${e(origin + pathname)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="alternate" type="application/rss+xml" title="Matt Beard's blog" href="/blog/feed.xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&amp;family=Space+Mono:wght@400;700&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/blog/blog.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <nav class="shell site-nav" aria-label="Main navigation">
    <a class="brand" href="/" aria-label="Matt Beard homepage">MATT/BEARD</a>
    <div class="nav-links"><a class="desktop-link" href="/#about">About</a><a class="desktop-link" href="/#playbook">Playbook</a><a href="/blog/" aria-current="${pathname === '/blog/' ? 'page' : 'true'}">Blog</a><a class="nav-pill" href="/#contact">Connect</a></div>
  </nav>
  <main class="shell" id="main">${body}</main>
  <footer class="shell"><div class="fineprint"><span><a href="/">Back to the main site</a> / <a href="https://github.com/mattybeard">GitHub &#8599;</a> / <a href="/blog/feed.xml">RSS feed</a></span><span>&copy; ${footerYear} Matt Beard</span></div></footer>
</body>
</html>
`;
}
const visuals = {
  validation: '<div class="visual" aria-hidden="true"><div class="validation-table"><div class="validation-row"><span></span><i></i></div><div class="validation-row"><span></span><i></i></div><div class="validation-row"><span></span><i></i></div></div></div>',
  retention: '<div class="visual retention" aria-hidden="true"><div class="retention-diagram"><div class="data-stack"><span></span><span></span><span></span></div><div class="diagram-line"></div><div class="data-stack archive"><span></span><span></span><span></span></div></div></div>',
  none: '',
};
function card(post) {
  return `<article class="post">${visuals[post.illustration]}<div class="post-body">${meta(post)}<h2><a href="${postPath(post)}">${e(post.title)}</a></h2><p>${e(excerpt(post))}</p><a class="text-link" href="${postPath(post)}">Read the post <span aria-hidden="true">&#8594;</span></a></div></article>`;
}
function archiveList(items, headingLevel = 3) {
  const years = [...new Set(items.map((post) => post.date.slice(0, 4)))];
  return years.map((year) => `<section class="archive-year" aria-labelledby="year-${year}"><h${headingLevel} class="year-title" id="year-${year}">${year}</h${headingLevel}><div>${items.filter((post) => post.date.startsWith(year)).map((post) => `<article class="archive-row"><time datetime="${post.date.slice(0, 10)}">${dateLabel(post)}</time><h${headingLevel + 1} class="row-title"><a href="${postPath(post)}">${e(post.title)}</a></h${headingLevel + 1}><span aria-hidden="true">&#8594;</span></article>`).join('')}</div></section>`).join('');
}
const about = `<aside class="blog-aside" aria-label="About this blog"><div><span class="eyebrow">Behind the posts</span><h2>Still writing code.<br>Still taking notes.</h2></div><div><p>I'm Matt, a developer, Chief AI Officer and Microsoft MVP. This is where I share what I've been building and what I've learned along the way.</p><a href="/#about">More about me <span aria-hidden="true">&#8594;</span></a></div></aside>`;
const description = "Tools, experiments and things I've learned while building with data, Dataverse and Power Platform.";
async function writePage(pathname, html) {
  const filename = path.join(site, pathname, 'index.html');
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, html);
}
await writePage('/blog/', page({
  title: 'Blog', description, pathname: '/blog/',
  body: `<header class="intro"><div><span class="eyebrow">Matt Beard</span><h1>Blog.</h1></div><p>${e(description)}</p></header>
    <div class="section-label"><span>Latest writing</span><a href="#archive">Browse the archive / ${posts.length} posts &#8595;</a></div>
    <section class="post-list" aria-label="Latest blog posts">${posts.slice(0, 2).map(card).join('')}</section>
    <section class="archive-section" id="archive" aria-labelledby="archive-heading"><div class="archive-heading"><span class="eyebrow">The archive / ${Math.max(0, posts.length - 2)} earlier posts</span><h2 id="archive-heading">More from the blog.</h2></div>${archiveList(posts.slice(2))}</section>${about}`,
}));
for (const [index, post] of posts.entries()) {
  const { html, headings } = renderContent(post);
  const postTags = archive.tags.filter((tag) => post.tags.includes(tag.name));
  const newer = posts[index - 1];
  const older = posts[index + 1];
  const toc = headings.length ? `<nav class="contents" aria-label="On this page"><span class="eyebrow">On this page</span><ol>${headings.map((heading) => `<li><a href="#${e(heading.id)}">${e(heading.title)}</a></li>`).join('')}</ol></nav>` : '';
  await writePage(postPath(post), page({
    title: post.title, description: excerpt(post), pathname: postPath(post), article: true,
    body: `<article><header class="article-header"><a class="back-link" href="/blog/">&#8592; All posts</a>${meta(post)}<h1>${e(post.title)}</h1><p class="byline">By <a href="/#about">Matt Beard</a></p>${post.history ? `<p class="historical-note">Originally published ${dateLabel(post)}. Product names, screenshots and preview features describe the software at the time of writing.</p>` : ''}</header>
      <div class="reading-layout"><div class="article-content">${html}</div><aside class="reading-aside">${toc}<div class="author-note"><span class="eyebrow">About the author</span><p>Matt Beard<br>Developer, Chief AI Officer and Microsoft MVP.</p><a href="/#about">More about Matt</a></div></aside></div>
      ${postTags.length ? `<nav class="post-tags" aria-label="Post topics">${postTags.map((tag) => `<a href="${tagPath(tag)}">${e(plainText(tag.name))}</a>`).join('')}</nav>` : ''}
      <nav class="post-navigation" aria-label="More posts">${newer ? `<a href="${postPath(newer)}"><span class="eyebrow">Newer post</span><span>${e(newer.title)}</span></a>` : '<span></span>'}${older ? `<a href="${postPath(older)}"><span class="eyebrow">Older post</span><span>${e(older.title)}</span></a>` : '<span></span>'}</nav></article>`,
  }));
  for (const asset of post.assets) {
    const target = path.join(site, asset.path);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(asset.filename, target);
  }
}
const activeTags = archive.tags;
for (const tag of activeTags) {
  const items = posts.filter((post) => post.tags.includes(tag.name));
  await writePage(tagPath(tag), page({
    title: `${plainText(tag.name)} posts`, description: `Matt Beard's posts about ${plainText(tag.name)}.`, pathname: tagPath(tag),
    body: `<header class="intro"><div><a class="back-link" href="/blog/">&#8592; All posts</a><h1>${e(plainText(tag.name))}</h1></div><p>${items.length} ${items.length === 1 ? 'post' : 'posts'} on this topic.</p></header><section class="archive-section" aria-label="Posts on this topic">${archiveList(items, 2)}</section>`,
  }));
}
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Matt Beard's blog</title><link>${origin}/blog/</link><description>${e(description)}</description><language>en-GB</language><atom:link href="${origin}/blog/feed.xml" rel="self" type="application/rss+xml"/>${posts.map((post) => `<item><title>${e(post.title)}</title><link>${origin}${postPath(post)}</link><guid isPermaLink="false">${e(post.history?.guid ?? origin + postPath(post))}</guid><pubDate>${new Date(post.published).toUTCString()}</pubDate><description>${e(excerpt(post))}</description></item>`).join('')}</channel></rss>`;
await writeFile(path.join(site, 'blog', 'feed.xml'), `${feed}\n`);

// Replace only redirects owned by this generator, leaving the site's other rules alone.
const configPath = path.join(site, 'staticwebapp.config.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const redirect = (route, target) => ({ route, redirect: target, statusCode: 301 });
const redirects = [redirect('/blog', '/blog/'), redirect('/blog-prototype.html', '/blog/'), redirect('/feed', '/blog/feed.xml'), redirect('/feed/', '/blog/feed.xml')];
for (const post of posts) {
  if (!post.history) continue;
  const oldPath = new URL(post.history.source).pathname;
  redirects.push(redirect(oldPath, postPath(post)), redirect(oldPath.replace(/\/$/, ''), postPath(post)));
  const slugPath = `/blog/${post.history.slug}`;
  redirects.push(redirect(`${slugPath}/`, postPath(post)), redirect(slugPath, postPath(post)));
}
for (const tag of activeTags) {
  redirects.push(redirect(`/tag/${tag.slug}/`, tagPath(tag)), redirect(`/tag/${tag.slug}`, tagPath(tag)));
}
const ownedRoutes = new Set(redirects.map((route) => route.route));
config.routes = [...config.routes.filter((route) => !ownedRoutes.has(route.route)), ...redirects];
const formattedConfig = JSON.stringify(config, null, 2);
const configJson = Buffer.byteLength(formattedConfig) < 20000 ? formattedConfig : JSON.stringify(config);
if (Buffer.byteLength(`${configJson}\n`) > 20000) throw new Error('Azure route configuration exceeds 20 KB.');
await writeFile(configPath, `${configJson}\n`);
// Validate the exact deployment files, including local article anchors and assets.
const documents = new Map();
for (const entry of await readdir(site, { recursive: true, withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.html')) {
    const filename = path.join(entry.parentPath, entry.name);
    documents.set(filename, parse(await readFile(filename, 'utf8')));
  }
}
for (const [filename, document] of documents) {
  for (const node of walk(document)) {
    for (const attribute of node.attrs ?? []) {
      if (!['href', 'src'].includes(attribute.name)) continue;
      const url = new URL(attribute.value, `${origin}/${path.relative(site, filename).split(path.sep).join('/')}`);
      if (url.origin !== origin) continue;
      const target = path.join(site, decodeURIComponent(url.pathname), url.pathname.endsWith('/') ? 'index.html' : '');
      if (!target.startsWith(`${site}${path.sep}`)) throw new Error(`Invalid local link in ${filename}: ${attribute.value}`);
      await readFile(target);
      if (url.hash) {
        const targetDocument = documents.get(target);
        if (!targetDocument || ![...walk(targetDocument)].some((item) => item.attrs?.some((attr) => attr.name === 'id' && attr.value === decodeURIComponent(url.hash.slice(1))))) {
          throw new Error(`Missing anchor in ${filename}: ${attribute.value}`);
        }
      }
    }
  }
}
console.log(`Built the blog, ${posts.length} articles, ${activeTags.length} topic pages and an RSS feed.`);
