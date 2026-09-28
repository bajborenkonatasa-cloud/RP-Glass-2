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
    // Sleep gets contextual clues too, not only literal "sleep" words. This lets scenes like
    // "ran to the bed, tucked under the blanket and closed her eyes" correctly end on sleep.
    sleep: [
        ['засып',5],['уснул',5],['уснула',5],['спит',5],['дрем',5],['сонн',4],
        ['кроват',3],['постел',2],['одеял',3],['укут',3],['закут',3],['подуш',3],
        ['закрыл глаза',4],['закрыла глаза',4],['закрывает глаза',4],['закрывая глаза',4],
        ['прикрыл глаза',3],['прикрыла глаза',3],['легла',2],['лёг',2],['лег под',2],['лежала',1],
        ['ночь',1],['ночью',1],['ко сну',3],['пора спать',5],
        ['sleep',5],['asleep',5],['doz',5],['sleepy',4],['bed',3],['blanket',3],['pillow',3],
        ['closed her eyes',4],['closed his eyes',4],['tucked',3],['curled up',2]
    ],
    run: [
        ['беж',4],['побеж',4],['убег',4],['догон',3],['преслед',3],['ринул',3],['рванул',3],
        ['мчал',3],['тороп',2],['вбеж',3],['выбеж',3],['погон',3],['спринт',4],
        ['run',4],['running',4],['chase',3],['rush',3],['sprint',4]
    ],
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
function rp2StableChibiFallback(text) {
    // Stable pseudo-random fallback: the same message keeps the same mascot after re-renders.
    // Mostly default Hanabi, with a small chance for the two special poses so they are not wasted.
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    const roll = (hash >>> 0) % 100;
    if (roll < 12) return 'sleep';
    if (roll < 24) return 'run';
    return 'input';
}

function detectInputChibi(messageEl) {
    const source = rp2PlainText(messageEl?.querySelector('.mes_text'));
    if (!source) return 'input';
    const sleep = rp2Score(source, RP2_INPUT_CHIBI_HINTS.sleep);
    const run = rp2Score(source, RP2_INPUT_CHIBI_HINTS.run);

    // Sleep wins ties because movement that ends in bed/under a blanket should display the final mood,
    // not the earlier verb "ran". Strong running still wins when there is no real sleep context.
    if (sleep >= 4 && sleep >= run) return 'sleep';
    if (run >= 4 && run > sleep) return 'run';
    return rp2StableChibiFallback(source);
}
function applyInputChibi(kind) {
    const hanabi = document.getElementById(RP2_ID);
    if (!hanabi) return;
    const safeKind = RP2_INPUT_CHIBI_ASSETS[kind] ? kind : 'input';
    hanabi.dataset.rp2InputChibi = safeKind;
    hanabi.src = new URL(RP2_INPUT_CHIBI_ASSETS[safeKind], import.meta.url).href;
    replayHanabiEffect(hanabi, 'rp2-chibi-change');
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
    if (portrait) {
        const nextSrc = new URL(emotionAsset, import.meta.url).href;
        if (portrait.src !== nextSrc) {
            portrait.src = nextSrc;
            replayHanabiEffect(portrait, 'rp2-emotion-change');
        }
    }

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


// v0.9.0 — Dialogue + Book Reader decorator.
// Authoring convention requested by the user:
//   **"CHAR dialogue"** -> orange CHAR class
//   "NPC dialogue"     -> turquoise NPC class
// Colors/fonts stay in CSS variables so they are user-editable.
function isIndependentReader(details) {
    if (!details) return false;
    if (details.closest('story_footer, story-footer')) return true;
    const summary = details.querySelector(':scope > summary');
    const label = (summary?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return label.includes('независимый читатель') || label.includes('independent reader');
}

function decorateIndependentReader(messageEl) {
    const text = messageEl?.querySelector('.mes_text');
    if (!text) return;
    text.querySelectorAll('details').forEach((details) => {
        if (isIndependentReader(details)) details.classList.add('rpg-independent-reader');
    });
}

function wrapQuotedTextNode(node, className) {
    if (!node?.nodeValue || node.parentElement?.closest('.rp-dialogue, summary, script, style')) return;
    const raw = node.nodeValue;
    const re = /(["“«])([^"”»\n]{1,900})(["”»])/g;
    if (!re.test(raw)) return;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let m;
    while ((m = re.exec(raw))) {
        if (m.index > last) frag.append(document.createTextNode(raw.slice(last, m.index)));
        const span = document.createElement('span');
        span.className = `rp-dialogue ${className}`;
        span.textContent = m[0];
        frag.append(span);
        last = m.index + m[0].length;
    }
    if (last < raw.length) frag.append(document.createTextNode(raw.slice(last)));
    node.replaceWith(frag);
}

function wrapLiteralCharMarkdown(node) {
    if (!node?.nodeValue || node.parentElement?.closest('.rp-dialogue, summary, script, style, code, pre')) return;
    const raw = node.nodeValue;
    // Fallback for SillyTavern/streaming cases where **"..."** stays literal text.
    // Supports straight, curly and guillemet quotes and removes the visible ** markers.
    const re = /\*\*(["“«][^"”»\n]{1,900}["”»])\*\*/g;
    if (!re.test(raw)) return;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let m;
    while ((m = re.exec(raw))) {
        if (m.index > last) frag.append(document.createTextNode(raw.slice(last, m.index)));
        const span = document.createElement('span');
        span.className = 'rp-dialogue rp-char';
        span.textContent = m[1];
        frag.append(span);
        last = m.index + m[0].length;
    }
    if (last < raw.length) frag.append(document.createTextNode(raw.slice(last)));
    node.replaceWith(frag);
}

function decorateDialogues(messageEl) {
    const text = messageEl?.querySelector('.mes_text');
    if (!text) return;

    // First catch literal **"..."** if Markdown did NOT convert it to <strong>.
    const literalWalker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    const literalNodes = [];
    while (literalWalker.nextNode()) literalNodes.push(literalWalker.currentNode);
    literalNodes.forEach(wrapLiteralCharMarkdown);

    // **"..."** normally renders by Markdown as <strong>/<b>; mark it as CHAR.
    text.querySelectorAll('strong, b').forEach((el) => {
        if (el.closest('details, summary, .rp-dialogue')) return;
        const value = (el.textContent || '').trim();
        if (/^["“«].+["”»]$/s.test(value)) el.classList.add('rp-dialogue', 'rp-char');
    });

    // Plain quoted speech outside CHAR markup becomes NPC dialogue.
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        if (!parent) continue;
        if (parent.closest('details, summary, .rp-dialogue, strong, b, code, pre, h1, h2, h3')) continue;
        nodes.push(node);
    }
    nodes.forEach((node) => wrapQuotedTextNode(node, 'rp-npc'));
}

function replayHanabiEffect(el, className) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
}

function decorateVisibleMessages() {
    const messages = [...document.querySelectorAll('#chat .mes')];
    messages.forEach((messageEl) => {
        decorateSceneHeader(messageEl);
        decorateThoughts(messageEl);
        decorateHanabiNavigator(messageEl);
        decorateIndependentReader(messageEl);
        decorateDialogues(messageEl);
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
        decorateIndependentReader(el);
        decorateDialogues(el);
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

let rp2ChatMutationObserver = null;
let rp2MutationQueued = false;

function watchDialogueEdits() {
    const chat = document.querySelector('#chat');
    if (!chat || typeof MutationObserver === 'undefined') return;
    rp2ChatMutationObserver?.disconnect();

    rp2ChatMutationObserver = new MutationObserver((mutations) => {
        // SillyTavern can replace message HTML after edit/streaming without creating
        // a fresh .mes node. Re-run the idempotent dialogue decorator on changed messages.
        const changed = new Set();
        for (const mutation of mutations) {
            const target = mutation.target?.nodeType === Node.TEXT_NODE
                ? mutation.target.parentElement
                : mutation.target;
            const mes = target?.closest?.('#chat .mes');
            if (mes) changed.add(mes);
            for (const node of mutation.addedNodes || []) {
                const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
                const addedMes = el?.closest?.('#chat .mes') || el?.querySelector?.('#chat .mes');
                if (addedMes) changed.add(addedMes);
            }
        }
        if (!changed.size || rp2MutationQueued) return;
        rp2MutationQueued = true;
        requestAnimationFrame(() => {
            rp2MutationQueued = false;
            changed.forEach((mes) => decorateDialogues(mes));
        });
    });
    rp2ChatMutationObserver.observe(chat, { childList: true, subtree: true, characterData: true });
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
    watchDialogueEdits();

    window.addEventListener('resize', () => { queuePlacement(); refreshPeekSafeZones(); }, { passive: true });
    window.visualViewport?.addEventListener('resize', () => { queuePlacement(); refreshPeekSafeZones(); }, { passive: true });
    window.visualViewport?.addEventListener('scroll', queuePlacement, { passive: true });

    console.info('[RP Glass 2] Visual Novel v0.9.6 Live Dialogue + Book Reader + Emotion Engine initialized');
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

// v1.0.1 — Opal UI shell: compact drawer settings + safer native layout styling.
const RP2_OPAL_KEY = 'rpGlass2OpalUI';
const RP2_OPAL_GLOW_KEY = 'rpGlass2OpalGlow';
const RP2_OPAL_OPEN_KEY = 'rpGlass2OpalSettingsOpen';
const RP2_OPAL_PALETTE_KEY = 'rpGlass2OpalPalette';

function rp2ReadBool(key, fallback = true) {
    const value = localStorage.getItem(key);
    return value == null ? fallback : value === '1';
}
function rp2ApplyOpalUI() {
    document.body.classList.toggle('rp2-opal-ui', rp2ReadBool(RP2_OPAL_KEY, true));
    document.body.classList.toggle('rp2-opal-motion', rp2ReadBool(RP2_OPAL_GLOW_KEY, true));
    const palette = localStorage.getItem(RP2_OPAL_PALETTE_KEY) || 'violet';
    document.body.dataset.rp2Opal = ['ocean','fire','moss'].includes(palette) ? palette : ({violet:'ocean',rose:'fire'}[palette] || 'ocean');
}
function rp2MountOpalSettings() {
    if (document.getElementById('rp2-opal-settings')) return;
    const host = document.querySelector('#extensions_settings2, #extensions_settings, .extensions_settings, #extensionsMenu');
    if (!host) return;
    const panel = document.createElement('div');
    panel.id = 'rp2-opal-settings';
    panel.className = 'rp2-opal-settings';
    panel.innerHTML = `
      <button class="rp2-opal-title" type="button" aria-expanded="false">
        <span class="rp2-opal-gem">💎</span><b>RP Glass · Opal UI</b><small>v1.2.0</small><span class="rp2-opal-chevron">⌄</span>
      </button>
      <div class="rp2-opal-body">
        <label><input id="rp2-opal-enabled" type="checkbox"> Оформлять интерфейс Tavern</label>
        <label><input id="rp2-opal-motion" type="checkbox"> Живые переливы опала</label>
        <label class="rp2-opal-select-row"><span>Оттенок опала</span><select id="rp2-opal-palette"><option value="ocean">Ocean Opal</option><option value="fire">Fire Opal 🔥</option><option value="moss">Moss Opal</option></select></label>
        <div class="rp2-opal-note">Чат и поле ввода не трогаются этим слоем — твой Custom CSS остаётся главным.</div>
      </div>`;
    host.appendChild(panel);
    const title = panel.querySelector('.rp2-opal-title');
    const enabled = panel.querySelector('#rp2-opal-enabled');
    const motion = panel.querySelector('#rp2-opal-motion');
    const palette = panel.querySelector('#rp2-opal-palette');
    const setOpen = (open) => {
        panel.classList.toggle('is-open', open);
        title.setAttribute('aria-expanded', open ? 'true' : 'false');
        localStorage.setItem(RP2_OPAL_OPEN_KEY, open ? '1' : '0');
    };
    setOpen(rp2ReadBool(RP2_OPAL_OPEN_KEY, false));
    title.addEventListener('click', () => setOpen(!panel.classList.contains('is-open')));
    enabled.checked = rp2ReadBool(RP2_OPAL_KEY, true);
    motion.checked = rp2ReadBool(RP2_OPAL_GLOW_KEY, true);
    { const saved = localStorage.getItem(RP2_OPAL_PALETTE_KEY) || 'ocean'; palette.value = ({violet:'ocean',rose:'fire'}[saved] || saved); if (!['ocean','fire','moss'].includes(palette.value)) palette.value='ocean'; }
    enabled.addEventListener('change', () => { localStorage.setItem(RP2_OPAL_KEY, enabled.checked ? '1' : '0'); rp2ApplyOpalUI(); });
    motion.addEventListener('change', () => { localStorage.setItem(RP2_OPAL_GLOW_KEY, motion.checked ? '1' : '0'); rp2ApplyOpalUI(); });
    palette.addEventListener('change', () => { localStorage.setItem(RP2_OPAL_PALETTE_KEY, palette.value); rp2ApplyOpalUI(); });
}

rp2ApplyOpalUI();
const rp2OpalMountTimer = setInterval(() => {
    rp2ApplyOpalUI();
    rp2MountOpalSettings();
    if (document.getElementById('rp2-opal-settings')) clearInterval(rp2OpalMountTimer);
}, 700);
setTimeout(() => clearInterval(rp2OpalMountTimer), 20000);
