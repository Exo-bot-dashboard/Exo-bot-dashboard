import { pgTable, serial, text, integer, boolean, timestamp, real, jsonb, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Discord Users table - tracks all users across all servers
export const discordUsers = pgTable("discord_users", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  discriminator: text("discriminator"),
  avatar: text("avatar"),
  lastSeen: timestamp("last_seen").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Guild (Server) Settings
export const guildSettings = pgTable("guild_settings", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  guildName: text("guild_name").notNull(),
  prefix: text("prefix").default("!").notNull(),
  language: text("language").default("en").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Economy System - User Balances
export const economy = pgTable("economy", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => discordUsers.id, { onDelete: "cascade" }),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  balance: integer("balance").default(0).notNull(),
  bank: integer("bank").default(0).notNull(),
  lastDaily: timestamp("last_daily"),
  lastWeekly: timestamp("last_weekly"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Economy Settings per Guild
export const economySettings = pgTable("economy_settings", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }).unique(),
  enabled: boolean("enabled").default(true).notNull(),
  dailyAmount: integer("daily_amount").default(100).notNull(),
  weeklyAmount: integer("weekly_amount").default(500).notNull(),
  startingBalance: integer("starting_balance").default(100).notNull(),
  maxBank: integer("max_bank").default(10000).notNull(),
});

// Custom Items
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  emoji: text("emoji"),
  itemType: text("item_type").notNull(), // consumable, collectible, role, etc
  isShopItem: boolean("is_shop_item").default(true).notNull(),
  roleId: text("role_id"), // if item type is role
  useEffect: text("use_effect"), // JSON string describing what happens on use
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User Inventory
export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => discordUsers.id, { onDelete: "cascade" }),
  itemId: integer("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  quantity: integer("quantity").default(1).notNull(),
  acquiredAt: timestamp("acquired_at").defaultNow().notNull(),
});

// Trading System
export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => discordUsers.id, { onDelete: "cascade" }),
  receiverId: integer("receiver_id").notNull().references(() => discordUsers.id, { onDelete: "cascade" }),
  offeredItems: jsonb("offered_items").notNull(), // [{itemId: number, quantity: number}]
  requestedItems: jsonb("requested_items").notNull(), // [{itemId: number, quantity: number}]
  status: text("status").notNull().default("pending"), // pending, accepted, rejected, cancelled, expired
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // optional expiration
});

// Mystery Boxes (simplified - no rarity)
export const mysteryBoxes = pgTable("mystery_boxes", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  emoji: text("emoji"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Mystery Box Rewards (simplified - no rarity)
export const mysteryBoxRewards = pgTable("mystery_box_rewards", {
  id: serial("id").primaryKey(),
  boxId: integer("box_id").notNull().references(() => mysteryBoxes.id, { onDelete: "cascade" }),
  rewardType: text("reward_type").notNull(), // item, coins
  itemId: integer("item_id").references(() => items.id, { onDelete: "cascade" }),
  coinAmount: integer("coin_amount"),
  quantity: integer("quantity").default(1).notNull(),
  weight: integer("weight").default(100).notNull(), // probability weight
});

// Chests (with rarity system)
export const chests = pgTable("chests", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  emoji: text("emoji"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chest Rarities (custom rarity tiers per guild)
export const chestRarities = pgTable("chest_rarities", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g., "Common", "Rare", "Legendary", or custom
  displayName: text("display_name").notNull(),
  color: text("color"), // hex color for display
  emoji: text("emoji"),
  sortOrder: integer("sort_order").default(0).notNull(), // for ordering rarities
});

// Chest Rewards (with rarity references)
export const chestRewards = pgTable("chest_rewards", {
  id: serial("id").primaryKey(),
  chestId: integer("chest_id").notNull().references(() => chests.id, { onDelete: "cascade" }),
  rarityId: integer("rarity_id").notNull().references(() => chestRarities.id, { onDelete: "cascade" }),
  rewardType: text("reward_type").notNull(), // item, coins
  itemId: integer("item_id").references(() => items.id, { onDelete: "cascade" }),
  coinAmount: integer("coin_amount"),
  quantity: integer("quantity").default(1).notNull(),
  weight: integer("weight").default(100).notNull(), // probability weight within this rarity
});

// Crafting Recipes
export const craftingRecipes = pgTable("crafting_recipes", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  resultItemId: integer("result_item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  resultQuantity: integer("result_quantity").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Crafting Recipe Ingredients
export const recipeIngredients = pgTable("recipe_ingredients", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").notNull().references(() => craftingRecipes.id, { onDelete: "cascade" }),
  itemId: integer("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
});

// Modmail Tickets
export const modmailTickets = pgTable("modmail_tickets", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => discordUsers.id, { onDelete: "cascade" }),
  channelId: text("channel_id"), // Discord channel ID for this ticket
  status: text("status").default("open").notNull(), // open, closed, resolved
  subject: text("subject"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

// Modmail Messages
export const modmailMessages = pgTable("modmail_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => modmailTickets.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => discordUsers.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isStaff: boolean("is_staff").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Modmail Settings
export const modmailSettings = pgTable("modmail_settings", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }).unique(),
  categoryId: text("category_id"), // Discord category for tickets
  staffRoleId: text("staff_role_id"),
  enabled: boolean("enabled").default(true).notNull(),
  // Basic features
  dmForwarding: boolean("dm_forwarding").default(true).notNull(),
  autoResponse: boolean("auto_response").default(true).notNull(),
  // Advanced features
  anonymousReplies: boolean("anonymous_replies").default(false).notNull(),
  transcriptLogging: boolean("transcript_logging").default(false).notNull(),
  ticketRatings: boolean("ticket_ratings").default(false).notNull(),
  autoCloseInactive: boolean("auto_close_inactive").default(false).notNull(),
  inactiveTimeout: integer("inactive_timeout").default(24).notNull(), // hours
});

// Moderation Warnings
export const warnings = pgTable("warnings", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => discordUsers.id, { onDelete: "cascade" }),
  moderatorId: integer("moderator_id").notNull().references(() => discordUsers.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Moderation Actions (Mutes, Bans, Kicks)
export const moderationActions = pgTable("moderation_actions", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => discordUsers.id, { onDelete: "cascade" }),
  moderatorId: integer("moderator_id").notNull().references(() => discordUsers.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // mute, kick, ban
  reason: text("reason").notNull(),
  duration: integer("duration"), // in minutes, null for permanent
  expiresAt: timestamp("expires_at"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Shadowbans
export const shadowbans = pgTable("shadowbans", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => discordUsers.id, { onDelete: "cascade" }),
  moderatorId: integer("moderator_id").notNull().references(() => discordUsers.id, { onDelete: "cascade" }),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Auto-Moderation Settings
export const autoModSettings = pgTable("auto_mod_settings", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }).unique(),
  enabled: boolean("enabled").default(false).notNull(),
  // Basic features
  antiSpam: boolean("anti_spam").default(false).notNull(),
  spamThreshold: integer("spam_threshold").default(5).notNull(),
  spamTimeWindow: integer("spam_time_window").default(5).notNull(), // seconds
  antiInvite: boolean("anti_invite").default(false).notNull(),
  badWords: text("bad_words").array(),
  // Advanced features
  antiLink: boolean("anti_link").default(false).notNull(),
  autoMuteThreshold: integer("auto_mute_threshold").default(3).notNull(), // warnings before auto-mute
  massMentionProtection: boolean("mass_mention_protection").default(false).notNull(),
  massMentionThreshold: integer("mass_mention_threshold").default(5).notNull(),
  capsProtection: boolean("caps_protection").default(false).notNull(),
  capsPercentage: integer("caps_percentage").default(70).notNull(),
  duplicateMessages: boolean("duplicate_messages").default(false).notNull(),
});

// Security Settings
export const securitySettings = pgTable("security_settings", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }).unique(),
  enabled: boolean("enabled").default(false).notNull(),
  antiRaid: boolean("anti_raid").default(false).notNull(),
  raidThreshold: integer("raid_threshold").default(10).notNull(), // joins per minute
  verificationEnabled: boolean("verification_enabled").default(false).notNull(),
  verificationRole: text("verification_role"),
  verificationChannel: text("verification_channel"),
});

// Appeal System Settings
export const appealSettings = pgTable("appeal_settings", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }).unique(),
  enabled: boolean("enabled").default(false).notNull(),
  allowDmSubmissions: boolean("allow_dm_submissions").default(true).notNull(),
  submissionChannelId: text("submission_channel_id"),
  staffRoleId: text("staff_role_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Appeals - User submissions for ban appeals
export const appeals = pgTable("appeals", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => discordUsers.id, { onDelete: "cascade" }),
  moderationActionId: integer("moderation_action_id").references(() => moderationActions.id, { onDelete: "set null" }),
  banReason: text("ban_reason"),
  appealReason: text("appeal_reason").notNull(),
  status: text("status").default("pending").notNull(), // pending, approved, denied
  reviewedBy: integer("reviewed_by").references(() => discordUsers.id, { onDelete: "set null" }),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  decidedAt: timestamp("decided_at"),
});

// AI Mod Suggestions - AI-powered moderation recommendations
export const modSuggestions = pgTable("mod_suggestions", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => discordUsers.id, { onDelete: "cascade" }),
  flaggedBy: integer("flagged_by").notNull().references(() => discordUsers.id, { onDelete: "cascade" }),
  messageId: text("message_id").notNull(),
  messageContent: text("message_content").notNull(),
  channelId: text("channel_id").notNull(),
  channelName: text("channel_name"),
  aiAnalysis: text("ai_analysis").notNull(), // AI's reasoning
  suggestedAction: text("suggested_action").notNull(), // warn, mute, kick, ban, ignore
  suggestedDuration: integer("suggested_duration"), // in minutes for mute/ban
  confidenceScore: real("confidence_score").notNull(), // 0-100
  status: text("status").default("pending").notNull(), // pending, accepted, rejected
  reviewedBy: integer("reviewed_by").references(() => discordUsers.id, { onDelete: "set null" }),
  reviewNotes: text("review_notes"),
  moderationActionId: integer("moderation_action_id").references(() => moderationActions.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at"), // Suggestions expire after 24-48h
  createdAt: timestamp("created_at").defaultNow().notNull(),
  decidedAt: timestamp("decided_at"),
}, (table) => ({
  // Unique constraint to prevent duplicate suggestions for the same message
  uniqueGuildMessage: unique().on(table.guildId, table.messageId),
}));

// Logging Settings
export const loggingSettings = pgTable("logging_settings", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }).unique(),
  enabled: boolean("enabled").default(false).notNull(),
  logChannel: text("log_channel"),
  logJoins: boolean("log_joins").default(false).notNull(),
  logLeaves: boolean("log_leaves").default(false).notNull(),
  logMessages: boolean("log_messages").default(false).notNull(),
  logModeration: boolean("log_moderation").default(true).notNull(),
  logCommands: boolean("log_commands").default(false).notNull(),
});

// Welcome/Leave System Settings
export const welcomeSettings = pgTable("welcome_settings", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }).unique(),
  enabled: boolean("enabled").default(false).notNull(),
  welcomeChannelId: text("welcome_channel_id"),
  welcomeMessage: text("welcome_message").default("Welcome {user} to {server}!"),
  welcomeEmbedEnabled: boolean("welcome_embed_enabled").default(false).notNull(),
  welcomeEmbedColor: text("welcome_embed_color").default("#5865F2"),
  welcomeEmbedTitle: text("welcome_embed_title"),
  welcomeEmbedDescription: text("welcome_embed_description"),
  leaveEnabled: boolean("leave_enabled").default(false).notNull(),
  leaveChannelId: text("leave_channel_id"),
  leaveMessage: text("leave_message").default("{user} has left {server}."),
  autoRoleEnabled: boolean("auto_role_enabled").default(false).notNull(),
  autoRoleIds: text("auto_role_ids").array(), // Array of role IDs to assign on join
});

// Reaction Roles
export const reactionRoles = pgTable("reaction_roles", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  messageId: text("message_id").notNull(),
  channelId: text("channel_id").notNull(),
  emoji: text("emoji").notNull(), // Unicode emoji or custom emoji ID
  roleId: text("role_id").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Embed Templates (for Embed Builder)
export const embedTemplates = pgTable("embed_templates", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  embedData: jsonb("embed_data").notNull(), // Stores full Discord embed JSON
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Custom Commands
export const customCommands = pgTable("custom_commands", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  trigger: text("trigger").notNull(),
  response: text("response").notNull(),
  description: text("description"),
  isSlashCommand: boolean("is_slash_command").default(false).notNull(),
  embedEnabled: boolean("embed_enabled").default(false).notNull(),
  embedColor: text("embed_color"),
  embedTitle: text("embed_title"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Workflows - Visual command builder with drag-drop nodes
export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  commandName: text("command_name").notNull(), // The actual command trigger
  commandType: text("command_type").notNull(), // 'slash' or 'prefix'
  description: text("description"),
  enabled: boolean("enabled").default(true).notNull(),
  version: integer("version").default(1).notNull(), // For optimistic concurrency control
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Workflow Nodes - Individual building blocks in a workflow
export const workflowNodes = pgTable("workflow_nodes", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  nodeType: text("node_type").notNull(), // 'trigger', 'action', 'condition', 'variable', 'response'
  nodeData: jsonb("node_data").notNull(), // Stores node configuration and connections
  positionX: real("position_x").notNull().default(0),
  positionY: real("position_y").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const discordUsersRelations = relations(discordUsers, ({ many }) => ({
  economy: many(economy),
  inventory: many(inventory),
  warnings: many(warnings, { relationName: "userWarnings" }),
  moderationActions: many(moderationActions, { relationName: "userActions" }),
  tickets: many(modmailTickets),
  appeals: many(appeals),
  modSuggestions: many(modSuggestions),
  flaggedSuggestions: many(modSuggestions, { relationName: "flaggedBy" }),
  reviewedSuggestions: many(modSuggestions, { relationName: "reviewedBy" }),
}));

export const guildSettingsRelations = relations(guildSettings, ({ one, many }) => ({
  economySettings: one(economySettings),
  modmailSettings: one(modmailSettings),
  autoModSettings: one(autoModSettings),
  securitySettings: one(securitySettings),
  appealSettings: one(appealSettings),
  loggingSettings: one(loggingSettings),
  welcomeSettings: one(welcomeSettings),
  items: many(items),
  mysteryBoxes: many(mysteryBoxes),
  chests: many(chests),
  chestRarities: many(chestRarities),
  craftingRecipes: many(craftingRecipes),
  customCommands: many(customCommands),
  workflows: many(workflows),
  reactionRoles: many(reactionRoles),
  embedTemplates: many(embedTemplates),
  economy: many(economy),
  appeals: many(appeals),
  modSuggestions: many(modSuggestions),
}));

export const economyRelations = relations(economy, ({ one }) => ({
  user: one(discordUsers, {
    fields: [economy.userId],
    references: [discordUsers.id],
  }),
  guild: one(guildSettings, {
    fields: [economy.guildId],
    references: [guildSettings.id],
  }),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  guild: one(guildSettings, {
    fields: [items.guildId],
    references: [guildSettings.id],
  }),
  inventory: many(inventory),
  boxRewards: many(mysteryBoxRewards),
  recipeIngredients: many(recipeIngredients),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  user: one(discordUsers, {
    fields: [inventory.userId],
    references: [discordUsers.id],
  }),
  item: one(items, {
    fields: [inventory.itemId],
    references: [items.id],
  }),
}));

export const mysteryBoxesRelations = relations(mysteryBoxes, ({ one, many }) => ({
  guild: one(guildSettings, {
    fields: [mysteryBoxes.guildId],
    references: [guildSettings.id],
  }),
  rewards: many(mysteryBoxRewards),
}));

export const mysteryBoxRewardsRelations = relations(mysteryBoxRewards, ({ one }) => ({
  box: one(mysteryBoxes, {
    fields: [mysteryBoxRewards.boxId],
    references: [mysteryBoxes.id],
  }),
  item: one(items, {
    fields: [mysteryBoxRewards.itemId],
    references: [items.id],
  }),
}));

export const chestsRelations = relations(chests, ({ one, many }) => ({
  guild: one(guildSettings, {
    fields: [chests.guildId],
    references: [guildSettings.id],
  }),
  rewards: many(chestRewards),
}));

export const chestRaritiesRelations = relations(chestRarities, ({ one, many }) => ({
  guild: one(guildSettings, {
    fields: [chestRarities.guildId],
    references: [guildSettings.id],
  }),
  rewards: many(chestRewards),
}));

export const chestRewardsRelations = relations(chestRewards, ({ one }) => ({
  chest: one(chests, {
    fields: [chestRewards.chestId],
    references: [chests.id],
  }),
  rarity: one(chestRarities, {
    fields: [chestRewards.rarityId],
    references: [chestRarities.id],
  }),
  item: one(items, {
    fields: [chestRewards.itemId],
    references: [items.id],
  }),
}));

export const craftingRecipesRelations = relations(craftingRecipes, ({ one, many }) => ({
  guild: one(guildSettings, {
    fields: [craftingRecipes.guildId],
    references: [guildSettings.id],
  }),
  resultItem: one(items, {
    fields: [craftingRecipes.resultItemId],
    references: [items.id],
  }),
  ingredients: many(recipeIngredients),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(craftingRecipes, {
    fields: [recipeIngredients.recipeId],
    references: [craftingRecipes.id],
  }),
  item: one(items, {
    fields: [recipeIngredients.itemId],
    references: [items.id],
  }),
}));

export const modmailTicketsRelations = relations(modmailTickets, ({ one, many }) => ({
  guild: one(guildSettings, {
    fields: [modmailTickets.guildId],
    references: [guildSettings.id],
  }),
  user: one(discordUsers, {
    fields: [modmailTickets.userId],
    references: [discordUsers.id],
  }),
  messages: many(modmailMessages),
}));

export const modmailMessagesRelations = relations(modmailMessages, ({ one }) => ({
  ticket: one(modmailTickets, {
    fields: [modmailMessages.ticketId],
    references: [modmailTickets.id],
  }),
  author: one(discordUsers, {
    fields: [modmailMessages.authorId],
    references: [discordUsers.id],
  }),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  guild: one(guildSettings, {
    fields: [workflows.guildId],
    references: [guildSettings.id],
  }),
  nodes: many(workflowNodes),
}));

export const workflowNodesRelations = relations(workflowNodes, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowNodes.workflowId],
    references: [workflows.id],
  }),
}));

// Zod schemas and types
export const insertDiscordUserSchema = createInsertSchema(discordUsers).omit({ id: true, createdAt: true });
export type InsertDiscordUser = z.infer<typeof insertDiscordUserSchema>;
export type DiscordUser = typeof discordUsers.$inferSelect;

export const insertGuildSettingsSchema = createInsertSchema(guildSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGuildSettings = z.infer<typeof insertGuildSettingsSchema>;
export type GuildSettings = typeof guildSettings.$inferSelect;

export const insertEconomySchema = createInsertSchema(economy).omit({ id: true, createdAt: true });
export type InsertEconomy = z.infer<typeof insertEconomySchema>;
export type Economy = typeof economy.$inferSelect;

export const insertEconomySettingsSchema = createInsertSchema(economySettings).omit({ id: true });
export type InsertEconomySettings = z.infer<typeof insertEconomySettingsSchema>;
export type EconomySettings = typeof economySettings.$inferSelect;

export const insertItemSchema = createInsertSchema(items).omit({ id: true, createdAt: true });
export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true, acquiredAt: true });
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventory.$inferSelect;

// Trade item schema for JSONB fields
export const tradeItemSchema = z.object({
  itemId: z.number(),
  quantity: z.number().min(1),
});

export const insertTradeSchema = createInsertSchema(trades).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  offeredItems: z.array(tradeItemSchema),
  requestedItems: z.array(tradeItemSchema),
});
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;
export type TradeItem = z.infer<typeof tradeItemSchema>;

export const insertMysteryBoxSchema = createInsertSchema(mysteryBoxes).omit({ id: true, createdAt: true });
export type InsertMysteryBox = z.infer<typeof insertMysteryBoxSchema>;
export type MysteryBox = typeof mysteryBoxes.$inferSelect;

export const insertMysteryBoxRewardSchema = createInsertSchema(mysteryBoxRewards).omit({ id: true });
export type InsertMysteryBoxReward = z.infer<typeof insertMysteryBoxRewardSchema>;
export type MysteryBoxReward = typeof mysteryBoxRewards.$inferSelect;

export const insertCraftingRecipeSchema = createInsertSchema(craftingRecipes).omit({ id: true, createdAt: true });
export type InsertCraftingRecipe = z.infer<typeof insertCraftingRecipeSchema>;
export type CraftingRecipe = typeof craftingRecipes.$inferSelect;

export const insertRecipeIngredientSchema = createInsertSchema(recipeIngredients).omit({ id: true });
export type InsertRecipeIngredient = z.infer<typeof insertRecipeIngredientSchema>;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;

export const insertModmailTicketSchema = createInsertSchema(modmailTickets).omit({ id: true, createdAt: true });
export type InsertModmailTicket = z.infer<typeof insertModmailTicketSchema>;
export type ModmailTicket = typeof modmailTickets.$inferSelect;

export const insertModmailMessageSchema = createInsertSchema(modmailMessages).omit({ id: true, createdAt: true });
export type InsertModmailMessage = z.infer<typeof insertModmailMessageSchema>;
export type ModmailMessage = typeof modmailMessages.$inferSelect;

export const insertModmailSettingsSchema = createInsertSchema(modmailSettings).omit({ id: true });
export type InsertModmailSettings = z.infer<typeof insertModmailSettingsSchema>;
export type ModmailSettings = typeof modmailSettings.$inferSelect;

export const insertWarningSchema = createInsertSchema(warnings).omit({ id: true, createdAt: true });
export type InsertWarning = z.infer<typeof insertWarningSchema>;
export type Warning = typeof warnings.$inferSelect;

export const insertModerationActionSchema = createInsertSchema(moderationActions).omit({ id: true, createdAt: true });
export type InsertModerationAction = z.infer<typeof insertModerationActionSchema>;
export type ModerationAction = typeof moderationActions.$inferSelect;

// DB insert type for shadowbans
export type InsertShadowban = typeof shadowbans.$inferInsert;
export type Shadowban = typeof shadowbans.$inferSelect;

// Request validation schema for API (accepts Discord ID as string)
export const shadowbanRequestSchema = z.object({
  discordId: z.string().min(1),
  reason: z.string().optional(),
});

export const insertAutoModSettingsSchema = createInsertSchema(autoModSettings).omit({ id: true });
export type InsertAutoModSettings = z.infer<typeof insertAutoModSettingsSchema>;
export type AutoModSettings = typeof autoModSettings.$inferSelect;

export const insertSecuritySettingsSchema = createInsertSchema(securitySettings).omit({ id: true });
export type InsertSecuritySettings = z.infer<typeof insertSecuritySettingsSchema>;
export type SecuritySettings = typeof securitySettings.$inferSelect;

export const insertLoggingSettingsSchema = createInsertSchema(loggingSettings).omit({ id: true });
export type InsertLoggingSettings = z.infer<typeof insertLoggingSettingsSchema>;
export type LoggingSettings = typeof loggingSettings.$inferSelect;

export const insertCustomCommandSchema = createInsertSchema(customCommands).omit({ id: true, createdAt: true });
export type InsertCustomCommand = z.infer<typeof insertCustomCommandSchema>;
export type CustomCommand = typeof customCommands.$inferSelect;

export const insertWorkflowSchema = createInsertSchema(workflows).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;

export const insertWorkflowNodeSchema = createInsertSchema(workflowNodes).omit({ id: true, createdAt: true });
export type InsertWorkflowNode = z.infer<typeof insertWorkflowNodeSchema>;
export type WorkflowNode = typeof workflowNodes.$inferSelect;

// Workflow Node Data Schemas
export const nodePortSchema = z.object({
  id: z.string(),
  type: z.enum(['default', 'condition']),
  accepts: z.array(z.string()).optional(),
});

export const nodeEdgeSchema = z.object({
  targetNodeId: z.string(),
  targetPortId: z.string(),
  conditionMeta: z.any().optional(), // Metadata for conditional edges
});

export const nodeDataBaseSchema = z.object({
  label: z.string(),
  ports: z.object({
    inputs: z.array(nodePortSchema).default([]),
    outputs: z.array(nodePortSchema).default([]),
  }),
  edges: z.record(z.string(), z.array(nodeEdgeSchema)).default({}), // outputPortId -> edges
});

// Node type specific configs
export const triggerNodeConfigSchema = z.object({
  type: z.enum(['slash', 'prefix']),
  commandName: z.string(),
  description: z.string().optional(),
});

export const actionNodeConfigSchema = z.object({
  actionType: z.enum(['send_message', 'add_role', 'remove_role', 'ban', 'kick', 'timeout']),
  channelId: z.string().optional(),
  roleId: z.string().optional(),
  message: z.string().optional(),
  duration: z.number().optional(),
});

export const conditionNodeConfigSchema = z.object({
  conditionType: z.enum(['has_role', 'has_permission', 'variable_equals', 'custom']),
  roleId: z.string().optional(),
  permission: z.string().optional(),
  variableName: z.string().optional(),
  compareValue: z.string().optional(),
  customExpression: z.string().optional(),
});

export const variableNodeConfigSchema = z.object({
  operation: z.enum(['set', 'get', 'increment', 'decrement']),
  variableName: z.string(),
  value: z.any().optional(),
});

export const responseNodeConfigSchema = z.object({
  message: z.string(),
  embed: z.boolean().default(false),
  embedColor: z.string().optional(),
  embedTitle: z.string().optional(),
  ephemeral: z.boolean().default(false),
});

// Combined node data schema
export const workflowNodeDataSchema = nodeDataBaseSchema.extend({
  config: z.union([
    triggerNodeConfigSchema,
    actionNodeConfigSchema,
    conditionNodeConfigSchema,
    variableNodeConfigSchema,
    responseNodeConfigSchema,
  ]),
});

export type NodePort = z.infer<typeof nodePortSchema>;
export type NodeEdge = z.infer<typeof nodeEdgeSchema>;
export type WorkflowNodeData = z.infer<typeof workflowNodeDataSchema>;
export type TriggerNodeConfig = z.infer<typeof triggerNodeConfigSchema>;
export type ActionNodeConfig = z.infer<typeof actionNodeConfigSchema>;
export type ConditionNodeConfig = z.infer<typeof conditionNodeConfigSchema>;
export type VariableNodeConfig = z.infer<typeof variableNodeConfigSchema>;
export type ResponseNodeConfig = z.infer<typeof responseNodeConfigSchema>;

export const insertChestSchema = createInsertSchema(chests).omit({ id: true, createdAt: true });
export type InsertChest = z.infer<typeof insertChestSchema>;
export type Chest = typeof chests.$inferSelect;

export const insertChestRaritySchema = createInsertSchema(chestRarities).omit({ id: true });
export type InsertChestRarity = z.infer<typeof insertChestRaritySchema>;
export type ChestRarity = typeof chestRarities.$inferSelect;

export const insertChestRewardSchema = createInsertSchema(chestRewards).omit({ id: true });
export type InsertChestReward = z.infer<typeof insertChestRewardSchema>;
export type ChestReward = typeof chestRewards.$inferSelect;

export const insertWelcomeSettingsSchema = createInsertSchema(welcomeSettings).omit({ id: true });
export type InsertWelcomeSettings = z.infer<typeof insertWelcomeSettingsSchema>;
export type WelcomeSettings = typeof welcomeSettings.$inferSelect;

export const insertReactionRoleSchema = createInsertSchema(reactionRoles).omit({ id: true, createdAt: true });
export type InsertReactionRole = z.infer<typeof insertReactionRoleSchema>;
export type ReactionRole = typeof reactionRoles.$inferSelect;

export const insertEmbedTemplateSchema = createInsertSchema(embedTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmbedTemplate = z.infer<typeof insertEmbedTemplateSchema>;
export type EmbedTemplate = typeof embedTemplates.$inferSelect;

// Giveaway System
export const giveaways = pgTable("giveaways", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  prize: text("prize").notNull(),
  winnerCount: integer("winner_count").default(1).notNull(),
  duration: integer("duration").notNull(), // in minutes
  endTime: timestamp("end_time").notNull(),
  ended: boolean("ended").default(false).notNull(),
  hostId: integer("host_id").notNull().references(() => discordUsers.id, { onDelete: "cascade" }),
  winners: text("winners").array(), // Array of Discord user IDs
  roleOverrides: jsonb("role_overrides").$type<Array<{ roleId: string; roleName: string; multiplier: number }>>().default([]), // Per-giveaway role multiplier overrides
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const giveawayTemplates = pgTable("giveaway_templates", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  prize: text("prize").notNull(),
  winnerCount: integer("winner_count").default(1).notNull(),
  duration: integer("duration").notNull(), // in minutes
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const giveawayEntries = pgTable("giveaway_entries", {
  id: serial("id").primaryKey(),
  giveawayId: integer("giveaway_id").notNull().references(() => giveaways.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => discordUsers.id, { onDelete: "cascade" }),
  entries: real("entries").default(1.0).notNull(), // Can be decimal (0.5 for less chance, 2.0 for bonus)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const giveawayRoleModifiers = pgTable("giveaway_role_modifiers", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }),
  roleId: text("role_id").notNull(),
  roleName: text("role_name").notNull(),
  multiplier: real("multiplier").default(1.0).notNull(), // 0.5 for half entries, 2.0 for double, etc
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const giveawaySettings = pgTable("giveaway_settings", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull().references(() => guildSettings.id, { onDelete: "cascade" }).unique(),
  enabled: boolean("enabled").default(false).notNull(),
});

export const insertGiveawaySchema = createInsertSchema(giveaways).omit({ id: true, createdAt: true });
export type InsertGiveaway = z.infer<typeof insertGiveawaySchema>;
export type Giveaway = typeof giveaways.$inferSelect;

export const insertGiveawayTemplateSchema = createInsertSchema(giveawayTemplates).omit({ id: true, createdAt: true });
export type InsertGiveawayTemplate = z.infer<typeof insertGiveawayTemplateSchema>;
export type GiveawayTemplate = typeof giveawayTemplates.$inferSelect;

export const insertGiveawayEntrySchema = createInsertSchema(giveawayEntries).omit({ id: true, createdAt: true });
export type InsertGiveawayEntry = z.infer<typeof insertGiveawayEntrySchema>;
export type GiveawayEntry = typeof giveawayEntries.$inferSelect;

export const insertGiveawayRoleModifierSchema = createInsertSchema(giveawayRoleModifiers).omit({ id: true, createdAt: true });
export type InsertGiveawayRoleModifier = z.infer<typeof insertGiveawayRoleModifierSchema>;
export type GiveawayRoleModifier = typeof giveawayRoleModifiers.$inferSelect;

export const insertGiveawaySettingsSchema = createInsertSchema(giveawaySettings).omit({ id: true });
export type InsertGiveawaySettings = z.infer<typeof insertGiveawaySettingsSchema>;
export type GiveawaySettings = typeof giveawaySettings.$inferSelect;

export const insertAppealSettingsSchema = createInsertSchema(appealSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppealSettings = z.infer<typeof insertAppealSettingsSchema>;
export type AppealSettings = typeof appealSettings.$inferSelect;

export const insertAppealSchema = createInsertSchema(appeals).omit({ id: true, createdAt: true, updatedAt: true, decidedAt: true }).extend({
  status: z.enum(["pending", "approved", "denied"]).default("pending"),
});
export type InsertAppeal = z.infer<typeof insertAppealSchema>;
export type Appeal = typeof appeals.$inferSelect;

export const insertModSuggestionSchema = createInsertSchema(modSuggestions).omit({ id: true, createdAt: true, decidedAt: true }).extend({
  suggestedAction: z.enum(["warn", "mute", "kick", "ban", "ignore"]),
  status: z.enum(["pending", "accepted", "rejected"]).default("pending"),
  confidenceScore: z.number().min(0).max(100),
});
export type InsertModSuggestion = z.infer<typeof insertModSuggestionSchema>;
export type ModSuggestion = typeof modSuggestions.$inferSelect;
export const modSuggestionsRelations = relations(modSuggestions, ({ one }) => ({
  guild: one(guildSettings, { fields: [modSuggestions.guildId], references: [guildSettings.id] }),
  user: one(discordUsers, { fields: [modSuggestions.userId], references: [discordUsers.id] }),
  flaggedByUser: one(discordUsers, { fields: [modSuggestions.flaggedBy], references: [discordUsers.id], relationName: "flaggedBy" }),
  reviewedByUser: one(discordUsers, { fields: [modSuggestions.reviewedBy], references: [discordUsers.id], relationName: "reviewedBy" }),
  moderationAction: one(moderationActions, { fields: [modSuggestions.moderationActionId], references: [moderationActions.id] }),
}));
