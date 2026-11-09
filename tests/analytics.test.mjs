import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../site/analytics.js', import.meta.url), 'utf8');
const consentKey = 'analytics-consent-v1';

function browser({
  hostname = 'www.mbeard.co.uk', protocol = 'https:', saved = null, storageBlocked = false,
  ingestionStatus = 200, hasSettings = true
} = {}) {
  const elements = new Map();
  const scripts = [];
  const instances = [];
  const errors = [];
  const cookies = [];
  const requests = [];
  const events = {};
  const storage = new Map(saved === null ? [] : [[consentKey, saved]]);
  let interval;
  let reloads = 0;
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      hidden: true, textContent: '', handlers: {},
      addEventListener(name, handler) { this.handlers[name] = handler; },
      focus(options) { this.focused = true; this.focusOptions = options; }
    });
    return elements.get(id);
  };
  class ApplicationInsights {
    constructor({ config }) {
      this.config = config;
      this.pages = [];
      instances.push(this);
    }
    loadAppInsights() { this.loaded = true; }
    getSender() { return { pause: () => { this.paused = true; } }; }
    getCookieMgr() { return { setEnabled: (enabled) => { this.cookiesEnabled = enabled; } }; }
    addTelemetryInitializer(initializer) { this.initializer = initializer; }
    trackPageView(page) { this.pages.push(page); }
  }
  const document = {
    title: 'Matt Beard',
    getElementById: (id) => id === 'analytics-settings' && !hasSettings ? null : element(id),
    querySelector: (selector) => selector === 'a[href="/privacy.html"]' ? element('privacy-link') : null,
    createElement: () => ({}),
    head: { append: (script) => scripts.push(script) },
    set cookie(value) { cookies.push(value); }
  };
  vm.runInNewContext(source, {
    location: { hostname, protocol, origin: `${protocol}//${hostname}`, pathname: '/', reload: () => reloads++ },
    document,
    AbortController,
    fetch: (url, options) => {
      requests.push({ url, ...options });
      return Promise.resolve({ ok: ingestionStatus >= 200 && ingestionStatus < 300, status: ingestionStatus });
    },
    localStorage: {
      getItem(key) {
        if (storageBlocked) throw new Error('Storage blocked');
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        if (storageBlocked) throw new Error('Storage blocked');
        storage.set(key, value);
      }
    },
    window: {
      addEventListener: (name, handler) => { events[name] = handler; },
      setInterval: (handler) => { interval = handler; }
    },
    Microsoft: { ApplicationInsights: { ApplicationInsights } },
    console: { error: (...args) => errors.push(args) }
  });
  return {
    element, scripts, instances, errors, cookies, requests, events, storage,
    click: (id) => element(id).handlers.click(),
    tick: () => interval(),
    blockStorage: () => { storageBlocked = true; },
    get reloads() { return reloads; }
  };
}

const savedChoice = (choice, time = Date.now()) => JSON.stringify({ choice, time });

test('Basic counting sends one minimal event without cookies or visitor identifiers', () => {
  const page = browser();
  assert.equal(page.requests.length, 1);
  const request = page.requests[0];
  assert.equal(request.credentials, 'omit');
  assert.equal(request.referrerPolicy, 'no-referrer');
  const [event] = JSON.parse(request.body);
  assert.equal(event.data.baseType, 'EventData');
  assert.equal(event.data.baseData.name, 'BasicPageView');
  assert.deepEqual(event.data.baseData.properties, { hostname: 'www.mbeard.co.uk' });
  assert.deepEqual(event.tags, { 'ai.location.ip': '0.0.0.0' });
  assert.doesNotMatch(request.body, /user_Id|session_Id|ai\.user|ai\.session|refUri|"url"/);
  assert.equal(page.scripts.length, 0);
  page.click('analytics-accept');
  assert.equal(page.requests.length, 1, 'Acceptance must not double-count the basic event');
});

test('Reject aborts the basic request and future rejected visits send nothing', () => {
  const page = browser();
  page.click('analytics-reject');
  assert.equal(page.requests[0].signal.aborted, true);
  const denied = browser({ saved: savedChoice('denied') });
  assert.equal(denied.requests.length, 0);
  assert.equal(browser({ storageBlocked: true }).requests.length, 0);
});

test('Basic ingestion failures are logged and shown without overriding a rejection', async () => {
  for (const ingestionStatus of [206, 400, 429, 500]) {
    const page = browser({ ingestionStatus });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(page.errors.length, 1, `HTTP ${ingestionStatus}`);
    assert.match(page.element('analytics-status').textContent, /counting is unavailable/);
    const rejected = browser({ ingestionStatus });
    rejected.click('analytics-reject');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(rejected.element('analytics-consent').hidden, true);
    assert.equal(rejected.errors.length, 0, 'Aborted requests should not report an ingestion failure');
  }
});

test('No SDK loads before consent; accept loads it once with minimal collection', () => {
  const page = browser();
  assert.equal(page.scripts.length, 0);
  assert.equal(page.element('analytics-consent').hidden, false);
  page.click('analytics-accept');
  page.click('analytics-accept');
  assert.equal(page.scripts.length, 1);
  page.scripts[0].onload();
  const sdk = page.instances[0];
  const basicRequest = page.requests[0];
  const basicEvent = JSON.parse(basicRequest.body)[0];
  const connection = new Map(sdk.config.connectionString.split(';').filter(Boolean).map((part) => {
    const separator = part.indexOf('=');
    return [part.slice(0, separator), part.slice(separator + 1)];
  }));
  assert.equal(connection.get('InstrumentationKey'), basicEvent.iKey);
  assert.equal(`${connection.get('IngestionEndpoint')}v2/track`, basicRequest.url);
  assert.equal(sdk.loaded, true);
  assert.equal(sdk.pages.length, 1);
  assert.equal(sdk.pages[0].uri, 'https://www.mbeard.co.uk/');
  for (const setting of ['disableAjaxTracking', 'disableFetchTracking', 'disableExceptionTracking',
    'isStorageUseDisabled', 'disableFlushOnBeforeUnload', 'disableFlushOnUnload']) {
    assert.equal(sdk.config[setting], true, setting);
  }
  assert.equal(sdk.config.enableSessionStorageBuffer, false);
  assert.equal(sdk.config.enableAutoRouteTracking, false);
  assert.equal(sdk.config.cookieCfg.enabled, true);
  assert.equal(sdk.config.samplingPercentage, 100);
  const item = {
    baseType: 'PageviewData',
    baseData: { uri: 'https://www.mbeard.co.uk/?private=1#secret', refUri: 'private' },
    ext: { trace: { name: '/#secret' } },
    tags: { 'ai.operation.name': '/#secret' }
  };
  sdk.initializer(item);
  assert.equal(item.baseData.uri, 'https://www.mbeard.co.uk/');
  assert.equal(item.baseData.refUri, '');
  assert.equal(item.ext.trace.name, '/');
  assert.equal(item.tags['ai.operation.name'], '/');
  assert.equal(sdk.initializer({ baseType: 'ExceptionData' }), false);
});

test('Reject persists without loading the SDK and settings can reopen', () => {
  const page = browser();
  page.click('analytics-reject');
  assert.equal(JSON.parse(page.storage.get(consentKey)).choice, 'denied');
  assert.equal(page.scripts.length, 0);
  assert.equal(page.element('analytics-consent').hidden, true);
  page.click('analytics-settings');
  assert.equal(page.element('analytics-consent').hidden, false);
  assert.equal(page.element('analytics-accept').focused, true);
});

test('Accepting or rejecting restores keyboard focus without scrolling to settings', () => {
  for (const id of ['analytics-accept', 'analytics-reject']) {
    const page = browser();
    page.click(id);
    assert.equal(page.element('analytics-settings').focused, true);
    assert.equal(page.element('analytics-settings').focusOptions?.preventScroll, true);
  }
});

test('Pages without a settings button still count and allow consent choices', () => {
  for (const id of ['analytics-accept', 'analytics-reject']) {
    const page = browser({ hasSettings: false });
    assert.equal(page.element('analytics-consent').hidden, false);
    assert.equal(page.requests.length, 1);
    page.click(id);
    assert.equal(page.element('analytics-consent').hidden, true);
    assert.equal(page.scripts.length, id === 'analytics-accept' ? 1 : 0);
    assert.equal(page.element('privacy-link').focused, true);
    assert.equal(page.element('privacy-link').focusOptions?.preventScroll, true);
  }
});

test('Existing accepted and rejected choices are respected', () => {
  assert.equal(browser({ saved: savedChoice('granted') }).scripts.length, 1);
  const denied = browser({ saved: savedChoice('denied') });
  assert.equal(denied.scripts.length, 0);
  assert.equal(denied.element('analytics-consent').hidden, true);
});

test('Expired, invalid and future consent never starts analytics', () => {
  for (const saved of [
    savedChoice('granted', Date.now() - 181 * 86400000),
    savedChoice('granted', Date.now() + 86400000),
    savedChoice('invalid'), JSON.stringify({ choice: 'granted' }), '{broken'
  ]) {
    const page = browser({ saved });
    assert.equal(page.scripts.length, 0, saved);
    assert.equal(page.element('analytics-consent').hidden, false, saved);
  }
});

test('Localhost shows consent controls and loads real analytics only after acceptance', () => {
  for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
    const page = browser({ hostname, protocol: 'http:' });
    assert.equal(page.element('analytics-consent').hidden, false);
    assert.equal(page.element('analytics-settings').hidden, false);
    assert.equal(page.scripts.length, 0);
    page.click('analytics-accept');
    assert.equal(page.element('analytics-consent').hidden, true);
    assert.equal(JSON.parse(page.storage.get(consentKey)).choice, 'granted');
    assert.equal(page.scripts.length, 1);
    page.scripts[0].onload();
    assert.equal(page.instances.length, 1);
    assert.equal(page.instances[0].pages[0].uri, `http://${hostname}/`);
    page.click('analytics-settings');
    assert.equal(page.element('analytics-consent').hidden, false);
    assert.match(page.element('analytics-status').textContent, /currently on/i);
    page.click('analytics-reject');
    assert.equal(JSON.parse(page.storage.get(consentKey)).choice, 'denied');
    assert.equal(page.instances[0].config.disableTelemetry, true);
    assert.equal(page.reloads, 1);
    assert.equal(browser({ hostname, saved: savedChoice('granted') }).scripts.length, 1);
    const denied = browser({ hostname, protocol: 'http:', saved: savedChoice('denied') });
    assert.equal(denied.scripts.length, 0);
    assert.equal(denied.element('analytics-consent').hidden, true);
  }
});

test('Apex domain, preview hosts and production HTTP are excluded even with consent', () => {
  for (const options of [
    { hostname: 'mbeard.co.uk' },
    { hostname: 'preview.azurestaticapps.net' }, { protocol: 'http:' }
  ]) {
    const page = browser({ ...options, saved: savedChoice('granted') });
    assert.equal(page.scripts.length, 0);
    assert.equal(page.requests.length, 0);
    assert.equal(page.element('analytics-settings').hidden, true);
  }
});

test('Rejecting while the SDK downloads prevents initialization', () => {
  const page = browser();
  page.click('analytics-accept');
  page.click('analytics-reject');
  page.scripts[0].onload();
  assert.equal(page.instances.length, 0);
});

test('Withdrawal disables telemetry, deletes cookies and reloads without flushing', () => {
  const page = browser({ saved: savedChoice('granted') });
  page.scripts[0].onload();
  page.click('analytics-reject');
  assert.equal(page.instances[0].config.disableTelemetry, true);
  assert.equal(page.instances[0].paused, true);
  assert.equal(page.instances[0].cookiesEnabled, false);
  assert.equal(page.instances[0].initializer({ baseType: 'PageviewData' }), false);
  assert.ok(page.cookies.some((cookie) => cookie.startsWith('ai_user=; Max-Age=0')));
  assert.ok(page.cookies.some((cookie) => cookie.startsWith('ai_session=; Max-Age=0')));
  assert.equal(page.reloads, 1);
});

test('A choice changed in another tab stops active analytics', () => {
  const page = browser({ saved: savedChoice('granted') });
  page.scripts[0].onload();
  page.storage.set(consentKey, savedChoice('denied'));
  page.events.storage({ key: consentKey });
  assert.equal(page.instances[0].config.disableTelemetry, true);
  assert.equal(page.reloads, 1);
});

test('Expiry while the page is open stops active analytics', () => {
  const page = browser({ saved: savedChoice('granted') });
  page.scripts[0].onload();
  page.storage.set(consentKey, savedChoice('granted', Date.now() - 181 * 86400000));
  page.tick();
  assert.equal(page.reloads, 1);
});

test('Blocked storage leaves analytics off and reports the failure', () => {
  const page = browser({ storageBlocked: true });
  page.click('analytics-accept');
  assert.equal(page.scripts.length, 0);
  assert.equal(page.element('analytics-consent').hidden, false);
  assert.match(page.element('analytics-status').textContent, /could not be saved/);
  assert.ok(page.errors.length > 0);
});

test('SDK download failure is visible and acceptance can retry', () => {
  const page = browser();
  page.click('analytics-accept');
  page.scripts[0].onerror(new Error('Blocked'));
  assert.match(page.element('analytics-status').textContent, /could not load/);
  assert.equal(page.element('analytics-consent').hidden, false);
  page.click('analytics-accept');
  assert.equal(page.scripts.length, 2);
  assert.equal(page.element('analytics-status').textContent, '');
});

test('An SDK download failure after rejection must not reopen the consent prompt', () => {
  const page = browser();
  page.click('analytics-accept');
  page.click('analytics-reject');
  page.scripts[0].onerror(new Error('Download failed after rejection'));
  assert.equal(page.element('analytics-consent').hidden, true);
  assert.equal(page.errors.length, 0);
});

test('Failed withdrawal persistence still stops telemetry without reloading stale consent', () => {
  const page = browser({ saved: savedChoice('granted') });
  page.scripts[0].onload();
  page.blockStorage();
  page.click('analytics-reject');
  assert.equal(page.instances[0].config.disableTelemetry, true);
  assert.equal(page.instances[0].paused, true);
  assert.equal(page.instances[0].cookiesEnabled, false);
  assert.equal(page.reloads, 0);
  page.tick();
  assert.equal(page.scripts.length, 1);
  assert.match(page.element('analytics-status').textContent, /could not be saved/);
});

test('CSP allows only the configured SDK and telemetry origins', () => {
  const config = JSON.parse(readFileSync(new URL('../site/staticwebapp.config.json', import.meta.url), 'utf8'));
  const policy = config.globalHeaders['Content-Security-Policy'];
  assert.ok(policy.split('; ').includes("script-src 'self' https://js.monitor.azure.com"));
  assert.ok(policy.split('; ').includes('connect-src https://eastus2-3.in.applicationinsights.azure.com'));
});
