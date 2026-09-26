const RP2_ID = 'rp-glass-2-hanabi-input';
let rp2Initialized = false;
let rp2Raf = 0;
let rp2EventsBound = false;

function getComposer() {
    return document.querySelector('#send_form')
        || document.querySelector('#send_form_sheld')
        || document.querySelector('.send_form');
}

function placeHanabi() {
    const hanabi = document.getElementById(RP2_ID);
    if (!hanabi) return;

    const composer = getComposer();
    if (!composer) {
        hanabi.style.left = '50%';
        hanabi.style.bottom = '92px';
        hanabi.style.top = 'auto';
        return;
    }

    const rect = composer.getBoundingClientRect();
    hanabi.style.left = `${Math.round(rect.left + rect.width * 0.60)}px`;
    hanabi.style.top = `${Math.round(rect.top)}px`;
    hanabi.style.bottom = 'auto';
}

function queuePlacement() {
    cancelAnimationFrame(rp2Raf);
    rp2Raf = requestAnimationFrame(placeHanabi);
}



function isSceneHeading(el) {
    if (!el || !el.matches?.('h1, h2, h3')) return false;
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return /📅|🕒|📍|🌫️/.test(text) && (text.includes('|') || text.length > 12);
}

function decorateSceneHeader(messageEl) {
    if (!messageEl) return;
    const text = messageEl.querySelector('.mes_text');
    if (!text) return;
    const heading = [...text.querySelectorAll(':scope > h1, :scope > h2, :scope > h3')].find(isSceneHeading)
        || [...text.querySelectorAll('h1, h2, h3')].find(isSceneHeading);
    if (!heading) return;
    heading.classList.add('rp2-scene-header');
    messageEl.classList.add('rp2-has-scene-header');
}

function decorateVisibleMessages() {
    document.querySelectorAll('#chat .mes').forEach(decorateSceneHeader);
}

function decorateMessageById(messageId) {
    const el = document.querySelector(`#chat .mes[mesid="${CSS.escape(String(messageId))}"]`);
    if (el) decorateSceneHeader(el);
    else requestAnimationFrame(decorateVisibleMessages);
}

function bindSceneEvents() {
    if (rp2EventsBound || typeof SillyTavern === 'undefined' || !SillyTavern.getContext) return;
    const { eventSource, event_types, eventTypes } = SillyTavern.getContext();
    const E = event_types || eventTypes;
    if (!eventSource || !E) return;
    rp2EventsBound = true;

    const renderedEvents = [
        E.USER_MESSAGE_RENDERED,
        E.CHARACTER_MESSAGE_RENDERED,
        E.MESSAGE_UPDATED,
        E.MESSAGE_SWIPED,
    ].filter(Boolean);
    renderedEvents.forEach((eventName) => eventSource.on(eventName, decorateMessageById));

    if (E.CHAT_CHANGED) eventSource.on(E.CHAT_CHANGED, () => requestAnimationFrame(decorateVisibleMessages));
    if (E.MORE_MESSAGES_LOADED) eventSource.on(E.MORE_MESSAGES_LOADED, () => requestAnimationFrame(decorateVisibleMessages));
}

function mountHanabi() {
    let hanabi = document.getElementById(RP2_ID);
    if (hanabi) {
        queuePlacement();
        return;
    }

    hanabi = document.createElement('img');
    hanabi.id = RP2_ID;
    hanabi.alt = '';
    hanabi.draggable = false;
    hanabi.src = new URL('./assets/hanabi-chibi-input.webp', import.meta.url).href;
    // Keep the mascot in BODY so fixed positioning is not clipped by the composer.
    // Visibility layering is handled by a deliberately low z-index in CSS: chat UI shows her,
    // SillyTavern drawers/settings/loading screens naturally cover her.
    document.body.appendChild(hanabi);

    hanabi.addEventListener('load', queuePlacement, { once: true });
    queuePlacement();
}

export async function init() {
    if (rp2Initialized) {
        mountHanabi();
        return;
    }

    rp2Initialized = true;
    mountHanabi();
    decorateVisibleMessages();
    bindSceneEvents();

    window.addEventListener('resize', queuePlacement, { passive: true });
    window.visualViewport?.addEventListener('resize', queuePlacement, { passive: true });
    window.visualViewport?.addEventListener('scroll', queuePlacement, { passive: true });

    console.info('[RP Glass 2] Visual Novel v0.5.0 Speaker + Emotion Engine initialized');
}

// Compatibility fallback: current third-party extensions may self-initialize
// when their module is loaded. The guard above prevents duplicate mounting.
if (typeof jQuery === 'function') {
    jQuery(() => init());
} else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(), { once: true });
} else {
    init();
}


/* ============================================================
   RP-Glass 2 v0.5.1 — Speaker/Emotion dialogue renderer
   Focused fix: [rpg:speaker|mood] -> styled spoken line.
   No MutationObserver. No polling. No full-chat rescans per mutation.
   ============================================================ */
(() => {
    const RPG_MARKER_RE = /^\s*\[rpg:(user|char|npc)\|(normal|angry|fear|sad|happy|romance|playful|cold)\]\s*$/i;
    const RPG_INLINE_RE = /\[rpg:(user|char|npc)\|(normal|angry|fear|sad|happy|romance|playful|cold)\]/ig;

    function isDialogueText(text) {
        const t = (text || '').trim();
        // User convention: **"dialogue"** becomes <strong> containing quoted text.
        // Character/NPC convention: ordinary quoted dialogue OR em-dash dialogue.
        return /^["“«„]/.test(t) || /^—\s*/.test(t) || /^-\s+/.test(t);
    }

    function applyMood(el, speaker, mood) {
        if (!el) return;
        el.classList.add('rpg-dialogue', `rpg-speaker-${speaker}`, `rpg-mood-${mood}`);
        el.dataset.rpgSpeaker = speaker;
        el.dataset.rpgMood = mood;
    }

    function findNextDialogue(markerNode, root) {
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode(node) {
                    if (node === markerNode) return NodeFilter.FILTER_SKIP;
                    if (node.closest?.('.rpg-scene-header')) return NodeFilter.FILTER_REJECT;
                    if (node.matches?.('script,style,details,summary')) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        walker.currentNode = markerNode;
        let node;
        while ((node = walker.nextNode())) {
            if (!markerNode.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) continue;

            // Strong quoted user dialogue.
            if (node.tagName === 'STRONG' && /["“«„].*["”»“]/s.test(node.textContent || '')) return node;

            // Prefer paragraph/block containing an actual spoken line.
            if (node.matches?.('p,div,blockquote')) {
                const txt = (node.textContent || '').trim();
                if (!txt || /^\[rpg:/i.test(txt)) continue;
                if (isDialogueText(txt)) return node;
            }
        }
        return null;
    }

    function processMessage(message) {
        if (!message || message.dataset.rpgEmotionProcessed === '1') return;

        const textRoot = message.querySelector('.mes_text') || message;
        const html = textRoot.innerHTML || '';
        if (!html.toLowerCase().includes('[rpg:')) {
            message.dataset.rpgEmotionProcessed = '1';
            return;
        }

        // Convert raw markers into zero-size anchors first. This works whether
        // markdown placed them in their own <p>, <div>, or alongside a <br>.
        const markerAnchors = [];
        const walker = document.createTreeWalker(textRoot, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let n;
        while ((n = walker.nextNode())) textNodes.push(n);

        for (const tn of textNodes) {
            const value = tn.nodeValue || '';
            if (!value.toLowerCase().includes('[rpg:')) continue;

            const frag = document.createDocumentFragment();
            let last = 0;
            value.replace(RPG_INLINE_RE, (full, speaker, mood, offset) => {
                if (offset > last) frag.append(document.createTextNode(value.slice(last, offset)));
                const anchor = document.createElement('span');
                anchor.className = 'rpg-emotion-marker';
                anchor.dataset.rpgSpeaker = speaker.toLowerCase();
                anchor.dataset.rpgMood = mood.toLowerCase();
                anchor.setAttribute('aria-hidden', 'true');
                frag.append(anchor);
                markerAnchors.push(anchor);
                last = offset + full.length;
                return full;
            });
            if (last < value.length) frag.append(document.createTextNode(value.slice(last)));
            tn.replaceWith(frag);
        }

        for (const marker of markerAnchors) {
            const speaker = marker.dataset.rpgSpeaker;
            const mood = marker.dataset.rpgMood;

            // If marker shares a paragraph with dialogue, style that paragraph.
            let target = null;
            const parentBlock = marker.closest('p,div,blockquote');
            if (parentBlock) {
                const clean = (parentBlock.textContent || '').trim();
                if (isDialogueText(clean)) target = parentBlock;
            }

            // Otherwise find the next dialogue block.
            if (!target) {
                let sib = marker.parentElement?.nextElementSibling;
                while (sib && !target) {
                    const txt = (sib.textContent || '').trim();
                    if (sib.tagName === 'STRONG' && /["“«„].*["”»“]/s.test(txt)) target = sib;
                    else if (sib.matches?.('p,div,blockquote') && isDialogueText(txt)) target = sib;
                    if (!target) sib = sib.nextElementSibling;
                }
            }

            // Common ST markdown case: marker + <br> + em-dash dialogue in same paragraph.
            if (!target && parentBlock) {
                const strong = parentBlock.querySelector('strong');
                if (speaker === 'user' && strong && /["“«„].*["”»“]/s.test(strong.textContent || '')) {
                    target = strong;
                } else {
                    target = parentBlock;
                }
            }

            if (target) applyMood(target, speaker, mood);
        }

        message.dataset.rpgEmotionProcessed = '1';
    }

    function processVisibleMessages() {
        document.querySelectorAll('#chat .mes').forEach(processMessage);
    }

    // Initial existing messages.
    queueMicrotask(processVisibleMessages);

    // SillyTavern event hooks when available.
    try {
        const ctx = globalThis.SillyTavern?.getContext?.();
        const es = ctx?.eventSource;
        const et = ctx?.eventTypes;
        if (es && et) {
            const events = [
                et.MESSAGE_RENDERED,
                et.CHARACTER_MESSAGE_RENDERED,
                et.USER_MESSAGE_RENDERED,
                et.MESSAGE_SWIPED,
                et.MESSAGE_UPDATED,
                et.CHAT_CHANGED
            ].filter(Boolean);
            for (const ev of new Set(events)) {
                es.on(ev, () => requestAnimationFrame(processVisibleMessages));
            }
        }
    } catch (e) {
        console.warn('[RP-Glass] emotion hooks unavailable:', e);
    }

    // One lightweight fallback for extension activation / chat navigation.
    document.addEventListener('click', (ev) => {
        if (ev.target?.closest?.('#chat, .swipe_left, .swipe_right')) {
            requestAnimationFrame(processVisibleMessages);
        }
    }, { passive: true });
})();
