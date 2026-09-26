(() => {
    'use strict';

    const old = document.getElementById('rp2-hanabi-test');
    if (old) old.remove();

    const hanabi = document.createElement('img');

    hanabi.id = 'rp2-hanabi-test';
    hanabi.src =
        '/scripts/extensions/third-party/RP-Glass-2/assets/hanabi-chibi-input.webp';

    hanabi.alt = 'Hanabi';
    hanabi.draggable = false;

    Object.assign(hanabi.style, {
        position: 'fixed',
        width: '220px',
        height: 'auto',

        left: '50%',
        bottom: '105px',

        transform: 'translateX(-50%)',

        zIndex: '2147483647',

        pointerEvents: 'none',
        userSelect: 'none',

        display: 'block',
        opacity: '1'
    });

    hanabi.onload = () => {
        console.log('[RP Glass 2] HANABI LOADED',
            hanabi.naturalWidth,
            hanabi.naturalHeight
        );
    };

    hanabi.onerror = (error) => {
        console.error('[RP Glass 2] HANABI FAILED', error);

        const warning = document.createElement('div');
        warning.textContent = '❌ HANABI IMAGE FAILED';

        Object.assign(warning.style, {
            position: 'fixed',
            top: '120px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '2147483647',
            padding: '12px',
            background: '#a00030',
            color: '#fff'
        });

        document.body.appendChild(warning);
    };

    document.body.appendChild(hanabi);
})();
