/* ========================================================================
           CONFIGURATION
           ======================================================================== */
export const CONFIG = {
    tutorPhone: '',
    tutorEmail: '',
    timerInitial: 30 * 60 * 1000,      // 30 minutes for Initial Test
    timerIntermediar: 60 * 60 * 1000,   // 60 minutes for intermediate tests
};

/* ========================================================================
   QUESTIONS DATA — Loaded Dynamically from Supabase
   ======================================================================== */
// Full list of questions fetched for current session
export let questions = [];     // Active quiz questions

/* ========================================================================
   STATE MANAGEMENT
   ======================================================================== */
export const state = {
    currentQuestion: 0,
    testType: 'initial', // always initial or decide logic later if we keep intermediate test
    examType: 'Initial',
    studentUsername: '',
    studentId: null,
    assignedTestId: null,
    startTime: null,
    endTime: null,
    blurCount: 0,
    questionTimings: [],     // ms spent on each question
    questionEnteredAt: null, // timestamp when current question was shown
    needName: false,        // true when user is new and needs to enter name
    isExpired: false        // true when user subscription has expired
};


export function setQuestions(newQs) { questions = newQs; }
