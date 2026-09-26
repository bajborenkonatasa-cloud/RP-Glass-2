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

    // v0.6.6 — one lightweight peeking Hanabi in the free header corner.
    // No observers/timers; this runs only through the same safe message decoration pass.
    if (!messageEl.querySelector(':scope > .rp2-hanabi-peek')) {
        const peek = document.createElement('img');
        peek.className = 'rp2-hanabi-peek';
        peek.alt = '';
        peek.draggable = false;
        peek.setAttribute('aria-hidden', 'true');
        peek.src = new URL('./assets/hanabi-chibi-peek.webp', import.meta.url).href;
        messageEl.appendChild(peek);
    }
}

function isThoughtsDetails(details) {
    if (!details || details.closest('story_footer, story-footer')) return false;
    const summary = details.querySelector(':scope > summary');
    const label = (summary?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return label.includes('распаковать мысли') || label.includes('мысли');
}

function decorateThoughts(messageEl) {
    if (!messageEl) return;
    const text = messageEl.querySelector('.mes_text');
    if (!text) return;

    text.querySelectorAll('details').forEach((details) => {
        if (!isThoughtsDetails(details)) return;
        details.classList.add('rpg-thoughts');
        if (details.querySelector(':scope > .rpg-thought-hanabi')) return;

        const portrait = document.createElement('img');
        portrait.className = 'rpg-thought-hanabi';
        portrait.alt = '';
        portrait.draggable = false;
        portrait.setAttribute('aria-hidden', 'true');
        portrait.src = new URL('./assets/hanabi-thoughts-dreamy.webp', import.meta.url).href;

        const summary = details.querySelector(':scope > summary');
        if (summary) summary.insertAdjacentElement('afterend', portrait);
        else details.prepend(portrait);
    });
}

function decorateVisibleMessages() {
    document.querySelectorAll('#chat .mes').forEach((messageEl) => {
        decorateSceneHeader(messageEl);
        decorateThoughts(messageEl);
    });
}

function decorateMessageById(messageId) {
    const el = document.querySelector(`#chat .mes[mesid="${CSS.escape(String(messageId))}"]`);
    if (el) {
        decorateSceneHeader(el);
        decorateThoughts(el);
    }
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

    console.info('[RP Glass 2] Visual Novel v0.6.6 Peek Hanabi initialized');
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
