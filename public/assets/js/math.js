// math.js - KaTeX helper for AcaDE-QUIZ

export function renderMath(element) {
    if (!element) return;
    if (typeof window !== 'undefined') {
        if (!window.renderMathInElement) {
            setTimeout(() => renderMath(element), 60);
            setTimeout(() => renderMath(element), 250);
            return;
        }
        try {
            window.renderMathInElement(element, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true }
                ],
                output: 'html',
                throwOnError: false,
                ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'annotation'],
                ignoredClasses: ['katex', 'no-math']
            });
        } catch (e) {
            console.warn('KaTeX rendering error:', e);
        }
    }
}

if (typeof window !== 'undefined') {
    window.renderMath = renderMath;
}
