import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { Marked } from 'marked';
import { parseFragment, serialize } from 'parse5';

export const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export function textContent(node) {
  if (node.nodeName === '#text') return node.value;
  return (node.childNodes ?? []).map(textContent).join('');
}
export const plainText = (html) => textContent(parseFragment(html)).replace(/\s+/g, ' ').trim();
export const postPath = (post) => `/blog/${post.folder}/`;
export const tagPath = (tag) => `/blog/tag/${tag.slug}/`;
export const tagSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function* walk(node) {
  yield node;
  for (const child of node.childNodes ?? []) yield* walk(child);
}

const folderPattern = /^\d{4}-\d{2}-\d{2}(?:-(?:[2-9]|[1-9]\d+))?$/;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
// Explicit Markdown links avoid GFM autolinks swallowing escaped punctuation in prose.
const markdown = new Marked({ gfm: true, breaks: false }, { tokenizer: { url() { return undefined; } } });
export function parsePost(source, folder) {
  if (!folderPattern.test(folder)) throw new Error(`Invalid post folder: ${folder}`);
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error(`Missing YAML frontmatter in ${folder}/index.md`);
  const data = parseYaml(match[1], { uniqueKeys: true });
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`Invalid frontmatter in ${folder}`);
  const allowed = new Set(['title', 'published', 'description', 'tags', 'category', 'draft', 'illustration']);
  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) throw new Error(`Unknown metadata "${key}" in ${folder}`);
  }
  for (const key of ['title', 'description', 'published']) {
    if (typeof data[key] !== 'string' || !data[key].trim()) throw new Error(`Missing ${key} in ${folder}`);
  }
  if (!timestampPattern.test(data.published) || !Number.isFinite(Date.parse(data.published)) ||
      new Date(data.published).toISOString() !== data.published.replace('Z', '.000Z')) {
    throw new Error(`Invalid UTC publication timestamp in ${folder}`);
  }
  if (!folder.startsWith(data.published.slice(0, 10))) throw new Error(`Folder date and published date differ in ${folder}`);
  if (typeof data.draft !== 'boolean') throw new Error(`draft must be true or false in ${folder}`);
  if (!Array.isArray(data.tags) || data.tags.some((tag) => typeof tag !== 'string' || !tag.trim() || !tagSlug(tag))) {
    throw new Error(`tags must be a list of names in ${folder}`);
  }
  if (new Set(data.tags.map(tagSlug)).size !== data.tags.length) throw new Error(`Duplicate tags in ${folder}`);
  if (data.category !== undefined && (typeof data.category !== 'string' || !data.category.trim())) throw new Error(`Invalid category in ${folder}`);
  if (data.illustration !== undefined && !['validation', 'retention', 'none'].includes(data.illustration)) throw new Error(`Invalid illustration in ${folder}`);
  if (!match[2].trim()) throw new Error(`Empty article in ${folder}`);
  return {
    folder, title: data.title, description: data.description, published: data.published,
    date: data.published.slice(0, -1), dateGmt: data.published.slice(0, -1),
    tags: data.tags, category: data.category ?? 'From the blog',
    draft: data.draft, illustration: data.illustration ?? 'none', markdown: match[2],
  };
}

export async function loadBlog(root) {
  const history = JSON.parse(await readFile(path.join(root, 'content', 'blog-history.json'), 'utf8'));
  const directory = path.join(root, 'content', 'blog');
  const entries = await readdir(directory, { withFileTypes: true });
  const allPosts = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) throw new Error(`Unexpected blog source: ${entry.name}`);
    const sourceDirectory = path.join(directory, entry.name);
    const post = parsePost(await readFile(path.join(sourceDirectory, 'index.md'), 'utf8'), entry.name);
    post.history = history.posts.find((item) => item.folder === post.folder);
    // Keep the original local publication time on imported articles.
    if (post.history) post.date = post.history.date;
    post.sourceDirectory = sourceDirectory;
    post.content = markdown.parse(post.markdown);
    post.assets = [];
    for (const asset of await readdir(sourceDirectory, { withFileTypes: true })) {
      if (asset.name === 'index.md' && asset.isFile()) continue;
      if (asset.name !== 'images' || !asset.isDirectory()) throw new Error(`Unexpected article asset: ${entry.name}/${asset.name}`);
      for (const image of await readdir(path.join(sourceDirectory, 'images'), { withFileTypes: true })) {
        if (!image.isFile() || !/^[\w.-]+\.(png|gif|jpe?g|webp)$/i.test(image.name)) throw new Error(`Invalid image: ${entry.name}/${image.name}`);
        const filename = path.join(sourceDirectory, 'images', image.name);
        if (!(await stat(filename)).size) throw new Error(`Empty image: ${filename}`);
        post.assets.push({ filename, path: `${postPath(post)}images/${image.name}` });
      }
    }
    allPosts.push(post);
  }
  allPosts.sort((a, b) => b.published.localeCompare(a.published) || a.folder.localeCompare(b.folder));
  const posts = allPosts.filter((post) => !post.draft);
  if (!posts.length) throw new Error('The blog needs at least one published post');
  const tagsBySlug = new Map();
  for (const post of posts) {
    for (const name of post.tags) {
      const slug = tagSlug(name);
      const previous = tagsBySlug.get(slug);
      if (previous && previous.name !== name) throw new Error(`Conflicting topic names: ${previous.name} and ${name}`);
      tagsBySlug.set(slug, { slug, name });
    }
  }
  return { posts, allPosts, tags: [...tagsBySlug.values()], history };
}

const allowedTags = new Set('p div figure img h2 h3 h4 h5 h6 ul li a pre code figcaption em blockquote br cite strong ol s del span hr table thead tbody tr td th'.split(' '));
const allowedAttributes = new Set(['id', 'alt', 'width', 'height', 'colspan', 'rowspan', 'start', 'title']);
export function renderContent(post) {
  const fragment = parseFragment(post.content);
  const headings = [];
  const usedIds = new Set();
  function localUrl(value, image = false) {
    const url = new URL(value, `https://mbeard.co.uk${postPath(post)}`);
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) throw new Error(`Unsupported link in ${post.folder}: ${value}`);
    if (url.origin !== 'https://mbeard.co.uk') {
      if (image) throw new Error(`Save images beside the Markdown in ${post.folder}: ${value}`);
      return url.href;
    }
    const localPath = decodeURIComponent(url.pathname);
    if (image && !post.assets.some((asset) => asset.path === localPath)) throw new Error(`Missing article image in ${post.folder}: ${value}`);
    return `${url.pathname}${url.search}${url.hash}`;
  }
  function clean(parent) {
    parent.childNodes = (parent.childNodes ?? []).flatMap((node) => {
      if (node.nodeName === '#comment') return [];
      if (!node.tagName) return [node];
      if (!allowedTags.has(node.tagName)) throw new Error(`Unsupported element in ${post.folder}: ${node.tagName}`);
      const original = new Map(node.attrs.map(({ name, value }) => [name, value]));
      if (node.attrs.some(({ name }) => name.startsWith('on'))) throw new Error(`Event attributes are not permitted in ${post.folder}`);
      node.attrs = node.attrs.filter(({ name }) => allowedAttributes.has(name));
      if (original.get('class') === 'missing-media') node.attrs.push({ name: 'class', value: 'missing-media' });
      if (node.tagName === 'a' && original.has('href')) node.attrs.push({ name: 'href', value: localUrl(original.get('href')) });
      if (node.tagName === 'img') {
        if (!original.has('src')) throw new Error(`Image without source in ${post.folder}`);
        node.attrs.push({ name: 'src', value: localUrl(original.get('src'), true) }, { name: 'loading', value: 'lazy' }, { name: 'decoding', value: 'async' });
        if (!original.has('alt')) node.attrs.push({ name: 'alt', value: '' });
      }
      if (/^h[2-6]$/.test(node.tagName)) {
        const title = textContent(node);
        let id = original.get('id') || tagSlug(title) || 'section';
        const base = id;
        let suffix = 2;
        while (usedIds.has(id)) id = `${base}-${suffix++}`;
        node.attrs = node.attrs.filter((attr) => attr.name !== 'id');
        node.attrs.push({ name: 'id', value: id });
        if (node.tagName === 'h2') headings.push({ id, title });
      }
      const id = node.attrs.find((attr) => attr.name === 'id')?.value;
      if (id) {
        if (usedIds.has(id)) throw new Error(`Duplicate id in ${post.folder}: ${id}`);
        usedIds.add(id);
      }
      clean(node);
      return [node];
    });
  }
  clean(fragment);
  return { html: serialize(fragment), headings };
}
