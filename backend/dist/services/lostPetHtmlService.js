import { serializeLostReportForPublic } from './lostPetService.js';
/**
 * Server-rendered HTML for the public lost-pet page.
 *
 * Why server-render?
 * - One HTTP response, no JS execution, works in any browser.
 * - SEO-friendly (in the unlikely case someone searches).
 * - No build step, no bundle, no framework.
 *
 * Why is this a "service"?
 * - Centralizes HTML generation and escaping.
 * - The controller just calls `renderLostPetPage(report, pet)` and sends.
 */
function escapeHtml(input) {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function escapeAttr(input) {
    return escapeHtml(input);
}
function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
    }) + ' UTC';
}
/**
 * Render the lost-pet page.
 *
 * The output is a single HTML document with inline CSS. No external
 * dependencies. ~200 lines total. Fast on any device, works offline after
 * first load.
 */
export function renderLostPetPage(report, pet) {
    const view = serializeLostReportForPublic(report, pet);
    if (!view) {
        // Pet deleted — show a "not available" page.
        return renderUnavailablePage('This report is not available', 'The pet associated with this report is no longer in our system.');
    }
    if (view.found) {
        return renderFoundPage(view.petName);
    }
    if (view.expired) {
        return renderUnavailablePage('This report has expired', `The lost pet report for ${escapeHtml(view.petName)} has expired. If ${escapeHtml(view.petName)} is still missing, the owner may have created a new report.`);
    }
    const title = `Lost ${view.species} — ${view.petName} — PawPilot`;
    const shareText = encodeURIComponent(`Help find ${view.petName}! Last seen at ${view.lastSeenLocation}.`);
    const shareUrl = encodeURIComponent(`${process.env.PUBLIC_APP_URL ?? 'https://pawpilot.app'}/lost/${report.shareToken}`);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="Lost pet: ${escapeAttr(view.petName)}. Last seen at ${escapeAttr(view.lastSeenLocation)}.">
  <meta name="robots" content="noindex, nofollow">
  <meta property="og:title" content="Lost ${escapeAttr(view.species)} — ${escapeAttr(view.petName)}">
  <meta property="og:description" content="Last seen at ${escapeAttr(view.lastSeenLocation)} on ${escapeAttr(formatDate(view.lastSeenAt))}.">
  ${view.photoUrl ? `<meta property="og:image" content="${escapeAttr(view.photoUrl)}">` : ''}
  <meta property="og:type" content="article">
  <style>${styles()}</style>
</head>
<body>
  <main class="container">
    <div class="banner">LOST PET</div>
    ${view.photoUrl ? `<div class="photo"><img src="${escapeAttr(view.photoUrl)}" alt="${escapeAttr(view.petName)}"></div>` : ''}
    <h1>${escapeHtml(view.petName)}</h1>
    <p class="subtitle">${escapeHtml(view.species)}${view.breed ? ` · ${escapeHtml(view.breed)}` : ''}${view.gender !== 'unknown' ? ` · ${escapeHtml(view.gender)}` : ''}${view.color ? ` · ${escapeHtml(view.color)}` : ''}</p>

    <section class="detail">
      <h2>Last seen</h2>
      <p class="detail-value">${escapeHtml(view.lastSeenLocation)}</p>
      <p class="detail-meta">${escapeHtml(formatDate(view.lastSeenAt))}</p>
    </section>

    ${view.description ? `
    <section class="detail">
      <h2>Notes from the owner</h2>
      <p class="detail-description">${escapeHtml(view.description).replace(/\n/g, '<br>')}</p>
    </section>
    ` : ''}

    ${view.rewardOffered ? `
    <section class="reward">
      <strong>Reward offered:</strong> ${escapeHtml(view.rewardOffered)}
    </section>
    ` : ''}

    ${view.contactMethod === 'phone' && view.contactPhone ? `
    <section class="contact">
      <h2>Contact the owner</h2>
      <p class="contact-value"><a href="tel:${escapeAttr(view.contactPhone)}">${escapeHtml(view.contactPhone)}</a></p>
    </section>
    ` : ''}

    ${view.contactMethod === 'email' && view.contactEmail ? `
    <section class="contact">
      <h2>Contact the owner</h2>
      <p class="contact-value"><a href="mailto:${escapeAttr(view.contactEmail)}">${escapeHtml(view.contactEmail)}</a></p>
    </section>
    ` : ''}

    <section class="share">
      <h2>Share this page</h2>
      <p class="share-hint">The more people who see this, the better the chance of finding ${escapeHtml(view.petName)}.</p>
      <div class="share-buttons">
        <a class="button" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}">Share on Facebook</a>
        <a class="button" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}">Share on X</a>
        <a class="button" target="_blank" rel="noopener" href="sms:?&body=${shareText}%20${shareUrl}">Share via SMS</a>
      </div>
      <p class="share-url">${escapeHtml(`${process.env.PUBLIC_APP_URL ?? 'https://pawpilot.app'}/lost/${report.shareToken}`)}</p>
    </section>

    <footer class="footer">
      <p>This page is generated by PawPilot. The owner has chosen not to display personal contact information.</p>
      <p>If you have information, share this page with someone who does.</p>
    </footer>
  </main>
</body>
</html>`;
}
function renderFoundPage(petName) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Found — ${escapeHtml(petName)} — PawPilot</title>
  <meta name="robots" content="noindex, nofollow">
  <style>${styles()}</style>
</head>
<body>
  <main class="container">
    <div class="banner banner-success">FOUND</div>
    <h1>${escapeHtml(petName)} has been found</h1>
    <p class="subtitle">Thank you to everyone who helped.</p>
  </main>
</body>
</html>`;
}
function renderUnavailablePage(title, message) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — PawPilot</title>
  <meta name="robots" content="noindex, nofollow">
  <style>${styles()}</style>
</head>
<body>
  <main class="container">
    <h1>${escapeHtml(title)}</h1>
    <p class="subtitle">${message}</p>
  </main>
</body>
</html>`;
}
function styles() {
    return `
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f7; color: #11181c; line-height: 1.5; }
    .container { max-width: 640px; margin: 0 auto; background: #fff; padding: 24px; min-height: 100vh; }
    .banner { background: #c53030; color: #fff; text-align: center; padding: 10px; font-weight: 700; letter-spacing: 2px; border-radius: 8px; margin-bottom: 24px; }
    .banner-success { background: #15803d; }
    .photo { text-align: center; margin-bottom: 20px; }
    .photo img { max-width: 100%; border-radius: 12px; max-height: 400px; object-fit: cover; }
    h1 { font-size: 28px; margin: 0 0 4px 0; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #687076; margin: 0 0 8px 0; font-weight: 600; }
    .subtitle { color: #687076; margin: 0 0 24px 0; }
    .detail { margin-bottom: 20px; }
    .detail-value { font-size: 18px; font-weight: 500; margin: 0 0 4px 0; }
    .detail-meta { color: #687076; font-size: 14px; margin: 0; }
    .detail-description { margin: 0; white-space: pre-wrap; }
    .reward { background: #fef3c7; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .contact { margin-bottom: 20px; }
    .contact-value { font-size: 18px; margin: 0; }
    .contact-value a { color: #0a7ea4; text-decoration: none; }
    .share { margin-bottom: 24px; }
    .share-hint { color: #687076; font-size: 14px; margin: 0 0 12px 0; }
    .share-buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .button { display: inline-block; padding: 10px 16px; background: #0a7ea4; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500; }
    .share-url { font-size: 12px; color: #687076; word-break: break-all; margin: 0; }
    .footer { border-top: 1px solid #e1e3e6; padding-top: 16px; color: #687076; font-size: 13px; }
    .footer p { margin: 4px 0; }
  `;
}
//# sourceMappingURL=lostPetHtmlService.js.map