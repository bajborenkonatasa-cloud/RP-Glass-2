# RP Glass 2 — v0.5.0 Speaker + Emotion Engine

Adds explicit, lightweight dialogue styling for USER / CHAR / NPC and moods: normal, angry, fear, sad, happy, romance, playful, cold.

No MutationObserver, no polling, no full-chat emotion scan. Existing Hanabi and Scene Header placement are unchanged.

Markup contract for the RP prompt (next step):
`<span class="rp-dialogue rp-char rp-angry">“Dialogue”</span>`

Speaker classes: `rp-user`, `rp-char`, `rp-npc`. Mood classes: `rp-angry`, `rp-fear`, `rp-sad`, `rp-happy`, `rp-romance`, `rp-playful`, `rp-cold`.
