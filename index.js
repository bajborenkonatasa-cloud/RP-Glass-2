const RP2_ID = 'rp-glass-2-hanabi-input';
let rp2Initialized = false;
let rp2Raf = 0;
let rp2EventsBound = false;
let rp2ComposerObserver = null;
let rp2MessageObserver = null;
const RP2_SAFE_GAP = 14;

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





function getMessageToolbar(messageEl) {
    if (!messageEl) return null;
    const candidates = [
        '.mes_buttons',
        '.mes_buttons_container',
        '.extraMesButtons',
        '.mes_edit',
        '[title*="Edit"]',
        '[title*="Редакт"]',
    ];
    for (const selector of candidates) {
        const el = messageEl.querySelector(selector);
        if (el && el.getClientRects().length) return el.closest('.mes_buttons, .mes_buttons_container, .extraMesButtons') || el;
    }
    return null;
}

function keepPeekClearOfToolbar(messageEl) {
    const chibi = messageEl?.querySelector(':scope > .rp2-hanabi-peek:not([hidden])');
    if (!chibi) return;

    // CSS owns the normal pose. JS adds only a tiny per-message correction when
    // SillyTavern's real toolbar geometry would otherwise sit under Hanabi's hair.
    chibi.style.removeProperty('--rp2-safe-lift');
    const toolbar = getMessageToolbar(messageEl);
    if (!toolbar) return;

    const mascotRect = chibi.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    const overlapsX = mascotRect.right > toolbarRect.left - RP2_SAFE_GAP
        && mascotRect.left < toolbarRect.right + RP2_SAFE_GAP;
    const overlapsY = mascotRect.bottom > toolbarRect.top - RP2_SAFE_GAP
        && mascotRect.top < toolbarRect.bottom + RP2_SAFE_GAP;
    if (!overlapsX || !overlapsY) return;

    const lift = Math.ceil(mascotRect.bottom - toolbarRect.top + RP2_SAFE_GAP);
    chibi.style.setProperty('--rp2-safe-lift', `${Math.max(0, Math.min(lift, 104))}px`);
}

function queuePeekSafeZone(messageEl) {
    requestAnimationFrame(() => keepPeekClearOfToolbar(messageEl));
}

function refreshPeekSafeZones() {
    document.querySelectorAll('#chat .mes.rp2-has-scene-header').forEach(queuePeekSafeZone);
}

function observeMessageGeometry(messageEl) {
    if (!messageEl || typeof ResizeObserver === 'undefined') return;
    if (!rp2MessageObserver) {
        rp2MessageObserver = new ResizeObserver((entries) => {
            for (const entry of entries) queuePeekSafeZone(entry.target);
        });
    }
    if (messageEl.dataset.rp2SafeObserved === '1') return;
    messageEl.dataset.rp2SafeObserved = '1';
    rp2MessageObserver.observe(messageEl);
}

const RP2_NAV_RE = /\[hanabi\s*:\s*(dreamy|sad|angry|happy|playful)(?:\s*\|\s*(peek|run|sleep|input|off))?\s*\]/ig;
const RP2_EMOTION_ASSETS = {
    dreamy: './assets/hanabi-thoughts-dreamy.webp',
    sad: './assets/hanabi-thoughts-sad.webp',
    angry: './assets/hanabi-thoughts-angry.webp',
    happy: './assets/hanabi-thoughts-happy.webp',
    playful: './assets/hanabi-thoughts-happy.webp',
};
const RP2_CHIBI_ASSETS = {
    peek: './assets/hanabi-chibi-peek.webp',
    run: './assets/hanabi-chibi-run.webp',
    sleep: './assets/hanabi-chibi-sleep.webp',
};

// v0.8.2 — SAFE emotion engine.
// IMPORTANT ROLES:
//   1) Header Hanabi (.rp2-hanabi-peek) is ALWAYS the original peeking image.
//   2) Thoughts portrait changes emotion from the unspoken thoughts only.
//   3) Composer/input Hanabi changes between input/run/sleep from scene meaning.
const RP2_EMOTION_HINTS = {
    angry: [['ненавиж',4],['ярост',4],['бесит',4],['злост',3],['злой',3],['зла',3],['раздраж',2],['убью',4],['убить',3],['чёрт',2],['черт',2],['сука',3],['блять',3],['бляд',3],['hate',4],['furious',4],['angry',3],['rage',4],['damn',2],['fuck',3]],
    sad: [['слез',3],['плак',3],['рыда',4],['больно',3],['боль',2],['груст',3],['печал',3],['одинок',3],['разбит',3],['отчаян',4],['потеря',2],['потерять',2],['страшно',2],['боюсь',2],['cry',3],['tears',3],['sad',3],['hurt',2],['lonely',3],['broken',3],['despair',4]],
    happy: [['улыб',2],['сме',2],['хихик',3],['счаст',3],['радост',3],['весел',3],['доволь',2],['игрив',3],['дразн',2],['приятно',1],['нравится',1],['обожаю',3],['smil',2],['laugh',2],['happy',3],['joy',3],['playful',3],['teas',2]],
};
const RP2_INPUT_CHIBI_HINTS = {
    sleep: [['засып',4],['уснул',4],['уснула',4],['спит',4],['дрем',4],['сонн',3],['подуш',2],['sleep',4],['asleep',4],['doz',4],['sleepy',3],['pillow',2]],
    run: [['беж',4],['побеж',4],['убег',4],['догон',3],['преслед',3],['ринул',3],['рванул',3],['мчал',3],['тороп',2],['вбеж',3],['выбеж',3],['run',4],['running',4],['chase',3],['rush',3],['sprint',4]],
};
const RP2_INPUT_CHIBI_ASSETS = {
    input: './assets/hanabi-chibi-input.webp',
    run: './assets/hanabi-chibi-run.webp',
    sleep: './assets/hanabi-chibi-sleep.webp',
};

function rp2PlainText(root) {
    if (!root) return '';
    const clone = root.cloneNode(true);
    clone.querySelectorAll('summary, img, story_footer, story-footer, script, style').forEach((el) => el.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function rp2Score(text, hints) {
    let score = 0;
    for (const [needle, weight] of hints) {
        let at = 0;
        while ((at = text.indexOf(needle, at)) !== -1) { score += weight; at += Math.max(1, needle.length); }
    }
    return score;
}
function detectThoughtEmotion(messageEl) {
    const thoughts = [...messageEl.querySelectorAll('details')].find(isThoughtsDetails);
    const source = rp2PlainText(thoughts);
    if (!source) return 'dreamy';
    const scores = Object.entries(RP2_EMOTION_HINTS).map(([key,hints]) => [key, rp2Score(source,hints)]).sort((a,b)=>b[1]-a[1]);
    return scores[0] && scores[0][1] >= 3 ? scores[0][0] : 'dreamy';
}
function detectInputChibi(messageEl) {
    const source = rp2PlainText(messageEl?.querySelector('.mes_text'));
    if (!source) return 'input';
    const sleep = rp2Score(source, RP2_INPUT_CHIBI_HINTS.sleep);
    const run = rp2Score(source, RP2_INPUT_CHIBI_HINTS.run);
    if (sleep >= 4 && sleep > run) return 'sleep';
    if (run >= 4 && run > sleep) return 'run';
    return 'input';
}
function applyInputChibi(kind) {
    const hanabi = document.getElementById(RP2_ID);
    if (!hanabi) return;
    const safeKind = RP2_INPUT_CHIBI_ASSETS[kind] ? kind : 'input';
    hanabi.dataset.rp2InputChibi = safeKind;
    hanabi.src = new URL(RP2_INPUT_CHIBI_ASSETS[safeKind], import.meta.url).href;
    queuePlacement();
}

function readHanabiNavigator(messageEl) {
    const text = messageEl?.querySelector('.mes_text');
    if (!text) return { emotion: 'dreamy' };
    let state = { emotion: detectThoughtEmotion(messageEl) };

    // Optional legacy manual override: emotion is still honored.
    // The old chibi part is consumed but NEVER changes the header mascot.
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
        const original = node.nodeValue || '';
        node.nodeValue = original.replace(RP2_NAV_RE, (_, emotion) => {
            state.emotion = String(emotion).toLowerCase();
            return '';
        });
    });
    messageEl.dataset.rp2Emotion = state.emotion;
    return state;
}

function applyHanabiState(messageEl, state) {
    if (!messageEl || !state) return;

    // ONLY the portrait inside “Распаковать мысли…” changes emotion.
    const portrait = messageEl.querySelector('.rpg-thought-hanabi');
    const emotionAsset = RP2_EMOTION_ASSETS[state.emotion] || RP2_EMOTION_ASSETS.dreamy;
    if (portrait) portrait.src = new URL(emotionAsset, import.meta.url).href;

    // Header Hanabi is deliberately untouched: always hanabi-chibi-peek.webp.
}

function decorateHanabiNavigator(messageEl) {
    const state = readHanabiNavigator(messageEl);
    applyHanabiState(messageEl, state);
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
        peek.className = 'rp2-hanabi-peek rp2-chibi-peek';
        peek.alt = '';
        peek.draggable = false;
        peek.setAttribute('aria-hidden', 'true');
        peek.src = new URL('./assets/hanabi-chibi-peek.webp', import.meta.url).href;
        messageEl.appendChild(peek);
        peek.addEventListener('load', () => queuePeekSafeZone(messageEl), { once: true });
    }
    observeMessageGeometry(messageEl);
    queuePeekSafeZone(messageEl);
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
    const messages = [...document.querySelectorAll('#chat .mes')];
    messages.forEach((messageEl) => {
        decorateSceneHeader(messageEl);
        decorateThoughts(messageEl);
        decorateHanabiNavigator(messageEl);
    });
    const latest = messages.at(-1);
    if (latest) applyInputChibi(detectInputChibi(latest));
}

function decorateMessageById(messageId) {
    const el = document.querySelector(`#chat .mes[mesid="${CSS.escape(String(messageId))}"]`);
    if (el) {
        decorateSceneHeader(el);
        decorateThoughts(el);
        decorateHanabiNavigator(el);
        applyInputChibi(detectInputChibi(el));
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

function watchComposerGeometry() {
    const composer = getComposer();
    if (!composer || typeof ResizeObserver === 'undefined') return;
    rp2ComposerObserver?.disconnect();
    rp2ComposerObserver = new ResizeObserver(() => queuePlacement());
    rp2ComposerObserver.observe(composer);
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
    watchComposerGeometry();
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

    window.addEventListener('resize', () => { queuePlacement(); refreshPeekSafeZones(); }, { passive: true });
    window.visualViewport?.addEventListener('resize', () => { queuePlacement(); refreshPeekSafeZones(); }, { passive: true });
    window.visualViewport?.addEventListener('scroll', queuePlacement, { passive: true });

    console.info('[RP Glass 2] Visual Novel v0.8.2 Correct Roles Emotion Engine initialized');
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
