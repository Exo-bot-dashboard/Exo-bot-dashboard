# Exo Dashboard

## Overview
Exo is an all-in-one Discord bot with a comprehensive web dashboard, designed to provide a rich set of features including an economy system, moderation tools, Modmail, and security enhancements. The project aims to offer a robust and highly configurable solution for Discord server management, with a user-friendly interface.

## User Preferences
- Branding: Consistently use "Exo" throughout the dashboard (not "Exo Bot")
- Theme: Dark mode is the default theme
- Dashboard Background: Dark brown to dark purple gradient (not the landing page)

## System Architecture
The project is built with a monorepo structure, separating the frontend, backend, and shared utilities.

-   **Frontend**: Developed with React, utilizing TanStack Query for data fetching, Wouter for routing, and Tailwind CSS for styling. The dashboard supports dark mode, theme persistence, and a consistent save confirmation workflow for settings pages.
-   **Backend**: An Express.js server handles API requests and Discord OAuth authentication using Passport.
-   **Bot**: The Discord bot logic is implemented using Discord.js v14.
-   **Database**: PostgreSQL is used as the primary data store, with Drizzle ORM for database interactions.
-   **Language**: TypeScript is used across the entire stack for type safety.
-   **UI/UX Decisions**:
    -   **Dark Mode Toggle**: Available throughout the dashboard with persistence.
    -   **Help Documentation**: A modal provides comprehensive help.
    -   **Save Confirmation Workflow**: All settings pages use a staged save pattern with confirmation modals to prevent accidental changes.
    -   **Guild Context**: A React Context API based system manages guild selection, ensuring data freshness and proper access control.
    -   **Mobile-Responsive Design**: Sidebar automatically collapses on mobile with overlay menu, larger touch targets (48px min-height), and responsive padding.
    -   **Unsaved Changes Warning**: Production-ready navigation blocker on all settings pages (Economy, Modmail, Moderation, Security, Logging, Welcome/Leave). Uses Promise-based saveCallbacks that reject on errors, preventing data loss. When saves fail, users see an alert and can retry without losing edits.
    -   **Role/Channel Dropdown Selectors**: All dashboard settings pages use visual dropdown selectors instead of manual ID entry. Backend endpoints fetch Discord roles/channels with 60-second caching. Includes single-select (RoleSelector, ChannelSelector) and multi-select (MultiRoleSelector with badge UI) components. Applied to Modmail, Security, Logging, and Welcome/Leave pages.
-   **Feature Specifications**:
    -   **Economy System**: Includes user balances, daily rewards, payments, custom items, shops, buyable roles, mystery boxes (weight-based), chests (guild-defined rarity tiers), crafting system, and item trading. Full slash command support (/balance, /daily, /work, /pay, /shop, /buy, /trade, /accept, /decline, /trades).
    -   **Giveaway System**: Complete giveaway management with template system for quick creation, role-based entry multipliers (decimals supported for <1 or >1 weights), automatic scheduling with setTimeout, weighted duplicate-free winner selection, and full slash command support (/giveaway create, /giveaway template, /reroll, /end). All administrative commands require ManageGuild permission. The `/giveaway create` command now supports per-giveaway role modifiers (up to 5 role+multiplier pairs) that complement guild-wide modifiers. Per-giveaway overrides take precedence over guild defaults when roles overlap.
    -   **Moderation**: Warning system, mute/kick/ban, auto-moderation (anti-spam, bad words, anti-invite), and logging. Full slash command support (/warn, /mute, /kick, /ban, /shadowban, /unshadowban).
    -   **AI-Powered Moderation (/aipunish)**: Intelligent slash command that analyzes recent messages in a channel (customizable 1-250, default 10) to determine if anyone should be punished and why. When a moderator runs `/aipunish`, the AI examines conversation context, user histories (30-day warnings/mutes/bans), and behavior patterns to make fair, context-aware recommendations. Returns detailed analysis with confidence score, target user (if any), suggested punishment (warn, mute, timeout, kick, ban, temp ban with duration, quarantine role temp/perm, shadowban, role remove), duration, and reasoning. Uses gpt-4o-mini model via Replit AI Integrations. Requires Moderate Members permission. No auto-execution - moderators review AI suggestions before taking action.
    -   **Appeal System**: Users with active bans can submit appeals using the /appeal slash command. Appeals are reviewed in the dashboard where staff can approve (auto-unbans) or deny with review notes. Module supports DM submissions, optional submission channels, and staff role configuration. Dashboard provides tabs for filtering by status (pending, approved, denied).
    -   **Modmail**: Ticket system for user-to-staff communication. Slash command support (/ticket, /closeticket).
    -   **Security**: Anti-raid protection, verification system, and configurable settings.
    -   **User Tracking**: Automatic last-seen tracking with /seen slash command (always available).
    -   **Bot Mention Response**: When the bot is mentioned/pinged in any server, it responds with an informative embed showing the server prefix, brief description, and dashboard link.
    -   **Custom Commands**: A template-based system supporting both prefix and slash commands with dynamic variables, embed support, and auto-registration.
    -   **Module Management**: Most features can be enabled/disabled per guild, with automatic slash command registration/unregistration. When you toggle a module in the dashboard, slash commands immediately register/unregister with Discord (no bot restart required).
-   **System Design Choices**:
    -   **Chest System**: Distinct from mystery boxes; chests feature guild-customizable rarity tiers, while mystery boxes are simple weight-based.
    -   **Trading System**: Players can propose trades with multiple items on each side. Trades require both parties to have the offered items before execution. Status tracking (pending, accepted, rejected, cancelled) with Discord bot commands for management.
    -   **Giveaway System**: Templates allow pre-configuration in dashboard for quick giveaway creation. Role modifiers use decimal multipliers (0.5 = half entries, 2.0 = double entries) stored as numeric type. Automatic ending uses setTimeout with weighted duplicate-free winner selection. Per-giveaway role modifiers can be specified directly in the `/giveaway create` slash command (up to 5 role+multiplier pairs with range 0.1-10.0). These overrides are stored in the `roleOverrides` JSONB column and merged with guild-wide modifiers during winner selection, with per-giveaway overrides taking precedence.
    -   **Appeal System**: Appeals link to original moderation actions and store both ban reason and appeal reason. Dashboard approval automatically deactivates the ban record and unbans via Discord API. Appeal status is immutable once decided (approved/denied) to maintain audit trail.
    -   **AI Moderation System**: 
        - **/aipunish Command**: Analyzes recent channel messages (1-250, default 10) excluding bots. Accepts optional `messages` parameter to customize analysis window. Fetches user histories for all participants, formats conversation with timestamps and history notes (W/M/B counts), sends to gpt-4o-mini with comprehensive prompt covering context awareness, pattern detection, and fair moderation guidelines. Returns structured JSON with shouldPunish boolean, targetUserId, suggestedAction (warn/mute/timeout/kick/ban/temp_ban/quarantine_temp/quarantine_perm/shadowban/role_remove/none), reasoning (3-5 sentences), confidence score, optional duration, and optional roleToRemove. Displays results in rich embed with color-coded recommendation (green for no punishment, red for punishment needed) and formatted duration display.
        - **AI Analysis**: Uses temperature 0.4 for nuanced understanding, max 500 tokens, enforced JSON output. Considers friendly banter vs harassment, examines full conversation flow, weighs user history (repeat offenders get harsher suggestions), identifies primary violators in multi-user arguments, and provides detailed reasoning for all decisions including "no punishment needed" cases. Punishment options include permanent actions (mute, ban, quarantine_perm, shadowban), temporary actions (timeout, temp_ban, quarantine_temp), and other moderation tools (warn, kick, role_remove).
    -   **Slash Command Registration**: Basic moderation commands (/warn, /mute, /kick, /ban, /shadowban, /unshadowban, /aipunish) are ALWAYS registered for all guilds, regardless of module toggles. They have permission restrictions enforced at the command level, so only users with appropriate Discord permissions can use them. This prevents confusion where users enable "Moderation" in the dashboard but don't see commands because they confused it with "Auto-Moderation" settings.
    -   **Database Deployment**: Development uses `db:push` for rapid iteration, while production employs automated migrations with cleanup scripts.

## External Dependencies
-   **Discord API**: For bot interactions and OAuth authentication.
-   **OpenAI API**: For AI-powered moderation suggestions (gpt-4o-mini model via Replit AI Integrations).
-   **PostgreSQL**: Relational database for persistent storage.
-   **React**: Frontend library.
-   **Express.js**: Backend web framework.
-   **Discord.js**: Discord API wrapper for bot development.
-   **Drizzle ORM**: TypeScript ORM for PostgreSQL.
-   **TanStack Query**: Data fetching and caching for React.
-   **Passport**: Authentication middleware for Node.js (specifically Discord OAuth).
-   **Wouter**: A tiny routing library for React.
-   **Tailwind CSS**: Utility-first CSS framework.