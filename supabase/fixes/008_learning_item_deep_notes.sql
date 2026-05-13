-- 008_learning_item_deep_notes.sql
-- Add user-owned deep notes for vocabulary and grammar items.
-- These notes are manually pasted/saved by the user and do not call any AI API.

ALTER TABLE public.vocabulary_items
  ADD COLUMN IF NOT EXISTS user_deep_note text,
  ADD COLUMN IF NOT EXISTS user_deep_note_updated_at timestamptz;

ALTER TABLE public.grammar_items
  ADD COLUMN IF NOT EXISTS user_deep_note text,
  ADD COLUMN IF NOT EXISTS user_deep_note_updated_at timestamptz;
