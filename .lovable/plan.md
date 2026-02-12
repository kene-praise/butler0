
# Telegram Bot Integration for Butler

## How It Works

You forward tweets (or any links) to a Telegram bot. Butler automatically picks them up, summarizes them with AI, categorizes them, and deduplicates against existing bookmarks.

```text
+------------------+     +-------------------+     +------------------+
| You on Telegram  | --> | Telegram Webhook  | --> | Butler Backend   |
| Forward a tweet  |     | (Edge Function)   |     | - Save bookmark  |
+------------------+     +-------------------+     | - AI summarize   |
                                                    | - Deduplicate    |
                                                    +------------------+
```

## Setup (One-Time, ~2 Minutes)

1. Open Telegram and message **@BotFather**
2. Send `/newbot`, name it "Butler Bot"
3. Copy the bot token you receive
4. Paste it into Butler's Settings page
5. Butler registers the webhook automatically -- done!

After that, just forward any tweet or link to your bot in Telegram. Butler handles the rest.

## What Gets Built

### 1. Database: Add `source` and `source_id` columns to bookmarks
- `source` (text, default `'manual'`) -- tracks where the bookmark came from (`manual`, `telegram`)
- `source_id` (text, nullable) -- stores the original tweet URL or message ID for deduplication

### 2. Edge Function: `telegram-webhook`
- Receives incoming messages from Telegram
- Extracts URLs from the message text (tweets or any link)
- Checks for duplicates by matching `source_id` (the URL) against existing bookmarks
- Inserts new bookmarks and triggers AI summarization via the existing `summarize-bookmark` function
- Returns appropriate response to Telegram

### 3. Edge Function: `telegram-setup`
- Called from the Settings page when user saves their bot token
- Stores the token as a user setting
- Registers the webhook URL with Telegram's API (`setWebhook`)
- Verifies the connection is working

### 4. Database: `user_settings` table
- Stores per-user settings like `telegram_bot_token` and `telegram_chat_id`
- RLS-protected so each user only sees their own settings

### 5. Settings Page Update
- Add a "Telegram Integration" card with:
  - Input field for bot token
  - "Connect" button that triggers webhook registration
  - Status indicator (connected/disconnected)
  - Instructions on how to get a bot token

### 6. Content Page Update
- Show source badge on bookmarks (manual vs telegram)
- Visual indicator for auto-imported items

## Deduplication Logic

When a new message arrives from Telegram:
1. Extract all URLs from the message
2. For each URL, check if a bookmark with that `source_id` already exists for the user
3. Skip duplicates, insert only new ones
4. This ensures re-forwarding the same tweet does nothing

## Future: Automated 6-Hour Sync

The Telegram approach is already real-time (webhook fires instantly when you forward a message), so there's no need for polling. Every forwarded tweet arrives in Butler within seconds. The 6-hour cron job can later be used for re-summarizing or re-categorizing existing bookmarks if needed.

## Technical Details

### Security
- The `telegram-webhook` endpoint must be public (no JWT) since Telegram calls it, but it will validate requests using a secret token in the webhook URL path
- User association: the bot token is linked to a specific user, so incoming messages are routed to the correct account
- The `telegram-setup` endpoint requires authentication (JWT)

### Files to Create/Modify
- **New migration**: Add `source`, `source_id` to `bookmarks`; create `user_settings` table
- **New**: `supabase/functions/telegram-webhook/index.ts`
- **New**: `supabase/functions/telegram-setup/index.ts`
- **Modified**: `supabase/config.toml` (add function entries)
- **Modified**: `src/pages/SettingsPage.tsx` (Telegram config UI)
- **Modified**: `src/pages/ContentPage.tsx` (show source badges)
