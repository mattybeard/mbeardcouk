import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const site = fileURLToPath(new URL('../site/', import.meta.url));
const voidTags = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const ids = (html) => [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);

for (const filename of readdirSync(site).filter((name) => name.endsWith('.html'))) {
  test(`${filename}: structure, local links, privacy and CSS`, () => {
    const html = readFileSync(path.join(site, filename), 'utf8');
    assert.match(html, /^<!doctype html>/i);
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
    assert.doesNotMatch(html, /\bchester\b|hello@example\.com/i);
    assert.equal(ids(html).length, new Set(ids(html)).size);
    const stack = [];
    for (const match of html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*>/gi)) {
      const tag = match[2].toLowerCase();
      if (voidTags.has(tag)) continue;
      if (match[1]) assert.equal(stack.pop(), tag, `Unbalanced ${tag}`);
      else stack.push(tag);
    }
    assert.deepEqual(stack, []);
    for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const link = new URL(match[1], `https://portfolio.invalid/${filename}`);
      if (link.origin !== 'https://portfolio.invalid') continue;
      const target = path.join(site, decodeURIComponent(link.pathname === '/' ? '/index.html' : link.pathname));
      assert.ok(existsSync(target), `Missing file: ${match[1]}`);
      if (link.hash) assert.ok(ids(readFileSync(target, 'utf8')).includes(link.hash.slice(1)), `Missing anchor: ${match[1]}`);
    }
    const defined = new Set([...html.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
    for (const match of html.matchAll(/var\((--[\w-]+)\)/g)) {
      assert.ok(defined.has(match[1]), `Undefined CSS variable: ${match[1]}`);
    }
  });
}

test('Homepage includes approved biography, expertise and GitHub', () => {
  const html = readFileSync(path.join(site, 'index.html'), 'utf8');
  for (const text of ['https://github.com/mattybeard', 'AI agents', 'plugins', 'Chief AI Officer',
    'Business Applications', 'Microsoft 365', 'D365PPUG Manchester', 'D365PPUG London', 'Scottish Summit']) {
    assert.ok(html.includes(text), `Missing content: ${text}`);
  }
  assert.match(html, /class="skip-link" href="#main"/);
  assert.ok(html.indexOf('Scottish Summit</h3>') < html.indexOf('D365PPUG Manchester'), 'Scottish Summit should be listed first');
});

test('Homepage explains practical AI work and offers direct email contact', () => {
  const html = readFileSync(path.join(site, 'index.html'), 'utf8');
  for (const text of ['maximise their investment', 'data-input agents', 'manual entry',
    'custom developer skills', 'consistent style across projects and repositories']) {
    assert.ok(html.includes(text), `Missing content: ${text}`);
  }
  assert.match(html, /href="mailto:matt@mbeard\.co\.uk">Email me/);
  assert.match(html, /class="button primary" href="https:\/\/github\.com\/mattybeard">Find me on GitHub/);
});

test('Published pages contain no em or en dashes', () => {
  for (const filename of readdirSync(site)) {
    const text = readFileSync(path.join(site, filename), 'utf8');
    assert.doesNotMatch(text, /[\u2013\u2014]|&[mn]dash;|&#821[12];/, `Dash found in ${filename}`);
  }
});

test('Azure configuration preserves real 404s and security headers', () => {
  const config = JSON.parse(readFileSync(path.join(site, 'staticwebapp.config.json'), 'utf8'));
  assert.equal(config.navigationFallback, undefined);
  assert.equal(config.responseOverrides['404'].rewrite, '/404.html');
  assert.match(config.globalHeaders['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.deepEqual(config.routes[0], { route: '/index.html', redirect: '/', statusCode: 301 });
});

test('Deployment directory contains only intended public files', () => {
  assert.deepEqual(readdirSync(site).sort(), ['404.html', 'favicon.svg', 'index.html', 'staticwebapp.config.json']);
});
