import { els } from './dom.js';

/* ========================================================================
   UTILITY FUNCTIONS
   ======================================================================== */
export function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function formatEuropeanDateTime(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} la ora ${hours}:${mins}`;
}
window.formatEuropeanDateTime = formatEuropeanDateTime;

export function parseImageUrls(imageVal) {
    if (!imageVal) return [];
    if (Array.isArray(imageVal)) return imageVal.filter(Boolean);
    if (typeof imageVal === 'string') {
        const trimmed = imageVal.trim();
        if (!trimmed) return [];
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.filter(Boolean);
            } catch (e) {}
        }
        if (trimmed.includes('\n')) {
            return trimmed.split('\n').map(s => s.trim()).filter(Boolean);
        }
        if (trimmed.includes(',') && !trimmed.startsWith('data:')) {
            return trimmed.split(',').map(s => s.trim()).filter(Boolean);
        }
        return [trimmed];
    }
    return [];
}

export function cleanSymbols(str) {
    if (!str) return '';
    return str
        .replace(/≥/g, '>=')
        .replace(/≤/g, '<=')
        .replace(/≠/g, '!=')
        .replace(/←/g, '=')
        .replace(/→/g, '=')
        .replace(/\\n/g, '\n');
}

let toastTimer = null;

export function showToast(message, isError = false, duration = 2500) {
    if (typeof isError === 'number') {
        duration = isError;
        isError = false;
    }
    if (toastTimer) {
        clearTimeout(toastTimer);
        toastTimer = null;
    }
    if (els && els.toast) {
        els.toast.textContent = message;
        if (isError) {
            els.toast.classList.add('error');
        } else {
            els.toast.classList.remove('error');
        }
        els.toast.classList.add('show');
        toastTimer = setTimeout(() => {
            els.toast.classList.remove('show');
            toastTimer = null;
        }, duration);
    }
}

export function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
