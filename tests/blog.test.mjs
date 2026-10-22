import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { stringify, parse as parseYaml } from 'yaml';
import { parsePost, loadBlog, renderContent } from '../scripts/blog-content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (metadata = {}, body = 'An introduction.\n\n## Setup\n\nWrite the setup here.') => {
  const data = {
    title: 'A new post', published: '2026-10-22T12:00:00Z',
    description: 'A new article outline.', tags: ['Dataverse'], draft: false, ...metadata,
  };
  return `---\n${stringify(data)}---\n\n${body}\n`;
};
const post = (metadata = {}, body) => ({ ...parsePost(source(metadata, body), '2026-10-22'), assets: [] });

test('Frontmatter validates required fields, dates, duplicate keys and stable folder names', () => {
  assert.equal(post().title, 'A new post');
  assert.equal(post().illustration, 'none');
  assert.equal(parsePost(source(), '2026-10-22-2').folder, '2026-10-22-2');
  assert.equal(parsePost(source(), '2026-10-22-10').folder, '2026-10-22-10');
  for (const metadata of [
    { title: '' }, { description: '' }, { published: 'tomorrow' }, { published: '2026-02-30T12:00:00Z' },
    { draft: 'false' }, { tags: 'Dataverse' }, { tags: ['Dataverse', 'dataverse'] },
    { illustration: 'anything' }, { unknown: 'typo' },
  ]) assert.throws(() => post(metadata));
  assert.throws(() => parsePost(source(), '2026-10-23'), /date differ/);
  assert.throws(() => parsePost(source(), '../escape'), /Invalid post folder/);
  assert.throws(() => parsePost(source().replace('title: A new post', 'title: First\ntitle: Second'), '2026-10-22'));
  assert.throws(() => parsePost('No metadata', '2026-10-22'), /frontmatter/);
});

test('Article rendering assigns unique heading IDs and resolves article-local images', () => {
  const article = post();
  article.content = '<h2>Setup</h2><h2>Setup</h2><pre><code>const answer = 42;\n</code></pre><img src="images/example.png" alt="Example"><figcaption>An example caption.</figcaption>';
  article.assets = [{ path: '/blog/2026-10-22/images/example.png' }];
  const rendered = renderContent(article);
  assert.deepEqual(rendered.headings.map((heading) => heading.id), ['setup', 'setup-2']);
  assert.match(rendered.html, /src="\/blog\/2026-10-22\/images\/example.png"/);
  assert.match(rendered.html, /An example caption/);
});

test('Article rendering rejects unsafe markup and missing or external images', () => {
  for (const html of [
    '<script>alert(1)</script>', '<iframe src="https://example.com"></iframe>',
    '<a href="javascript:alert(1)">Bad</a>', '<img src="https://example.com/image.png">',
    '<img src="images/missing.png">', '<img src="images/example.png" onerror="alert(1)">',
  ]) {
    assert.throws(() => renderContent({ ...post(), content: html }));
  }
});

test('Publishing Markdown updates lists, topics and feed, excludes drafts and cleans stale output', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mbeard-markdown-'));
  const build = () => execFileSync(process.execPath, [path.join(root, 'scripts', 'build-blog.mjs'), directory], { encoding: 'utf8', stdio: 'pipe' });
  const articleFile = (folder) => path.join(directory, 'content', 'blog', folder, 'index.md');
  const outputFile = (...parts) => path.join(directory, 'dist', ...parts);
  const read = (...parts) => readFile(outputFile(...parts), 'utf8');
  async function add(folder, metadata, body) {
    await mkdir(path.dirname(articleFile(folder)), { recursive: true });
    await writeFile(articleFile(folder), source(metadata, body));
  }
  try {
    await cp(path.join(root, 'site'), path.join(directory, 'site'), { recursive: true });
    await mkdir(path.join(directory, 'content'), { recursive: true });
    await writeFile(path.join(directory, 'content', 'blog-history.json'), '{"posts":[],"media":[]}');
    await add('2026-10-20', { title: 'Earlier', published: '2026-10-20T12:00:00Z' });
    await add('2026-10-22', { title: 'New Markdown post', illustration: 'validation', tags: ['Native topic'] },
      'An introduction.\n\n## Setup\n\n## Setup\n\n```js\nconst answer = 42;\n```\n\n| Name | Value |\n| --- | --- |\n| Test | 42 |\n\n![Example](images/example.png)\n\n<figcaption>An example caption.</figcaption>\n\n[Earlier post](/blog/2026-10-20/)');
    const images = path.join(directory, 'content', 'blog', '2026-10-22', 'images');
    await mkdir(images);
    await cp(path.join(root, 'content', 'blog', '2026-04-20', 'images', 'image-1.png'), path.join(images, 'example.png'));
    await add('2026-10-22-2', { title: 'Second same-day post', published: '2026-10-22T13:00:00Z' });
    await add('2026-10-23', { title: 'Private draft', published: '2026-10-23T12:00:00Z', tags: ['Draft only'], draft: true });
    build();
    const blog = await loadBlog(directory);
    assert.equal(blog.posts.length, 3);
    assert.equal(blog.allPosts.length, 4);
    const index = await read('blog', 'index.html');
    assert.ok(index.indexOf('Second same-day post') < index.indexOf('New Markdown post'));
    assert.ok(index.includes('More from the blog.'));
    assert.ok(index.includes('Earlier'));
    assert.ok(!index.includes('Private draft'));
    const article = await read('blog', '2026-10-22', 'index.html');
    assert.match(article, /<pre><code>const answer = 42;/);
    assert.match(article, /<table>/);
    assert.match(article, /id="setup-2"/);
    assert.match(article, /An example caption/);
    assert.doesNotMatch(article, /historical-note/);
    assert.ok(existsSync(outputFile('blog', '2026-10-22', 'images', 'example.png')));
    assert.ok(existsSync(outputFile('blog', 'tag', 'native-topic', 'index.html')));
    assert.ok(!existsSync(outputFile('blog', '2026-10-23')));
    assert.ok(!existsSync(outputFile('blog', 'tag', 'draft-only')));
    const feed = await read('blog', 'feed.xml');
    assert.equal([...feed.matchAll(/<item>/g)].length, 3);
    assert.ok(!feed.includes('Private draft'));
    const config = JSON.parse(await read('staticwebapp.config.json'));
    assert.ok(!config.routes.some((route) => route.route === route.redirect));
    const outputFiles = (await readdir(outputFile(), { recursive: true, withFileTypes: true }))
      .filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath, entry.name));
    const before = await Promise.all(outputFiles.map(async (filename) => createHash('sha256').update(await readFile(filename)).digest('hex')));
    build();
    const after = await Promise.all(outputFiles.map(async (filename) => createHash('sha256').update(await readFile(filename)).digest('hex')));
    assert.deepEqual(after, before, 'Repeated builds must be deterministic');
    await writeFile(articleFile('2026-10-22'), source({ title: 'New Markdown post', tags: ['Native topic'], draft: true }));
    build();
    assert.ok(!existsSync(outputFile('blog', '2026-10-22')), 'A newly unpublished post and its images must be removed');
    assert.ok(!existsSync(outputFile('blog', 'tag', 'native-topic')), 'Unused topic pages must be removed');
    await add('2026-10-24', { published: '2026-10-24T12:00:00Z' }, '[Broken link](/blog/2026-10-22/)');
    assert.throws(build, /ENOENT/, 'Links to unpublished articles must fail the build');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('CI builds the deployment output and the author agent uses Markdown sources', async () => {
  const workflow = parseYaml(await readFile(path.join(root, '.github', 'workflows', 'azure-static-web-apps-proud-desert-0fa7b880f.yml'), 'utf8'));
  const steps = workflow.jobs.build_and_deploy_job.steps;
  const deployIndex = steps.findIndex((step) => step.uses?.startsWith('Azure/static-web-apps-deploy'));
  assert.ok(steps.slice(0, deployIndex).some((step) => step.run === 'npm ci'));
  assert.ok(steps.slice(0, deployIndex).some((step) => step.run === 'npm test'));
  assert.equal(steps[deployIndex].with.app_location, './dist');
  assert.equal(steps[deployIndex].with.skip_app_build, true);
  const agent = await readFile(path.join(root, '.github', 'agents', 'blog-author.agent.md'), 'utf8');
  const frontmatter = parseYaml(agent.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
  assert.equal(frontmatter.name, 'Blog author');
  assert.equal(frontmatter['user-invocable'], true);
  assert.match(agent, /content\/blog\/yyyy-MM-dd\/index\.md/);
  assert.match(agent, /npm run build/);
  assert.doesNotMatch(agent, /content\/blog\.json/);
});
