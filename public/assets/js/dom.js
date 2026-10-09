/* ========================================================================
   DOM REFERENCES
   ======================================================================== */
export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

export const els = {
    screens: document.querySelectorAll('.screen'),
    studentUsername: $('#student-username'),
    studentPassword: $('#student-password'),
    btnContinue: $('#btn-continue'),
    modalPhone: $('#modal-phone'),
    phoneInput: $('#phone-input'),
    btnSubmitPhone: $('#btn-submit-phone'),
    progressBar: $('#progress-bar'),
    progressText: $('#progress-text'),
    questionNumber: $('#question-number'),
    badgeDifficulty: $('#badge-difficulty'),
    badgeType: $('#badge-type'),
    questionText: $('#question-text'),
    questionImagesContainer: $('#question-images-container'),
    codeWrapper: $('#code-wrapper'),
    codeContent: $('#code-content'),
    optionsContainer: $('#options-container'),
    btnPrev: $('#btn-prev'),
    btnNext: $('#btn-next'),
    btnNextText: $('#btn-next-text'),
    resultsContainer: $('#results-container'),
    toast: $('#toast'),
    questionHeader: $('#question-header'),
    questionContent: $('#question-content'),
    blurCountDisplay: $('#blur-count-display'),
    anticheatBadge: $('#anticheat-badge'),
    screenQuiz: $('#screen-quiz'),
};

