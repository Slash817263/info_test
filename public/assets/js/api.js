import { questions } from './state.js';

/* ========================================================================
   API FETCH WRAPPER & ROUTES
   ======================================================================== */
export const API_ROUTES = {
    checkUser: '/.netlify/functions/check-user',
    fetchQuestions: '/.netlify/functions/fetch-questions',
    fetchProgress: '/.netlify/functions/fetch-progress',
    saveProgress: '/.netlify/functions/save-progress',
    saveResult: '/.netlify/functions/save-result',
    updatePhone: '/.netlify/functions/update-phone',
    managePractice: '/.netlify/functions/manage-practice'
};

export async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('active_student_token') || '';
    if (!options.headers) options.headers = {};
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (!options.headers['Content-Type'] && options.method && options.method !== 'GET') {
        options.headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(url, options);
        if (response.status === 401) {
            // Sesiune expirata / token invalid
            throw new Error('Sesiunea a expirat. Vă rugăm să vă reautentificați.');
        }
        return response;
    } catch (err) {
        console.error(`apiFetch error for ${url}:`, err);
        throw err;
    }
}
window.apiFetch = apiFetch;
window.API_ROUTES = API_ROUTES;

