# Design QA

source visual truth path: `design/reference-option-1.png`
implementation screenshot path: `design/implementation-v2.2-success.png`
full-view comparison: `design/comparison-v2.2-final.png`
focused sidebar comparison: `design/comparison-sidebar-v2.2-final.png`
focused center comparison: `design/comparison-center-v2.2-final.png`
viewport: `1536 × 1024 CSS px`
source pixels: `1536 × 1024`
implementation pixels: `1536 × 1024`
deviceScaleFactor: `1`
density normalization: none required; source and implementation were compared at identical pixel dimensions
state: completed `电商客服 · 综合判断` conversation with Jev/OpenAI result cards, comparison summary, execution timeline, and question-mapping JSON visible

## Browser-rendered evidence

The managed browser policy in this environment blocks navigation to localhost, so the production `index.html`, `styles.css`, compiled `dist/public/app.js`, and production image assets were rendered in Chromium through the DevTools `Page.setDocumentContent` API at the exact target viewport. The completed provider values were injected into the normal production DOM after the turn was created so the visual comparison did not consume external API quota.

Primary interactions tested in the browser-rendered production bundle:

1. First message creates exactly one history Session.
2. Switching from `综合判断` to `客户情绪` clears the middle workspace while keeping history.
3. Clicking the history Session restores its original scenario and middle conversation.
4. `新对话` clears the current workspace without deleting previous Sessions.
5. Creating a second Session leaves two history entries; a subsequent new chat still leaves both entries.
6. History container measured equal `clientWidth` and `scrollWidth`; computed `overflow-x` is `hidden`.
7. OpenAI model control defaults to `gpt-5.6-luna`.
8. Chromium reported zero uncaught runtime exceptions and zero browser log errors during the interaction check.

Server smoke check also passed with both provider environment variables present: `/api/health` returned `providers.jev = true` and `providers.openai = true`.

## Comparison history

### Iteration 1 — blocked

- [P1] History was implemented as transient message-like state rather than durable conversation Sessions.
- [P1] Scenario changes did not reset the middle workspace, so results from different scenarios could visually mix.
- [P1] `新对话` discarded the visible history state.
- [P2] The history region could grow wider than its sidebar and expose a horizontal scrollbar.
- [P1] The implementation was substantially denser than the selected reference: wrong three-column proportions, undersized typography, compressed result cards, compressed composer, and right-side inspector spacing that did not match the source.
- [P2] The OpenAI default was not aligned with the user's requested Luna default.

Fixes made:

- Added persisted `ConversationSession` state backed by `localStorage`, with restore/save behavior for conversation HTML, scenario, metrics, inspector content, and active inspector tab.
- Scenario changes now persist the current Session then reset only the active workspace.
- `新对话` now saves the current Session and starts an empty workspace; prior Sessions remain in history.
- History titles are single-line ellipsized rows; `overflow-x: hidden` is enforced and scrollbars are visually suppressed.
- Desktop geometry was rebuilt around the selected `1536 × 1024` source: approximately `272px / 650px / 571px` for sidebar/chat/inspector, with matching 14px gaps and card spacing.
- Result cards, comparison panel, right-side step track, execution timeline, mapping JSON, and tall composer were resized against the reference.
- Source icon assets were used for the brand, sidebar scenes, history, settings, appearance, and composer controls.
- OpenAI now defaults to `gpt-5.6-luna` in both the frontend selector and server fallback.

### Iteration 2 — passed

Post-fix evidence is in `design/implementation-v2.2-success.png` and the side-by-side comparison files above. No actionable P0/P1/P2 design differences remain at the reference viewport.

Expected data-dependent differences that are not fidelity failures:

- The source mock contains several pre-populated history Sessions, while a fresh build only shows Sessions the user has actually created.
- The source mock labels OpenAI as `gpt-5.6-sol`; the implementation intentionally shows `gpt-5.6-luna` because the user explicitly changed the default model.
- Timestamps and measured latency values are runtime data and therefore differ from the static source mock.

## Required fidelity surfaces

- **Fonts and typography:** system/Inter-style sans-serif stack, weights, line heights, truncation, and hierarchy match the reference closely. History titles use single-line ellipsis; small metadata stays readable without the earlier 8px compression.
- **Spacing and layout rhythm:** main desktop tracks, header height, sidebar padding, result-card sizing, comparison panel, inspector timeline, and composer height were aligned against the 1536px source. Scrollbars are hidden visually while scroll behavior remains available.
- **Colors and visual tokens:** blue selection states, pale green completion states, light gray borders, white panels, dark JSON surface, and muted metadata tones follow the source palette.
- **Image quality and asset fidelity:** visible non-standard icons used for the main brand/sidebar/header/composer were cropped from the selected visual target and used as raster assets rather than approximated with CSS drawings.
- **Copy/content:** Chinese labels and information hierarchy follow the selected design. `gpt-5.6-luna` is the one intentional copy difference required by the user.

## Accessibility / interaction notes

- Keyboard focus rings remain enabled for buttons, inputs, textareas, and selects.
- History entries remain real buttons and are keyboard-activatable.
- Scrollbar visuals are suppressed for fidelity, but mouse wheel/trackpad/keyboard scrolling remains available.
- The visual QA does not claim full WCAG conformance; screen-reader labeling and contrast under all browser/OS modes would need a separate accessibility audit.

## Follow-up polish

- [P3] Runtime content can create slightly different vertical density than the static source depending on question count and long labels; current rows preserve the source proportions for the default comprehensive scenario.

final result: passed
