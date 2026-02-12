
-- Add source tracking columns to bookmarks
ALTER TABLE public.bookmarks ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.bookmarks ADD COLUMN IF NOT EXISTS source_id text;

-- Create index for deduplication lookups
CREATE INDEX IF NOT EXISTS idx_bookmarks_source_id ON public.bookmarks (user_id, source_id) WHERE source_id IS NOT NULL;

-- Create user_settings table
CREATE TABLE public.user_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  setting_key text NOT NULL,
  setting_value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, setting_key)
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON public.user_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to set user_id automatically
CREATE TRIGGER set_user_settings_user_id
  BEFORE INSERT ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_id();
