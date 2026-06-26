-- SQL Schema for Supabase

-- Table for quiz questions
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    difficulty TEXT NOT NULL,          -- 'easy', 'medium', 'hard'
    type TEXT NOT NULL,                -- 'choice', 'code'
    text TEXT NOT NULL,                -- The question text
    code TEXT,                         -- C++ code snippet (optional/nullable)
    options_json JSONB NOT NULL,       -- Array of answers options
    correct_index INTEGER NOT NULL,    -- Index of the correct answer (0-3)
    explanation TEXT NOT NULL          -- Explanation for the answer
);

-- Table for student test submissions
CREATE TABLE IF NOT EXISTS results (
    id SERIAL PRIMARY KEY,
    student_name TEXT NOT NULL,
    score INTEGER NOT NULL,            -- Points earned by the student
    total_points INTEGER NOT NULL,     -- Maximum points possible (60)
    time_taken_ms BIGINT NOT NULL,     -- Total duration of test in milliseconds
    created_at TIMESTAMPTZ DEFAULT NOW()
);
