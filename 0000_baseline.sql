CREATE TABLE "auto_mod_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" integer NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"anti_spam" boolean DEFAULT false NOT NULL,
	"spam_threshold" integer DEFAULT 5 NOT NULL,
	"spam_time_window" integer DEFAULT 5 NOT NULL,
	"anti_invite" boolean DEFAULT false NOT NULL,
	"bad_words" text[],
	"anti_link" boolean DEFAULT false NOT NULL,
	"auto_mute_threshold" integer DEFAULT 3 NOT NULL,
	"mass_mention_protection" boolean DEFAULT false NOT NULL,
	"mass_mention_threshold" integer DEFAULT 5 NOT NULL,
	"caps_protection" boolean DEFAULT false NOT NULL,
	"caps_percentage" integer DEFAULT 70 NOT NULL,
	"duplicate_messages" boolean DEFAULT false NOT NULL,
	CONSTRAINT "auto_mod_settings_guild_id_unique" UNIQUE("guild_id")
);
--> statement-breakpoint
CREATE TABLE "chest_rarities" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" integer NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"color" text,
	"emoji" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chest_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"chest_id" integer NOT NULL,
	"rarity_id" integer NOT NULL,
	"reward_type" text NOT NULL,
	"item_id" integer,
	"coin_amount" integer,
	"quantity" integer DEFAULT 1 NOT NULL,
	"weight" integer DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chests" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price" integer NOT NULL,
	"emoji" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crafting_recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" integer NOT NULL,
	"name" text NOT NULL,
	"result_item_id" integer NOT NULL,
	"result_quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_commands" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" integer NOT NULL,
	"trigger" text NOT NULL,
	"response" text NOT NULL,
	"embed_enabled" boolean DEFAULT false NOT NULL,
	"embed_color" text,
	"embed_title" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"username" text NOT NULL,
	"discriminator" text,
	"avatar" text,
	"last_seen" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discord_users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE "economy" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"guild_id" integer NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"bank" integer DEFAULT 0 NOT NULL,
	"last_daily" timestamp,
	"last_weekly" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "economy_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" integer NOT NULL,
	"daily_amount" integer DEFAULT 100 NOT NULL,
	"weekly_amount" integer DEFAULT 500 NOT NULL,
	"starting_balance" integer DEFAULT 100 NOT NULL,
	"max_bank" integer DEFAULT 10000 NOT NULL,
	CONSTRAINT "economy_settings_guild_id_unique" UNIQUE("guild_id")
);
--> statement-breakpoint
CREATE TABLE "guild_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"guild_name" text NOT NULL,
	"prefix" text DEFAULT '!' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guild_settings_guild_id_unique" UNIQUE("guild_id")
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"acquired_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price" integer NOT NULL,
	"emoji" text,
	"item_type" text NOT NULL,
	"is_shop_item" boolean DEFAULT true NOT NULL,
	"role_id" text,
	"use_effect" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logging_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" integer NOT NULL,
	"log_channel" text,
	"log_joins" boolean DEFAULT false NOT NULL,
	"log_leaves" boolean DEFAULT false NOT NULL,
	"log_messages" boolean DEFAULT false NOT NULL,
	"log_moderation" boolean DEFAULT true NOT NULL,
	"log_commands" boolean DEFAULT false NOT NULL,
	CONSTRAINT "logging_settings_guild_id_unique" UNIQUE("guild_id")
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"moderator_id" integer NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"duration" integer,
	"expires_at" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modmail_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"content" text NOT NULL,
	"is_staff" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modmail_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" integer NOT NULL,
	"category_id" text,
	"staff_role_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"dm_forwarding" boolean DEFAULT true NOT NULL,
	"auto_response" boolean DEFAULT true NOT NULL,
	"anonymous_replies" boolean DEFAULT false NOT NULL,
	"transcript_logging" boolean DEFAULT false NOT NULL,
	"ticket_ratings" boolean DEFAULT false NOT NULL,
	"auto_close_inactive" boolean DEFAULT false NOT NULL,
	"inactive_timeout" integer DEFAULT 24 NOT NULL,
	CONSTRAINT "modmail_settings_guild_id_unique" UNIQUE("guild_id")
);
--> statement-breakpoint
CREATE TABLE "modmail_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"channel_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"subject" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "mystery_box_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"box_id" integer NOT NULL,
	"reward_type" text NOT NULL,
	"item_id" integer,
	"coin_amount" integer,
	"quantity" integer DEFAULT 1 NOT NULL,
	"weight" integer DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mystery_boxes" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price" integer NOT NULL,
	"emoji" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" integer NOT NULL,
	"anti_raid" boolean DEFAULT false NOT NULL,
	"raid_threshold" integer DEFAULT 10 NOT NULL,
	"verification_enabled" boolean DEFAULT false NOT NULL,
	"verification_role" text,
	"verification_channel" text,
	CONSTRAINT "security_settings_guild_id_unique" UNIQUE("guild_id")
);
--> statement-breakpoint
CREATE TABLE "warnings" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"moderator_id" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auto_mod_settings" ADD CONSTRAINT "auto_mod_settings_guild_id_guild_settings_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chest_rarities" ADD CONSTRAINT "chest_rarities_guild_id_guild_settings_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chest_rewards" ADD CONSTRAINT "chest_rewards_chest_id_chests_id_fk" FOREIGN KEY ("chest_id") REFERENCES "public"."chests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chest_rewards" ADD CONSTRAINT "chest_rewards_rarity_id_chest_rarities_id_fk" FOREIGN KEY ("rarity_id") REFERENCES "public"."chest_rarities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chest_rewards" ADD CONSTRAINT "chest_rewards_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chests" ADD CONSTRAINT "chests_guild_id_guild_settings_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crafting_recipes" ADD CONSTRAINT "crafting_recipes_guild_id_guild_settings_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crafting_recipes" ADD CONSTRAINT "crafting_recipes_result_item_id_items_id_fk" FOREIGN KEY ("result_item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_commands" ADD CONSTRAINT "custom_commands_guild_id_guild_settings_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "economy" ADD CONSTRAINT "economy_user_id_discord_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."discord_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "economy" ADD CONSTRAINT "economy_guild_id_guild_settings_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "economy_settings" ADD CONSTRAINT "economy_settings_guild_id_guild_settings_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_user_id_discord_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."discord_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_guild_id_guild_settings_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logging_settings" ADD CONSTRAINT "logging_settings_guild_id_guild_settings_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_guild_id_guild_settings_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_user_id_discord_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."discord_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderator_id_discord_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."discord_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modmail_messages" ADD CONSTRAINT "modmail_messages_ticket_id_modmail_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."modmail_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modmail_messages" ADD CONSTRAINT "modmail_messages_author_id_discord_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."discord_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modmail_settings" ADD CONSTRAINT "modmail_settings_guild_id_guild_settings_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modmail_tickets" ADD CONSTRAINT "modmail_tickets_guild_id_guild_settings_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modmail_tickets" ADD CONSTRAINT "modmail_tickets_user_id_discord_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."discord_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mystery_box_rewards" ADD CONSTRAINT "mystery_box_rewards_box_id_mystery_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."mystery_boxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mystery_box_rewards" ADD CONSTRAINT "mystery_box_rewards_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mystery_boxes" ADD CONSTRAINT "mystery_boxes_guild_id_guild_settings_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_crafting_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."crafting_recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_settings" ADD CONSTRAINT "security_settings_guild_id_guild_settings_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_guild_id_guild_settings_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_user_id_discord_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."discord_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_moderator_id_discord_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."discord_users"("id") ON DELETE cascade ON UPDATE no action;