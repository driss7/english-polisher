# Chrome Web Store — submission kit

Everything you need to paste into the Chrome Web Store Developer Dashboard when
publishing English Polisher. (This file is documentation, not part of the
shipped extension.)

## Before you start

1. Create a developer account at https://chrome.google.com/webstore/devconsole
   (one-time **$5** registration fee, any Google account).
2. Build the upload package: run `./build-zip.sh` → produces `english-polisher-<version>.zip`.
3. Host the privacy policy: the raw URL of `PRIVACY.md` works, e.g.
   `https://github.com/driss7/english-polisher/blob/main/PRIVACY.md`

## Listing fields

**Name**

```
English Polisher
```

**Summary** (short description, max 132 chars)

```
Fix your grammar or rewrite text to sound human — powered by free AI (Gemini, Chrome built-in AI, Groq, OpenRouter) or Claude.
```

**Category**: Productivity
**Language**: English

**Detailed description**

```
English Polisher cleans up your writing or drafts it for you — without leaving the page.

POLISH MODE
Paste or select text and choose one:
• Fix — corrects grammar, spelling, and punctuation while keeping your meaning and tone
• Humanize — rewrites stiff, robotic, or AI-sounding text so it reads like a real person
• Shorten — makes it tighter and clearer

ASK MODE
Give a plain instruction like "reply to this email" or "write a short bio," and
optionally paste the email or notes as context. Get a natural, human-sounding draft
you can copy or insert.

IN-FIELD BUTTON (EXPERIMENTAL, OFF BY DEFAULT)
Optionally enable a small button that appears in the corner of text boxes on the
web. Click it for Fix / Humanize / Shorten and the field is rewritten in place,
with a loading state.

IN-PLACE EDITING
Select text in any editable field (Gmail, comment boxes, text areas), then
right-click or press a keyboard shortcut to replace it in place — with undo.

FREE TO RUN
• Google Gemini free tier — no credit card required
• Chrome's built-in AI (Gemini Nano) — runs entirely on your device, no key, no data leaves your machine
• Also supports Groq, OpenRouter, and Anthropic Claude

PRIVATE BY DESIGN
No accounts, no analytics, no backend. Your API key is stored in your browser and
your text is sent only to the AI provider you choose (or nowhere at all with the
on-device model).

You bring an API key from your chosen provider; the extension is free and open source.
```

## Single purpose (required statement)

```
English Polisher has one purpose: to improve or generate text with an AI model the
user configures — fixing grammar, rewriting for tone, shortening, or drafting from
an instruction.
```

## Permission justifications

Paste these into the corresponding fields in the dashboard.

- **storage** — Stores the user's chosen AI provider, model, style preferences, and API key locally in the browser.
- **contextMenus** — Adds the Fix / Humanize / Shorten actions to the right-click menu on selected text.
- **activeTab** — Reads the user's current text selection on the active tab only when they invoke the extension (keyboard shortcut), so it can rewrite it.
- **scripting** — Injects the content script into the active tab when needed to capture the selection and replace it in place.
- **Host permissions** (`generativelanguage.googleapis.com`, `api.groq.com`, `openrouter.ai`, `api.anthropic.com`) — The extension sends the user's text to whichever of these AI provider APIs the user configured, in order to return a rewrite. No other hosts are contacted.
- **Content script on all sites** — In-place editing (fix/humanize a selection with a shortcut) must work in text fields on any website the user is typing on.

## Data usage disclosures (Privacy practices tab)

- Does the extension collect user data? **Yes** — "Website content" (the text the user submits for rewriting) and "Authentication information" (the API key).
- Is data sold to third parties? **No.**
- Is data used for anything other than the single purpose? **No.**
- Is data transferred? **Yes** — the submitted text is sent to the user-selected AI provider to perform the rewrite. (With the on-device Chrome built-in AI option, no data is transferred.)
- Uses remote code? **No** — all logic ships in the package; the extension only calls JSON APIs.
- Privacy policy URL: `https://github.com/driss7/english-polisher/blob/main/PRIVACY.md`

## Store assets (in ./store)

- **Icon**: `icons/icon128.png` (128×128) — auto-used from the package.
- **Screenshots** (1280×800): `store/screenshot-1.png`, `store/screenshot-2.png`. At least one is required.
- **Small promo tile** (440×280, optional): `store/promo-small.png`.

## Submit

Upload the ZIP, fill the fields above, attach the screenshots, set visibility
(Public / Unlisted / Private), and submit for review.
