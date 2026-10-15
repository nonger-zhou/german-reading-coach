DELETE FROM public.grammar_items
WHERE source IN (
  'ai',
  'ai_mock',
  'ai_detected',
  'ai_detected_then_user_confirmed'
);

UPDATE public.articles
SET summary_zh = NULL, summary_de_simple = NULL;
