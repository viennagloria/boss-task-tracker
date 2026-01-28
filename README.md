# Boss Tasks Auto-Tracker

## What This Does
When you (the PM/CoS) react with 📌 emoji to any message from your boss, automatically creates a task in your Notion task dashboard. You stay in control of what becomes a task—no training your boss on new workflows.

## Primary Use Case (MVP)
**As a PM/CoS, when my boss posts something that needs action and I react with 📌, I want it automatically added to my Notion Tasks database with:**
- Task description (the full message text)
- Who posted it (your boss's name)
- Channel it came from
- Link to original Slack message
- Date created
- Status (defaults to "To Do")

**Core User Flow:**
1. Boss posts: "We need to update the pricing page by Friday"
2. You react with 📌 emoji (flags it as a task)
3. Bot detects your emoji reaction event
4. Bot creates new entry in Notion Tasks database
5. Bot confirms with ✅ reaction (so you know it logged)

**Why emoji-triggered?**
- You control what becomes a task (no parsing ambiguity)
- Works in any channel (DMs, public channels, wherever boss posts)
- No training your boss on new workflows
- Zero parsing complexity (avoids LLM brittleness)
- Easy to test
- Fast in-the-moment triage (📌 as you read Slack)

## Technical Approach
- **Stack:** Python + FastAPI
- **Integrations:** Slack Events API (reaction_added event) + Notion API
- **Parsing:** None needed! Just grab message text from reaction event
- **Deployment:** Fly.io or Render
- **Database:** Postgres for tracking processed reactions (prevent duplicates)

## Milestones

### Week 1-2: Core Integration
- [ ] Slack Events API setup (listen for `reaction_added` events with 📌 emoji)
- [ ] Notion API setup (write to Tasks database)
- [ ] Basic reaction → Notion task flow working locally
- [ ] Deploy to production (even if minimal)

### Week 3-4: Reliability & UX
- [ ] Duplicate detection (don't log same reaction twice)
- [ ] Add ✅ confirmation reaction after task created
- [ ] Handle edge cases (deleted messages, private channels)
- [ ] Add tests for event processing logic
- [ ] Optional: Filter to only create tasks when you 📌 (ignore other users' reactions)
- [ ] Optional: Filter to only messages FROM your boss (ignore reactions to other people's messages)

### Week 5-6: Production Hardening
- [ ] CI/CD pipeline
- [ ] Logging and monitoring (track failed task creations)
- [ ] Documentation (setup, architecture, runbook)
- [ ] Optional: Allow 🗑️ emoji to remove task from Notion

## Non-Goals (What We're NOT Building)
- Natural language parsing (no "detect if this sounds like a task")
- Multiple Notion databases (just one Tasks database)
- Task assignments/due dates (Notion has built-in features for this)
- Custom dashboard UI (just using Notion's database views)
- Two-way sync (Notion → Slack updates)
- Historical message scanning (only new reactions going forward)
- Support for multiple emoji types (just 📌 for MVP)
- Task completion tracking via Slack (update status in Notion directly)
- Thread/reply handling (just top-level messages)
- Rich formatting preservation (plain text is fine)
- User permissions/filtering for MVP (can add "only me" or "only boss's messages" filters later)

## Success Criteria
By Week 6, this project ships if:
- [ ] Public URL that receives Slack reaction events
- [ ] 📌 emoji on any message reliably creates Notion task
- [ ] Basic tests cover event processing logic
- [ ] CI runs tests on PRs
- [ ] Documented setup for local dev + production
- [ ] Runbook for common issues (duplicate handling, failed API calls)

## Questions to Answer Before Starting
1. Which Slack workspace will this run in?
2. Which Notion database will receive tasks? (create it now with these fields: Title, Author, Channel, Slack Link, Date, Status)
3. Should it only create tasks when YOU add 📌, or anyone on the team? (Recommend: just you for MVP)
4. Should it only track messages FROM your boss, or any message you 📌? (Recommend: any message for MVP, you control with the emoji)

## Example Test Scenarios
1. You react with 📌 to boss's message "Update pricing page" → Task appears in Notion with full text
2. Someone else reacts with 📌 → Nothing happens (or: also creates task if you want team-wide)
3. You react with different emoji to boss's message → Nothing happens
4. You react with 📌 to same message twice → Only one task created
5. Bot confirms with ✅ reaction after logging → You see confirmation
6. You react with 📌 to message in private DM → Task still created

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Bot misses reactions if offline | Slack Events API has retry logic; log failures for manual backfill |
| People accidentally create tasks | Simple fix: make it easy to delete in Notion (or add 🗑️ emoji to remove) |
| Duplicate reactions create duplicate tasks | Track processed reaction events in Postgres |
| API rate limits | Start small, add basic rate limiting if needed |
| Message deleted after reaction | Store message text in DB at reaction time (don't rely on fetching later) |
