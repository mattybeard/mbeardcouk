import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse, parseFragment } from 'parse5';
import { loadBlog, postPath, tagPath, renderContent, textContent, walk } from '../scripts/blog-content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = path.join(root, 'dist');
const archive = await loadBlog(root);
const history = archive.history;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const ids = (html) => [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const files = readdirSync(site, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath, entry.name));
const pages = files.filter((filename) => filename.endsWith('.html'));
function localFile(pathname) {
  const filename = path.join(site, decodeURIComponent(pathname));
  return pathname.endsWith('/') ? path.join(filename, 'index.html') : filename;
}

for (const filename of pages) {
  test(`${path.relative(site, filename)}: structure, local links, privacy and CSS`, () => {
    const html = readFileSync(filename, 'utf8');
    assert.match(html, /^<!doctype html>/i);
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
    assert.doesNotMatch(html, /\bchester\b|hello@example\.com/i);
    assert.equal(ids(html).length, new Set(ids(html)).size);
    const errors = [];
    const document = parse(html, { onParseError: (error) => errors.push(error.code) });
    assert.deepEqual(errors, []);
    for (const node of walk(document)) {
      for (const attr of node.attrs ?? []) {
        if (!['href', 'src'].includes(attr.name)) continue;
        const url = new URL(attr.value, `https://mbeard.co.uk/${path.relative(site, filename).split(path.sep).join('/')}`);
        if (url.origin !== 'https://mbeard.co.uk') continue;
        const target = localFile(url.pathname);
        assert.ok(existsSync(target), `Missing file: ${attr.value}`);
        if (url.hash) assert.ok(ids(readFileSync(target, 'utf8')).includes(decodeURIComponent(url.hash.slice(1))), `Missing anchor: ${attr.value}`);
      }
    }
    const css = html + readFileSync(path.join(site, 'blog', 'blog.css'), 'utf8');
    const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
    for (const match of css.matchAll(/var\((--[\w-]+)\)/g)) assert.ok(defined.has(match[1]), `Undefined CSS variable: ${match[1]}`);
    assert.doesNotMatch(html, /(?:href|src)="[^"]*\/wp-content\//);
  });
}

test('Homepage keeps the approved biography and community content', () => {
  const html = readFileSync(localFile('/'), 'utf8');
  for (const text of ['https://github.com/mattybeard', 'AI agents', 'plugins', 'Chief AI Officer',
    'Business Applications', 'Microsoft 365', 'D365PPUG Manchester', 'D365PPUG London', 'Scottish Summit']) {
    assert.ok(html.includes(text), `Missing content: ${text}`);
  }
  assert.match(html, /class="skip-link" href="#main"/);
  assert.ok(html.indexOf('Scottish Summit</h3>') < html.indexOf('D365PPUG Manchester'));
  for (const filename of ['index.html', '404.html']) assert.doesNotMatch(readFileSync(path.join(site, filename), 'utf8'), /[\u2013\u2014]|&[mn]dash;|&#821[12];/);
});

test('All 33 original articles preserve text, exact code, dates and titles', () => {
  assert.equal(history.posts.length, 33);
  assert.equal(new Set(history.posts.map((post) => post.id)).size, 33);
  for (const original of history.posts) {
    const post = archive.posts.find((item) => item.folder === original.folder);
    assert.ok(post, `Missing original article: ${original.folder}`);
    assert.equal(post.title, original.title);
    assert.equal(post.published, `${original.dateGmt}Z`);
    const content = renderContent(post).html;
    const nodes = [...walk(parseFragment(content))];
    const blockHashes = nodes.filter((node) => ['p', 'h2', 'h3', 'li', 'figcaption'].includes(node.tagName))
      .map((node) => textContent(node).replace(/\s+/g, ' ').trim()).filter(Boolean).map(hash);
    for (const expected of original.blocks) assert.ok(blockHashes.includes(expected), `Text changed in ${post.folder}: ${expected}`);
    assert.deepEqual(nodes.filter((node) => node.tagName === 'pre').map((node) => hash(textContent(node))), original.code, `Code changed in ${post.folder}`);
    assert.ok(readFileSync(localFile(postPath(post)), 'utf8').includes(`datetime="${original.date.slice(0,10)}"`));
  }
});

test('Original image checksums match the Markdown source and deployment copies', () => {
  assert.equal(new Set(history.media.filter((item) => item.path).map((item) => item.source)).size, 140);
  for (const media of history.media.filter((item) => item.path)) {
    const original = history.posts.find((item) => item.id === media.postId);
    const source = path.join(root, 'content', 'blog', original.folder, 'images', path.basename(media.path));
    for (const filename of [source, localFile(media.path)]) {
      const bytes = readFileSync(filename);
      assert.equal(bytes.length, media.bytes);
      assert.equal(hash(bytes), media.sha256);
    }
  }
  assert.equal(history.media.filter((item) => item.unavailable).length, 1);
  assert.match(readFileSync(localFile('/blog/2021-06-03/'), 'utf8'), /An image in the original post is no longer available/);
});

test('The index, topic pages, RSS and article paths reflect published Markdown', () => {
  const index = readFileSync(localFile('/blog/'), 'utf8');
  const document = parse(index);
  const hasClass = (node, value) => node.attrs?.some((attr) => attr.name === 'class' && attr.value.split(' ').includes(value));
  const cards = [...walk(document)].filter((node) => hasClass(node, 'post'));
  const rows = [...walk(document)].filter((node) => hasClass(node, 'archive-row'));
  assert.equal(cards.length, Math.min(2, archive.posts.length));
  assert.equal(rows.length, Math.max(0, archive.posts.length - 2));
  const titles = [...cards, ...rows].map((node) => textContent([...walk(node)].find((child) => ['h2', 'h4'].includes(child.tagName))));
  assert.deepEqual(titles, archive.posts.map((post) => post.title));
  for (const [i, card] of cards.entries()) {
    const visual = [...walk(card)].find((node) => hasClass(node, 'visual'));
    assert.equal(Boolean(visual), archive.posts[i].illustration !== 'none');
    if (visual) assert.equal(textContent(visual).trim(), '');
  }
  const feed = readFileSync(localFile('/blog/feed.xml'), 'utf8');
  assert.equal([...feed.matchAll(/<item>/g)].length, archive.posts.length);
  for (const post of archive.posts) {
    assert.match(postPath(post), /^\/blog\/\d{4}-\d{2}-\d{2}(?:-\d+)?\/$/);
    assert.ok(index.includes(`href="${postPath(post)}"`));
    const html = readFileSync(localFile(postPath(post)), 'utf8');
    assert.ok(html.includes(`<link rel="canonical" href="https://mbeard.co.uk${postPath(post)}">`));
    for (const node of walk(parseFragment(renderContent(post).html))) {
      assert.ok(!['script', 'iframe', 'style'].includes(node.tagName));
      if (node.tagName === 'img') assert.ok(node.attrs.find((attr) => attr.name === 'src').value.startsWith(`${postPath(post)}images/`));
    }
    assert.ok(feed.includes(`<pubDate>${new Date(post.published).toUTCString()}</pubDate>`));
    if (post.history) assert.ok(feed.includes(post.history.guid.replaceAll('&', '&amp;')));
  }
  for (const tag of archive.tags) assert.ok(existsSync(localFile(tagPath(tag))));
  assert.ok(existsSync(localFile('/blog/2020-09-18/')));
  assert.ok(existsSync(localFile('/blog/2020-09-18-2/')));
});

test('Deployment configuration preserves old routes, true 404s and security headers', () => {
  const config = JSON.parse(readFileSync(localFile('/staticwebapp.config.json'), 'utf8'));
  assert.ok(readFileSync(localFile('/staticwebapp.config.json')).length < 20000);
  assert.equal(config.navigationFallback, undefined);
  assert.equal(config.responseOverrides['404'].rewrite, '/404.html');
  assert.match(config.globalHeaders['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.doesNotMatch(config.globalHeaders['Content-Security-Policy'], /script-src/);
  assert.deepEqual(config.routes[0], { route: '/index.html', redirect: '/', statusCode: 301 });
  for (const original of history.posts) {
    const old = new URL(original.source).pathname;
    for (const route of [old, old.replace(/\/$/, ''), `/blog/${original.slug}/`, `/blog/${original.slug}`]) {
      assert.deepEqual(config.routes.find((item) => item.route === route), { route, redirect: `/blog/${original.folder}/`, statusCode: 301 });
    }
  }
  for (const route of config.routes.filter((item) => item.redirect)) {
    assert.notEqual(route.route, route.redirect, 'Redirects must not point to themselves');
    assert.ok(existsSync(localFile(route.redirect)), `Broken redirect: ${route.route}`);
  }
  assert.deepEqual(readdirSync(site).sort(), ['404.html', 'blog', 'favicon.svg', 'index.html', 'staticwebapp.config.json']);
  assert.ok(!files.some((file) => /\.(md|js|mjs)$/.test(file)), 'Source and scripts must not be published');
});
