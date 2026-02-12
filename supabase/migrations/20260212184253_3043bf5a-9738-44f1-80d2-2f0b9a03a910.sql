
-- Add user_id columns to all tables
ALTER TABLE public.goals ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.milestones ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.bookmarks ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.agent_events ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Allow all access to goals" ON public.goals;
DROP POLICY IF EXISTS "Allow all access to milestones" ON public.milestones;
DROP POLICY IF EXISTS "Allow all access to tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow all access to bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Allow all access to agent_events" ON public.agent_events;
DROP POLICY IF EXISTS "Allow all access to chat_messages" ON public.chat_messages;

-- Goals policies
CREATE POLICY "Users can view own goals" ON public.goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON public.goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Milestones policies
CREATE POLICY "Users can view own milestones" ON public.milestones FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own milestones" ON public.milestones FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own milestones" ON public.milestones FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own milestones" ON public.milestones FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Tasks policies
CREATE POLICY "Users can view own tasks" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Bookmarks policies
CREATE POLICY "Users can view own bookmarks" ON public.bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bookmarks" ON public.bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bookmarks" ON public.bookmarks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Agent events policies (service role can also insert for cron jobs)
CREATE POLICY "Users can view own agent_events" ON public.agent_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own agent_events" ON public.agent_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own agent_events" ON public.agent_events FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own agent_events" ON public.agent_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Chat messages policies
CREATE POLICY "Users can view own chat_messages" ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chat_messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chat_messages" ON public.chat_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own chat_messages" ON public.chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create trigger function to auto-set user_id on insert
CREATE OR REPLACE FUNCTION public.set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply triggers to all tables
CREATE TRIGGER set_goals_user_id BEFORE INSERT ON public.goals FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
CREATE TRIGGER set_milestones_user_id BEFORE INSERT ON public.milestones FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
CREATE TRIGGER set_tasks_user_id BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
CREATE TRIGGER set_bookmarks_user_id BEFORE INSERT ON public.bookmarks FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
CREATE TRIGGER set_agent_events_user_id BEFORE INSERT ON public.agent_events FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
CREATE TRIGGER set_chat_messages_user_id BEFORE INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
