import type { Request, Response } from 'express';
import { memberService } from '../services/memberService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Web page that handles an invite URL.
 *
 * - If the PawPilot app is installed, uses a deep link to open it.
 * - Otherwise, shows instructions to install the app.
 *
 * This is a landing page, not the app. It's minimal on purpose.
 */
export const inviteRedirectController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params as { token: string };
    if (!/^[a-zA-Z0-9_-]{16,64}$/.test(token)) {
      res.status(404).type('text/html').send(renderErrorPage('Invitation not found'));
      return;
    }

    // Best-effort: validate the token exists.
    let petName = 'a pet';
    let inviterName = 'Someone';
    try {
      const preview = await memberService.getInvitationByToken(token);
      petName = preview.pet?.name ?? petName;
      inviterName = preview.inviter?.name ?? inviterName;
    } catch {
      res.status(404).type('text/html').send(renderErrorPage('Invitation not found'));
      return;
    }

    res.type('text/html').send(renderInviteLandingPage(token, petName, inviterName));
  }),
};

function renderInviteLandingPage(token: string, petName: string, inviterName: string): string {
  const deepLink = `pawpilot://invite/${escapeHtml(token)}`;
  // Note: escapeHtml needed if we allow user-provided strings. For MVP,
  // petName and inviterName come from user data. We escape.
  const escapedPetName = escapeHtml(petName);
  const escapedInviterName = escapeHtml(inviterName);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PawPilot invitation</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f5f7; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border-radius: 12px; padding: 32px; max-width: 400px; text-align: center; }
    h1 { font-size: 22px; margin: 0 0 8px 0; }
    p { color: #687076; margin: 0 0 24px 0; }
    a.button { display: inline-block; padding: 12px 24px; background: #0a7ea4; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Open PawPilot</h1>
    <p>${escapedInviterName} invited you to help care for ${escapedPetName}.</p>
    <a class="button" href="${deepLink}">Open in app</a>
    <p style="margin-top: 24px; font-size: 13px;">If the app doesn't open, install PawPilot first, then come back to this link.</p>
  </div>
  <script>
    // Auto-attempt to open the app.
    setTimeout(function () { window.location.href = '${deepLink}'; }, 100);
  </script>
</body>
</html>`;
}

function renderErrorPage(message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>PawPilot</title></head><body style="font-family: sans-serif; text-align: center; padding: 60px;"><h1>${escapeHtml(message)}</h1></body></html>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}