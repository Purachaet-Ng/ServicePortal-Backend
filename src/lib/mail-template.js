/**
 * The HTML half of a notification email. One layout for all of them: every
 * fan-out sends the same shape — one sentence, optionally a few fields, and
 * one place to go — so there is nothing else to vary.
 *
 * Table-based with inline styles on purpose. Outlook renders with Word, which
 * ignores flex, grid and most of a <style> block; tables and inline CSS are
 * the subset every client has agreed on for twenty years. Keep it that way.
 *
 * Colours are the frontend's brand tokens as hex (frontend/src/index.css) —
 * mail clients do not support oklch or CSS variables, so they are copied here
 * rather than referenced.
 */
const VIOLET = "#5B3FC4";
const INK = "#1E1B33";
const MUTED = "#5F5B7A";
const BORDER = "#E4E0EE";
const BOARD = "#F7F6FB";
const TINT = "#EDE8FA";

// Titles reach here quoted and user-written — a ticket called
// "<script>" must not become markup.
const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Read per call, not once at import: this module is loaded by tests and
// scripts that never pull in dotenv, and a stale module-level copy would
// silently ignore MAIL_BRAND in exactly those places.
const brandName = () => escapeHtml(process.env.MAIL_BRAND || "Service Center");

/**
 * The wordmark rides along as an attachment (see LOGO in mailer.js) rather
 * than a hosted URL: every client blocks remote images by default, and there
 * is no public place to host one anyway. `cid:` is the only src that renders
 * on first open in Gmail, Outlook and Apple Mail alike.
 *
 * It is a PNG, not the SVG in frontend/public — Gmail strips <svg> entirely.
 * Regenerate it from logo-wordmark.svg with:
 *   chrome --headless --default-background-color=00000000  *     --window-size=621,73 --screenshot=assets/logo-wordmark.png logo-wordmark.svg
 */
export const LOGO_CID = "wordmark";

/**
 * @param message  the same sentence written to the notifications table
 * @param url      absolute link to the thing that changed; optional
 * @param details  optional `{ label: value }` rows — Title, Type, Severity.
 *                 Empty values are dropped, so a caller can hand over a whole
 *                 ticket without filtering it first.
 */
export const renderNotificationEmail = (message, url, details = {}, logoSrc = `cid:${LOGO_CID}`) => {
  const BRAND = brandName();
  const text = escapeHtml(message);

  const rows = Object.entries(details).filter(([, value]) => value);

  const detailList = rows.length
    ? `
              <tr>
                <td style="padding:20px 32px 0 32px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                         style="background-color:${BOARD};border:1px solid ${BORDER};border-radius:8px;">
                    ${rows
                      .map(
                        ([label, value]) => `
                    <tr>
                      <td style="padding:8px 16px;font-size:13px;color:${MUTED};white-space:nowrap;">${escapeHtml(label)}</td>
                      <td style="padding:8px 16px;font-size:14px;color:${INK};font-weight:600;">${escapeHtml(value)}</td>
                    </tr>`,
                      )
                      .join("")}
                  </table>
                </td>
              </tr>`
    : "";

  // The link is the button and the words "this link" — never a bare URL. A
  // pasted-out http://localhost:5173/... is noise to a reader and looks like
  // phishing to a spam filter.
  const action = url
    ? `
              <tr>
                <td style="padding:24px 32px 4px 32px;">
                  <a href="${escapeHtml(url)}"
                     style="display:inline-block;padding:12px 26px;background-color:${VIOLET};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;">
                    View in ${BRAND}
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 32px 0 32px;font-size:14px;line-height:22px;color:${MUTED};">
                  You can follow the progress by clicking the button above, or
                  <a href="${escapeHtml(url)}" style="color:${VIOLET};font-weight:600;">this link</a>.
                </td>
              </tr>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${text}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${BOARD};">
    <!-- Shown in the inbox list next to the subject; hidden in the body. -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${text}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background-color:${BOARD};padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="max-width:560px;background-color:#ffffff;border-radius:10px;border:1px solid ${BORDER};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td style="padding:20px 32px;background-color:${TINT};border-bottom:1px solid ${BORDER};border-radius:10px 10px 0 0;">
                <!-- width on the tag as well as the style: Outlook ignores the
                     style and would otherwise draw it at its full 621px. -->
                <img src="${escapeHtml(logoSrc)}" alt="${BRAND}" width="200"
                     style="display:block;width:200px;max-width:60%;height:auto;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 0 32px;font-size:17px;line-height:26px;font-weight:600;color:${INK};">
                ${text}
              </td>
            </tr>
            <tr>
              <td style="padding:10px 32px 0 32px;font-size:14px;line-height:22px;color:${MUTED};">
                This is an automatic email about activity on your ${BRAND} account.
              </td>
            </tr>
            ${detailList}
            ${action}
            <tr>
              <td style="padding:24px 32px 28px 32px;font-size:13px;line-height:20px;color:${MUTED};border-top:1px solid ${BORDER};">
                Please do not reply to this email — this mailbox is not monitored.
                Use the ${BRAND} interface to reply.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};
