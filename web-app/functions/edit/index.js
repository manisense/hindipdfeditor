// Permanent redirects for the retired single-page-app URL `/edit/`, which holds most of the
// site's search history. `_redirects` cannot match query strings, so `/edit/?tool=merge`
// is resolved here and sent straight to its own page instead of via a client-side hop.
const TOOL_PATHS = {
  edit: '/edit-hindi-pdf/',
  translate: '/translate-hindi-pdf/',
  merge: '/merge-pdf/',
  split: '/split-pdf/',
  compress: '/compress-pdf/',
};

export function onRequest({ request }) {
  const url = new URL(request.url);
  const tool = url.searchParams.get('tool');
  const lang = url.searchParams.get('lang');
  url.searchParams.delete('tool');
  url.searchParams.delete('lang');

  const path = (tool && TOOL_PATHS[tool]) || '/';
  url.pathname = lang === 'hi' ? `/hi${path}` : path;
  return Response.redirect(url.toString(), 301);
}
