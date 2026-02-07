

# AgentOS — Your Proactive AI Execution Assistant

A clean, minimal AI assistant that turns conversations into structured goals, tasks, and reminders — then proactively nudges you to execute.

---

## Phase 1: AI Chat + Task Extraction Engine

**AI Chat Interface**
- Clean, minimal chat UI with a full-screen conversational layout
- Message history with clear user/assistant distinction
- Streaming responses using Lovable AI (Gemini)

**Automatic Task & Goal Detection**
- AI analyzes each conversation and extracts goals, tasks, milestones, and deadlines
- Extracted items appear in a sidebar panel alongside the chat
- User can confirm, edit, or dismiss extracted items before saving

**Database Setup (Lovable Cloud)**
- Tables: goals, milestones, tasks, bookmarks, agent_events, chat_messages
- All linked to a single default user (no auth yet)

---

## Phase 2: Goals & Tasks Dashboard

**Goals View**
- List of all goals with status, deadline, and progress bar
- Expand a goal to see its milestones and tasks in a tree structure
- Create/edit goals manually or via chat

**Tasks View**
- Filterable task list (by status, priority, due date, goal)
- Quick actions: mark complete, snooze, edit, delete
- Task detail panel with notes and AI suggestions

---

## Phase 3: Agent Loop & Reminders

**Proactive Agent System**
- Scheduled edge function (cron) that runs periodically
- Checks for overdue tasks, upcoming deadlines, and inactivity
- Generates proactive nudges and suggestions using AI
- Stores agent events in the database

**Notifications Panel**
- In-app notification center showing agent-generated nudges
- Types: deadline reminders, suggested next actions, daily planning prompts, check-ins
- Unread badge indicator

---

## Phase 4: Content Queue (Bookmarks)

**Manual URL Import**
- Paste any URL into a "Content Queue" page
- AI fetches/summarizes the content and categorizes it (read later, research, implement, watch)
- One-click "Create Task" from any bookmark

**Content Queue View**
- Filterable list of saved content with AI-generated summaries and categories
- Status tracking (unread, read, actioned)

---

## Phase 5: Memory & Intelligence

**AI Memory System**
- Chat history stored and used as context for future conversations
- AI remembers user goals, preferences, and behavioral patterns
- Contextual suggestions improve over time

---

## Design Direction

- Clean & minimal aesthetic inspired by Notion/Linear
- Lots of whitespace, simple typography
- Sidebar navigation with pages: Chat, Goals, Tasks, Content Queue, Notifications, Settings
- Light mode default, consistent neutral color palette

