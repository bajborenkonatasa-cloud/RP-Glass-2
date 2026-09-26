(() => {
    const test = document.createElement('div');

    test.textContent = '💜 RP2 JS OK 💜';

    Object.assign(test.style, {
        position: 'fixed',
        top: '120px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '2147483647',
        padding: '14px 22px',
        background: '#7b2cff',
        color: 'white',
        fontSize: '20px',
        fontWeight: 'bold',
        borderRadius: '14px',
        boxShadow: '0 0 25px #d96cff',
        pointerEvents: 'none'
    });

    document.body.appendChild(test);
})();
