export function formatGoogleError(err) {
  const msg = err?.response?.data?.error?.message || err?.message || String(err);
  if (msg.includes("403")) {
    return "Error: Permission denied. Check that your Google account has access to this Search Console property.";
  }
  if (msg.includes("404")) {
    return "Error: Site or URL not found. Check the site_url (e.g. 'https://example.com/' or 'sc-domain:example.com').";
  }
  if (msg.includes("429")) {
    return "Error: Rate limit exceeded. Wait a moment and try again.";
  }
  return `Error: ${msg}`;
}
