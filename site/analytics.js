(() => {
  'use strict';

  const production = location.hostname === 'www.mbeard.co.uk' && location.protocol === 'https:';
  const localhost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (!production && !localhost) return;

  const consentKey = 'analytics-consent-v1';
  const consentLifetime = 180 * 24 * 60 * 60 * 1000;
  const instrumentationKey = '8637d04b-f24d-4a63-87ff-436b395dcb76';
  const ingestionEndpoint = 'https://eastus2-3.in.applicationinsights.azure.com';
  const panel = document.getElementById('analytics-consent');
  const status = document.getElementById('analytics-status');
  const settings = document.getElementById('analytics-settings');
  let choice;
  let loading = false;
  let analytics;
  let storageFailed = false;
  let basicCountSent = false;
  let basicRequest;

  function countBasicPageView() {
    if (basicCountSent || storageFailed) return;
    basicCountSent = true;
    basicRequest = new AbortController();
    fetch(`${ingestionEndpoint}/v2/track`, {
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' },
      signal: basicRequest.signal,
      body: JSON.stringify([{
        name: `Microsoft.ApplicationInsights.${instrumentationKey.replaceAll('-', '')}.Event`,
        time: new Date().toISOString(),
        iKey: instrumentationKey,
        tags: { 'ai.location.ip': '0.0.0.0' },
        data: {
          baseType: 'EventData',
          baseData: { ver: 2, name: 'BasicPageView', properties: { hostname: location.hostname } }
        }
      }])
    }).then((response) => {
      if (!response.ok || response.status === 206) throw new Error(`Telemetry ingestion returned HTTP ${response.status}`);
    }).catch((error) => {
      if (basicRequest.signal.aborted) return;
      console.error('Basic page-view counting failed:', error);
      if (choice !== 'denied') status.textContent = 'Basic page-view counting is unavailable. You can still choose your analytics preference.';
    });
  }

  function reportError(message, error) {
    console.error(message, error);
    panel.hidden = false;
    status.textContent = message;
  }

  function readConsent() {
    if (storageFailed) return undefined;
    try {
      const saved = JSON.parse(localStorage.getItem(consentKey));
      if (saved && ['granted', 'denied'].includes(saved.choice) &&
          Number.isFinite(saved.time) && saved.time <= Date.now() &&
          Date.now() - saved.time < consentLifetime) return saved.choice;
    } catch (error) {
      storageFailed = true;
      reportError('Your analytics preference could not be read. Analytics is off until you choose.', error);
    }
    return undefined;
  }

  function clearAnalyticsCookies() {
    for (const name of ['ai_user', 'ai_session']) {
      document.cookie = `${name}=; Max-Age=0; Path=/; Secure; SameSite=Lax`;
    }
  }

  function startAnalytics() {
    if (analytics?.config.disableTelemetry) {
      location.reload();
      return;
    }
    if (loading || analytics) return;
    loading = true;
    const script = document.createElement('script');
    script.src = 'https://js.monitor.azure.com/scripts/b/ai.3.gbl.min.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onerror = (error) => {
      loading = false;
      if (choice === 'granted') {
        reportError('Analytics could not load. You can reject analytics or try accepting again.', error);
      }
    };
    script.onload = () => {
      loading = false;
      if (choice !== 'granted' || readConsent() !== 'granted') return;
      try {
        analytics = new Microsoft.ApplicationInsights.ApplicationInsights({
          config: {
            connectionString: `InstrumentationKey=${instrumentationKey};IngestionEndpoint=${ingestionEndpoint}/`,
            cookieCfg: { enabled: true, path: '/' },
            disableAjaxTracking: true,
            disableFetchTracking: true,
            disableExceptionTracking: true,
            enableAutoRouteTracking: false,
            autoTrackPageVisitTime: false,
            isStorageUseDisabled: true,
            enableSessionStorageBuffer: false,
            disableFlushOnBeforeUnload: true,
            disableFlushOnUnload: true,
            extensionConfig: { AppInsightsCfgSyncPlugin: { blkCdnCfg: true } },
            samplingPercentage: 100,
            maxBatchInterval: 1000
          }
        });
        analytics.loadAppInsights();
        analytics.addTelemetryInitializer((item) => {
          if (choice !== 'granted' || item.baseType !== 'PageviewData') return false;
          item.baseData.uri = `${location.origin}${location.pathname}`;
          if (item.ext?.trace) item.ext.trace.name = location.pathname;
          if (item.tags) item.tags['ai.operation.name'] = location.pathname;
          // Referrers can contain search terms or identifiers.
          item.baseData.refUri = '';
        });
        analytics.trackPageView({ name: document.title, uri: `${location.origin}${location.pathname}` });
      } catch (error) {
        reportError('Analytics could not start. You can reject analytics or reload to try again.', error);
      }
    };
    document.head.append(script);
  }

  function applyConsent(nextChoice) {
    choice = nextChoice;
    panel.hidden = Boolean(choice);
    if (choice === 'denied' || storageFailed) basicRequest?.abort();
    else countBasicPageView();
    if (choice === 'granted') {
      startAnalytics();
    } else {
      clearAnalyticsCookies();
      if (analytics) {
        // Do not flush queued telemetry when consent is withdrawn.
        analytics.config.disableTelemetry = true;
        analytics.getSender().pause();
        analytics.getCookieMgr().setEnabled(false);
        if (!storageFailed) location.reload();
      }
    }
  }

  function saveConsent(nextChoice) {
    try {
      localStorage.setItem(consentKey, JSON.stringify({ choice: nextChoice, time: Date.now() }));
      storageFailed = false;
    } catch (error) {
      storageFailed = true;
      applyConsent(undefined);
      reportError('Your preference could not be saved. Analytics is off on this page. Allow site storage to save a choice.', error);
      return;
    }
    status.textContent = '';
    applyConsent(nextChoice);
    const focusTarget = settings ?? document.querySelector('a[href="/privacy.html"]');
    focusTarget?.focus({ preventScroll: true });
  }

  document.getElementById('analytics-accept').addEventListener('click', () => saveConsent('granted'));
  document.getElementById('analytics-reject').addEventListener('click', () => saveConsent('denied'));
  if (settings) settings.hidden = false;
  settings?.addEventListener('click', () => {
    panel.hidden = false;
    status.textContent = choice === 'granted' ? 'Analytics is currently on. Reject analytics to withdraw consent.' :
      choice === 'denied' ? 'Analytics is currently off.' :
        'Only cookie-free page-load counting is active. Reject analytics to stop counting.';
    document.getElementById('analytics-accept').focus();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === consentKey || event.key === null) applyConsent(readConsent());
  });
  window.setInterval(() => {
    const savedChoice = readConsent();
    if (savedChoice !== choice) applyConsent(savedChoice);
  }, 60000);
  applyConsent(readConsent());
})();
