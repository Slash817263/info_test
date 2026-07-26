-- SQL Schema for Supabase

-- 1. Upgrade existing 'questions' table if it exists
ALTER TABLE IF EXISTS questions 
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- 2. Upgrade existing 'results' table if it exists
ALTER TABLE IF EXISTS results 
    ADD COLUMN IF NOT EXISTS student_email TEXT,
    ADD COLUMN IF NOT EXISTS test_type TEXT DEFAULT 'initial',
    ADD COLUMN IF NOT EXISTS blur_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS answers_json JSONB,
    ADD COLUMN IF NOT EXISTS details_json JSONB;

-- 3. Create 'questions' table if it doesn't exist at all
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

-- 4. Create 'results' table if it doesn't exist at all
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
