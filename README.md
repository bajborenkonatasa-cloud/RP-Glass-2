# RP Glass 2 — v0.4.0 Scene Header

Working Hanabi v0.3.4 placement is preserved.

This build adds a mobile-safe scene header: the existing generated date/time/place/atmosphere heading is visually lifted into the unused message-header area. SillyTavern core `.mes`, `.mes_block`, and `.mes_header` display/flex structure is not rewritten.

No MutationObserver, polling timer, or full-chat mutation scan. Existing messages are decorated once; new/rendered/swiped messages use SillyTavern events.
