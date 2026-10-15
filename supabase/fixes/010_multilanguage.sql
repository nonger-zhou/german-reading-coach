-- 010_multilanguage.sql
-- 多语言（德语 / 英语）数据隔离。详见 docs/PRD.md §1.5、docs/DATABASE.md §10.7。
--
-- 做了什么：
--   1. articles / vocabulary_items / grammar_items 增加 language（'de' | 'en'），默认 'de'。
--      执行这一刻表里已有的所有行（所有账号）都会自动成为 'de'。
--   2. 词库、语法库唯一键加入 language：同一个人的德语 "die" 和英语 "die" 是两条独立词条。
--      新唯一键比旧的更宽松，旧版前端（不写 language、默认 'de'）照常可用。
--   3. profiles 增加 target_language（当前学习语言，默认 'de'）与 self_selected_level_en（英语阅读水平）。
--      原 self_selected_level 继续表示德语水平，不改动。
--
-- 安全性：只新增列 / 放宽唯一键，不删除、不改写任何已有数据；可重复执行。
-- 执行顺序：先在 Supabase SQL Editor 执行本文件，再部署 / 测试带多语言的前端。

BEGIN;

-- 1) language 列 ----------------------------------------------------------------
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'de';
ALTER TABLE public.vocabulary_items
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'de';
ALTER TABLE public.grammar_items
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'de';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'articles_language_check') THEN
    ALTER TABLE public.articles
      ADD CONSTRAINT articles_language_check CHECK (language IN ('de', 'en'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vocabulary_items_language_check') THEN
    ALTER TABLE public.vocabulary_items
      ADD CONSTRAINT vocabulary_items_language_check CHECK (language IN ('de', 'en'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grammar_items_language_check') THEN
    ALTER TABLE public.grammar_items
      ADD CONSTRAINT grammar_items_language_check CHECK (language IN ('de', 'en'));
  END IF;
END $$;

-- 2) 唯一键加入 language -----------------------------------------------------------
-- 先加新键（旧数据全为 'de'，不会冲突），再删旧键。
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vocabulary_items_user_lang_norm_pos_unique') THEN
    ALTER TABLE public.vocabulary_items
      ADD CONSTRAINT vocabulary_items_user_lang_norm_pos_unique
      UNIQUE (user_id, language, normalized_key, part_of_speech);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grammar_items_user_lang_key_norm_unique') THEN
    ALTER TABLE public.grammar_items
      ADD CONSTRAINT grammar_items_user_lang_key_norm_unique
      UNIQUE (user_id, language, grammar_key, normalized_key);
  END IF;
END $$;

ALTER TABLE public.vocabulary_items
  DROP CONSTRAINT IF EXISTS vocabulary_items_user_norm_pos_unique;
ALTER TABLE public.grammar_items
  DROP CONSTRAINT IF EXISTS grammar_items_user_key_norm_unique;

-- 列表页按 (user_id, language) 过滤
CREATE INDEX IF NOT EXISTS articles_user_language_created_idx
  ON public.articles (user_id, language, created_at DESC);

-- 3) profiles ---------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS target_language text NOT NULL DEFAULT 'de',
  ADD COLUMN IF NOT EXISTS self_selected_level_en text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_target_language_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_target_language_check CHECK (target_language IN ('de', 'en'));
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------------
-- 执行后检查（逐条运行，看结果）：
--
-- a) 已有数据全部是德语（每张表只应出现一行 de）：
--    SELECT 'articles' AS t, language, count(*) FROM public.articles GROUP BY language
--    UNION ALL SELECT 'vocabulary_items', language, count(*) FROM public.vocabulary_items GROUP BY language
--    UNION ALL SELECT 'grammar_items', language, count(*) FROM public.grammar_items GROUP BY language;
--
-- b) 新唯一键已生效、旧唯一键已删除（应看到两个 *_lang_* 约束）：
--    SELECT conname FROM pg_constraint
--    WHERE conrelid IN ('public.vocabulary_items'::regclass, 'public.grammar_items'::regclass)
--      AND contype = 'u';
--
-- c) profiles 新列：
--    SELECT target_language, self_selected_level_en, count(*) FROM public.profiles GROUP BY 1, 2;
