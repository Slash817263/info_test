-- SQL Schema for Supabase

-- Table for quiz questions
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    difficulty TEXT NOT NULL,          -- 'easy', 'medium', 'hard'
    type TEXT NOT NULL,                -- 'choice', 'code'
    category TEXT,                     -- 'Fundamente', 'Organizarea Datelor', 'Subprograme', 'Backtracking', 'Grafuri si Arbori'
    subcategory TEXT,                  -- Specific subcategory within the category
    text TEXT NOT NULL,                -- The question text
    code TEXT,                         -- C++ code snippet (optional/nullable)
    options_json JSONB NOT NULL,       -- Array of answer options
    correct_index INTEGER NOT NULL,    -- Index of the correct answer (0-3)
    explanation TEXT NOT NULL          -- Explanation for the answer
);

-- Table for student test submissions
CREATE TABLE IF NOT EXISTS results (
    id SERIAL PRIMARY KEY,
    student_name TEXT NOT NULL,
    student_email TEXT,                -- Email address of the student
    test_type TEXT DEFAULT 'initial',  -- 'initial' (50q) or 'intermediar' (30q)
    score INTEGER NOT NULL,            -- Points earned by the student
    total_points INTEGER NOT NULL,     -- Maximum points possible
    time_taken_ms BIGINT NOT NULL,     -- Total duration of test in milliseconds
    blur_count INTEGER DEFAULT 0,      -- Number of times student left the tab (anti-cheat)
    answers_json JSONB,                -- Array of selected answer indices
    details_json JSONB,                -- Detailed per-question results with timing data
    created_at TIMESTAMPTZ DEFAULT NOW()
);
