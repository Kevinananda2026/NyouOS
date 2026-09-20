---
name: fluent-app-builder
description: Build, revise, or review sandboxed professional Fluent Apps for FluentOS from a user's natural-language request, using the request's language for the conversation and initial App copy while making every App bilingual in Chinese and English and responsive to FluentOS system language. Use when creating the HTML, CSS, JavaScript, permission declarations, or network allowlists for a Fluent App, converting an existing web tool into a Fluent App, or diagnosing a Fluent App that must comply with the FluentOS bridge and packaging rules.
---

# Fluent App Builder

Build professional Fluent Apps that run in the Developer Center sandbox. Treat every rule in this skill as mandatory.

## Non-negotiable rules

- Use only the public `FluentOS` APIs documented below for host capabilities.
- Never invent a FluentOS API, permission, manifest field, or system App ID.
- Never bypass the FluentOS bridge with browser or host APIs.
- Never use `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.clipboard`, `localStorage`, `sessionStorage`, `indexedDB`, Cache Storage, cookies, service workers, Web Workers, `window.parent`, `window.top`, `window.opener`, or host-directed `postMessage`.
- Use ordinary sandbox-local DOM, events, forms, timers, `URL`, `JSON`, `Math`, and in-memory JavaScript state only when no host capability is involved.
- Use `FluentOS.storage` for persistence, `FluentOS.network` for remote resources, `FluentOS.clipboard` for the clipboard, and `FluentOS.files` for user text files.
- Declare every permission required by the code and no unused permission. A declared permission is not pre-granted: `storage.local` is authenticated before the App first opens, while FluentOS asks for other capabilities when the App first calls them. A denial is persistent and the App must handle it without retry loops.
- Await every asynchronous FluentOS call and handle rejection with a useful in-App message. Do not assume permission, connectivity, a browser capability, or a target system App is available.
- Keep secrets and API keys out of HTML, CSS, JavaScript, logs, files, and persistent storage.
- Generate separate HTML, CSS, and JavaScript suitable for the Developer Center fields. Do not add external scripts, stylesheets, fonts, iframes, objects, media, workers, or remote module imports.

## Language and localization contract

- Detect whether the user's original request is primarily Chinese or English. Ask the three discovery questions, restate the requirements, and present implementation notes in that same language.
- Use Chinese as the authored default when the request is Chinese and English when the request is English. For a request in another language, use English as the runtime fallback unless the user explicitly requires that additional locale.
- Make every generated App fully support both Simplified Chinese and English by default, even if the user requests only one language. Store every user-facing string in complete `zh` and `en` dictionaries with identical keys.
- Localize the App name, window title, navigation, buttons, labels, placeholders, validation messages, dialogs, notifications, loading/empty/success/denial/error states, sample content, dates, units, tooltips, `title`, `aria-label`, `alt`, and other accessibility text. Do not leave hidden states or error paths in only one language.
- On startup, call `await FluentOS.getLanguage()` and automatically select Chinese for language tags beginning with `zh`, English for tags beginning with `en`, and English for every other system language.
- Listen for `fluentosstatechange` and re-render language-dependent UI when `event.detail.language` changes. Preserve form values, focus, selection, scroll position, and in-progress work during this re-render.
- Set `document.documentElement.lang` to `zh-CN` for Chinese and `en` for English whenever the active language changes.
- Use the original request language only as the initial fallback before FluentOS language is available. The FluentOS system language becomes authoritative after it is read.
- Preserve API names, code identifiers, required manifest values, domain names, product names, and established technical terms when translating them would make them invalid or misleading.
- Do not spend one of the three discovery questions asking about Chinese/English support; it is mandatory. Ask about language only when the user explicitly requests an additional locale or a custom override independent of FluentOS.

Use this structure in every generated App and expand both dictionaries with all App-specific copy:

```js
const messages = {
  zh: {
    appTitle: '示例 App',
    save: '保存',
    saveFailed: '保存失败：{message}'
  },
  en: {
    appTitle: 'Example App',
    save: 'Save',
    saveFailed: 'Could not save: {message}'
  }
};

// Set this from the original prompt: 'zh' for Chinese, otherwise 'en'.
const promptLanguage = 'zh';
const normalizeLanguage = (value) => {
  const language = String(value || '').toLowerCase();
  if (language === 'zh' || language.startsWith('zh-')) return 'zh';
  if (language === 'en' || language.startsWith('en-')) return 'en';
  return 'en';
};

let currentLanguage = FluentOS.state?.language
  ? normalizeLanguage(FluentOS.state.language)
  : promptLanguage;

function t(key, values = {}) {
  const template = messages[currentLanguage]?.[key] ?? messages.en[key] ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

function renderLanguage() {
  document.documentElement.lang = currentLanguage === 'zh' ? 'zh-CN' : 'en';
  // Update every visible and accessible string without replacing user data.
}

async function syncSystemLanguage() {
  try {
    currentLanguage = normalizeLanguage(await FluentOS.getLanguage());
  } catch (_) {
    currentLanguage = promptLanguage;
  }
  renderLanguage();
}

window.addEventListener('fluentosstatechange', (event) => {
  if (!event.detail?.language) return;
  currentLanguage = normalizeLanguage(event.detail.language);
  renderLanguage();
});

renderLanguage();
syncSystemLanguage();
```

## Required discovery gate

Before writing code, inspect the user's request and ask exactly three concise, request-specific questions in the request's language in one message. Wait for all three answers.

Choose the three highest-impact unknowns. Cover, when relevant:

1. The primary workflow, target user, and definition of a successful result.
2. Required screens, information hierarchy, inputs, outputs, and visual direction.
3. Persistence, files, clipboard, theme/window changes, network sources, domain names, and failure behavior.

Do not ask for information already supplied. Do not start implementation, emit placeholder code, or silently answer the questions yourself before the user replies. After the reply, restate the clarified requirements briefly and proceed. Ask no additional question unless implementation would otherwise be unsafe or impossible.

## Build workflow

1. Convert the request and three answers into a small acceptance checklist.
2. Record the prompt language, create complete Chinese and English dictionaries, and plan the `FluentOS.getLanguage()` startup and live-change flow.
3. Select the minimum APIs and permissions from this document.
4. Design for the FluentOS sandbox and both light and dark themes.
5. Produce semantic HTML, self-contained CSS, and self-contained JavaScript.
6. Add explicit loading, empty, success, denial, offline, and error states that the requested workflow can reach.
7. Audit every host capability against the API and permission tables.
8. Return the deliverables in this order and in the user's language:
   - Clarified requirements
   - App name and window title
   - HTML
   - CSS
   - JavaScript
   - Permissions
   - `network.connect` domains
   - `network.image` domains
   - Verification checklist

Use `[]` for permissions and domain lists when none are needed. Domain lists contain exact public HTTPS hostnames without schemes, ports, paths, credentials, wildcards, or private/local addresses.

## Read-only system and UI APIs

These APIs require no declared permission:

| API | Contract |
| --- | --- |
| `await FluentOS.notify(title, message, type)` | Show a host notification. `type` is `info`, `success`, `warning`, or `error`. An object form is also accepted. |
| `await FluentOS.alert(title, message, type)` | Show a host alert with one button. An object form is also accepted. |
| `await FluentOS.confirm(title, message, options)` | Show a host confirmation and resolve to `true` or `false`. An object form is also accepted. |
| `await FluentOS.dialog(options)` | Show a host dialog. Use `title`, `message`/`content`, `type`, and at most three text-only `buttons`; each button may define `text`, `variant`, and a serializable `value`. |
| `FluentOS.state` | Read the latest synchronously cached host state. Treat the returned object as a snapshot. |
| `await FluentOS.getTheme()` | Read theme mode, dark state, accent values, Fluent UI mode, material, language, blur state, and window ID. |
| `await FluentOS.getThemeMode()` | Read `light`, `dark`, or `auto`. |
| `await FluentOS.getAccentColor()` | Read the current accent color. |
| `await FluentOS.getSystemState()` | Read the current host-state snapshot asynchronously. |
| `await FluentOS.getLanguage()` | Read the current language. |
| `await FluentOS.isWindowBlurEnabled()` | Read whether window blur is effective. |
| `await FluentOS.getWindowInfo()` | Read this App's ID, current title, size, and maximized state. |
| `await FluentOS.openApp(id)` | Open an available built-in system App. It cannot open another developer-created App. Handle an unavailable ID. |
| `await FluentOS.openExternal(httpsUrl)` | Open a credential-free HTTPS link in a new browser context. Never pass another scheme. |
| `FluentOS.ui.highlightButton(target, enabled)` | Apply or remove the Fluent primary-button appearance on matching buttons. `target` is a selector, element, or element collection; returns the matched count synchronously. |
| `FluentOS.ui.enableButtonGlow(target, enabled)` | Enable or disable system pointer glow on matching buttons, links, or button-like elements; returns the matched count synchronously. |

`FluentOS.ui.dialog`, `FluentOS.ui.alert`, and `FluentOS.ui.confirm` are aliases of the corresponding top-level dialog functions. `FluentOS.system.isWindowBlurEnabled()` is an alias of `FluentOS.isWindowBlurEnabled()`. Prefer the top-level forms for clarity. Prefer named wrappers over the low-level `FluentOS.call`; do not call undocumented method strings.

Listen for live visual and language changes. Language handling is mandatory for every generated App:

```js
window.addEventListener('fluentosstatechange', (event) => {
  const state = event.detail;
  // Refresh labels or visuals without discarding user work.
});
```

## Permission-gated APIs

All permissions start unavailable. An undecided declared `storage.local` permission opens one system authentication dialog before the App's first window; other permissions open their dialog on first use. Granted decisions are reused; denied decisions remain denied and are not requested again.

| Permission | Allowed API | Required behavior and limits |
| --- | --- | --- |
| `storage.local` | `await FluentOS.storage.get(key)`; `await FluentOS.storage.set(key, value)`; `await FluentOS.storage.remove(key)` | Use keys matching letters, digits, `_`, `.`, or `-`, up to 80 characters. Values must be JSON-serializable: 100 KiB per value, 128 keys, 512 KiB total UTF-8 data. |
| `clipboard.read` | `await FluentOS.clipboard.read()` | Read text only. Browser permission may still reject the call. |
| `clipboard.write` | `await FluentOS.clipboard.write(text)` | Write text only, capped at 100,000 characters. Browser permission may still reject the call. |
| `system.theme.write` | `await FluentOS.system.setTheme(mode)`; `await FluentOS.system.toggleTheme()` | `mode` is `light`, `dark`, or `auto`. This changes the global FluentOS theme; request only when central to the App. |
| `window.manage` | `await FluentOS.window.setTitle(title)`; `await FluentOS.window.setSize(width, height)` | Title is non-empty and at most 80 characters. Size is clamped to the screen and at least 420×300; resizing fails while maximized. |
| `files.readText` | `await FluentOS.files.listText(folder)`; `await FluentOS.files.readText(id)` | `folder` is `documents`, `downloads`, or `desktop`. Lists at most 200 text files. Reads text only, up to 512 KiB. |
| `files.writeText` | `await FluentOS.files.writeText(id, content)`; `await FluentOS.files.createText(name, content)` | Write text only, up to 512 KiB. New files go to Documents and must use `.txt`, `.md`, `.json`, `.html`, `.css`, or `.js` with a safe unique name. |
| `desktop.manage` | `await FluentOS.desktop.addShortcut()`; `await FluentOS.desktop.removeShortcut()` | Manage only this App's own desktop shortcut. |
| `network.request` | `await FluentOS.network.request(url, options)` | Hostname must appear in `network.connect`. HTTPS/default port only; no credentials or redirects. Methods: GET, HEAD, POST, PUT, PATCH, DELETE. Body ≤512 KiB; response body ≤2 MiB; timeout 15 seconds; credentials are omitted. |
| `network.image` | `await FluentOS.network.loadImage(url)` | Hostname must appear in `network.image`. Supports PNG, JPEG, GIF, WebP, AVIF, BMP, or ICO up to 5 MiB. Set the returned data URL or validated HTTPS URL as `img.src`. |

Network request headers must not include cookies, host/origin/referrer, connection, content length, proxy headers, or `sec-*` headers. Keep each header name within 80 characters and value within 4096 characters. At most 20 exact domains are allowed in each network allowlist.

## Permission-safe patterns

Handle a permission decision at the user action that needs it:

```js
async function savePreferences(value) {
  try {
    await FluentOS.storage.set('preferences', value);
    return true;
  } catch (error) {
    showInlineError(t('saveFailed', { message: error.message }));
    return false;
  }
}
```

Never call a gated API during initial script evaluation merely to preflight access. FluentOS performs the required `storage.local` pre-open authentication itself; call storage APIs only when the App actually needs its persisted state, and call other gated APIs only after the related feature is invoked. After a denial, keep unrelated features usable and do not automatically call the same API again.

For remote data, declare only the exact host used:

```js
async function loadTasks() {
  const response = await FluentOS.network.request('https://api.example.com/tasks');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return JSON.parse(response.body);
}
```

Required declarations for this example:

```text
permissions: [network.request]
network.connect: [api.example.com]
network.image: []
```

## Fluent visual requirements

- Enable the Developer Center option that forces FluentUI components unless the user explicitly needs fully custom controls.
- Use semantic controls and CSS variables such as `--accent`, `--accent-hover`, `--accent-contrast`, `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--border-color`, `--radius-sm`, and `--transition-fast`.
- Preserve keyboard focus visibility, labels, readable contrast, reduced-motion preferences, narrow-window layouts, and touch-sized targets.
- Do not hard-code a light-only or dark-only palette. Do not imitate system dialogs inside the App when a FluentOS dialog API is appropriate.

## Final compliance audit

Before returning code, verify all answers are yes:

- Were exactly three tailored questions asked and answered before implementation?
- Does the conversation and initial App copy match the user's prompt language?
- Do complete `zh` and `en` dictionaries cover every visible, hidden, dialog, notification, validation, failure, and accessibility string with identical keys?
- Does startup call `FluentOS.getLanguage()`, map Chinese to `zh`, English to `en`, every other system language to English, and update `document.documentElement.lang`?
- Does `fluentosstatechange` update language without losing user input or in-progress state?
- Does every host capability use a documented named `FluentOS` wrapper?
- Are direct browser persistence, network, clipboard, worker, cookie, and host-window APIs absent?
- Does every gated API have its exact permission and every permission have a real call site?
- Do network calls and images use separate exact-host allowlists?
- Does each gated call wait until the related user action and handle denial without repeated prompts?
- Are HTML, CSS, and JavaScript self-contained and free of external dependencies?
- Does the UI work in light/dark mode, narrow windows, keyboard navigation, and expected failure states?

If any check fails, revise the implementation before presenting it.
