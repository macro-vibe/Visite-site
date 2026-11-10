(() => {
  'use strict';
  const defaults = {
    'services.html': 'services',
    'approach.html': 'process',
    'contact.html': 'contact'
  };
  const page = location.pathname.split('/').pop();
  if (!Object.prototype.hasOwnProperty.call(defaults, page)) return;
  const anchors = new Set([
    'home', 'services', 'process', 'contact', 'main',
    'websites', 'apps', 'bots', 'automation', 'service-api', 'development', 'custom',
    'step-0', 'step-1', 'step-2', 'step-3'
  ]);
  let anchor = location.hash.slice(1);
  if (page === 'services.html' && anchor === 'services') anchor = 'service-api';
  if (!anchors.has(anchor)) anchor = defaults[page];
  const destination = new URL('index.html', location.href);
  destination.search = location.search;
  destination.hash = anchor;
  location.replace(destination.href);
})();
