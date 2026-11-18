# Custom Toast Implementation Plan

## Goal

Add a small, reusable in-app toast for short confirmations and recoverable action failures. Keep field validation and form submission errors inline where the user can act on them.

## Implementation

1. Add a root-level ToastProvider and useToast() API with success, error, and info variants.
2. Render one accessible toast above app content, below the status-bar safe area. Use a dismiss control, automatic timeout, and reduced-motion-aware entrance/exit.
3. Style it only with useTheme() tokens: surface, border, text, accentText, greenSoft, danger, dangerSoft, primary, blueSoft, radius.lg, space.md, type.body, and the shared shadow.
4. Use localized copy in English and Hindi. Integrate it into request-sent and bookmark add/remove actions; keep existing inline request/form errors intact.

## Acceptance

- Toasts remain visible above navigation changes and respect top safe areas.
- New toasts replace prior ones; dismissal and automatic timeout both work.
- Success, error, and info states use icon, text, and color cues rather than color alone.
- Screen readers announce each message and can reach the dismiss button.
- No screen layout shifts; reduced-motion preference removes the entrance movement.
- Mobile typecheck and lint/build checks pass; verify the active emulator screen after reload.
