/*
# Create vocabularies table for VocabMaster

## Overview
Creates the core `vocabularies` table that stores user vocabulary words with their
type, meaning, category, and error tracking. Each user only sees their own words.

## New Tables
- `vocabularies`
  - `id` (uuid, primary key, auto-generated)
  - `user_id` (uuid, references auth.users, defaults to authenticated user)
  - `word` (text, the English vocabulary word)
  - `type` (text, part of speech: noun, verb, adjective, etc.)
  - `meaning` (text, the Vietnamese meaning)
  - `category` (text, topic/chest grouping)
  - `error_count` (integer, default 0, tracks mistakes for weakness analysis)
  - `created_at` (timestamptz, default now())

## Security
- Row Level Security enabled on `vocabularies`.
- Four owner-scoped policies (SELECT, INSERT, UPDATE, DELETE) so each
  authenticated user can only read, create, edit, and delete their own rows.
- `user_id` defaults to `auth.uid()` so client inserts that omit the column still pass the WITH CHECK.

## Important Notes
1. This is a multi-user app with a sign-in screen, so policies are scoped to `authenticated`.
2. The `user_id` column has `DEFAULT auth.uid()` so frontend inserts work without explicitly passing the owner.
3. `error_count` is used by the Skill Analytics feature to identify weak words.
*/

CREATE TABLE IF NOT EXISTS vocabularies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  word text NOT NULL,
  type text DEFAULT '',
  meaning text DEFAULT '',
  category text DEFAULT 'General',
  error_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vocabularies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_vocabularies" ON vocabularies;
CREATE POLICY "select_own_vocabularies" ON vocabularies FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_vocabularies" ON vocabularies;
CREATE POLICY "insert_own_vocabularies" ON vocabularies FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_vocabularies" ON vocabularies;
CREATE POLICY "update_own_vocabularies" ON vocabularies FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_vocabularies" ON vocabularies;
CREATE POLICY "delete_own_vocabularies" ON vocabularies FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vocabularies_user_id ON vocabularies(user_id);
CREATE INDEX IF NOT EXISTS idx_vocabularies_category ON vocabularies(category);
CREATE INDEX IF NOT EXISTS idx_vocabularies_error_count ON vocabularies(error_count DESC);
