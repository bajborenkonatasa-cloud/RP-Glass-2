(() => {
    'use strict';

    const ID = 'rp-glass-2-hanabi-input';
    let rafId = 0;

    function findComposer() {
        return document.querySelector('#send_form')
            || document.querySelector('#send_form_sheld')
            || document.querySelector('.send_form');
    }

    function positionHanabi() {
        const hanabi = document.getElementById(ID);
        const composer = findComposer();
        if (!hanabi || !composer) return;

        const rect = composer.getBoundingClientRect();
        const width = Math.min(230, Math.max(180, window.innerWidth * 0.31));

        hanabi.style.width = `${width}px`;
        hanabi.style.left = `${Math.round(rect.left + rect.width * 0.50)}px`;
        hanabi.style.top = `${Math.round(rect.top)}px`;
    }

    function queuePosition() {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(positionHanabi);
    }

    function mount() {
        if (document.getElementById(ID)) return;

        const img = document.createElement('img');
        img.id = ID;
        img.className = 'rp-glass-2-hanabi-input';
        img.alt = '';
        img.draggable = false;
        img.src = '/scripts/extensions/third-party/RP-Glass-2/assets/hanabi-chibi-input.webp';

        document.body.appendChild(img);
        queuePosition();
    }

    function boot() {
        mount();
        window.addEventListener('resize', queuePosition, { passive: true });
        window.visualViewport?.addEventListener('resize', queuePosition, { passive: true });
        window.visualViewport?.addEventListener('scroll', queuePosition, { passive: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();\n