import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { bot } from "./bot";
import { validateWorkflowGraph } from "./workflow-validator";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { 
  insertWelcomeSettingsSchema,
  insertReactionRoleSchema,
  insertEmbedTemplateSchema,
  shadowbanRequestSchema,
  insertGiveawayTemplateSchema,
  insertGiveawayRoleModifierSchema,
  insertGiveawaySettingsSchema,
  insertWorkflowSchema,
  insertWorkflowNodeSchema,
  workflowNodeDataSchema
} from "../shared/schema";
import { z } from "zod";
import type { InsertShadowban, InsertWorkflowNode } from "../shared/schema";

export const router = Router();

// Middleware to check if user is authenticated
function requireAuth(req: Request, res: Response, next: Function) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// Middleware to check if user has admin permissions for the guild
async function requireGuildPermission(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = req.user as any;
  const { guildId } = req.params;

  if (!guildId) {
    res.status(400).json({ error: "Guild ID required" });
    return;
  }

  try {
    const botClient = bot?.getClient();
    if (!botClient) {
      res.status(503).json({ error: "Bot not available" });
      return;
    }

    // Get the guild from bot cache
    const guild = botClient.guilds.cache.get(guildId);
    if (!guild) {
      res.status(404).json({ error: "Guild not found or bot not in guild" });
      return;
    }

    // Bypass check for guild owner
    if (guild.ownerId === user.id) {
      next();
      return;
    }

    // Fetch the user's guild member info
    let member;
    try {
      member = await guild.members.fetch(user.id);
    } catch (error: any) {
      // Handle specific Discord API errors
      if (error.code === 10007) {
        // Unknown Member
        res.status(403).json({ error: "You are not a member of this guild" });
      } else if (error.code === 50013) {
        // Missing Permissions (bot lacks GuildMembers intent or permissions)
        console.error('Bot lacks permissions to fetch guild members:', error);
        res.status(503).json({ error: "Bot is missing required permissions to verify your access" });
      } else {
        console.error('Error fetching guild member:', error);
        res.status(403).json({ error: "Failed to verify guild membership" });
      }
      return;
    }

    // Check if user has Administrator or ManageGuild permission
    const hasPermission = member.permissions.has('Administrator') || member.permissions.has('ManageGuild');
    
    if (!hasPermission) {
      res.status(403).json({ error: "You need Administrator or Manage Server permission to access this" });
      return;
    }

    next();
  } catch (error) {
    console.error('Error checking guild permissions:', error);
    res.status(500).json({ error: "Failed to verify permissions" });
  }
}

// Get bot status
router.get("/api/bot/status", (req, res) => {
  const status = bot?.isClientReady() ? "online" : "offline";
  const guilds = bot?.getClient().guilds.cache.size || 0;
  const users = bot?.getClient().users.cache.size || 0;
  
  res.json({
    status,
    guilds,
    users,
    uptime: process.uptime(),
  });
});

// Simple in-memory cache for roles/channels with 60s TTL
const guildDataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 60 seconds

function getCached(key: string): any | null {
  const cached = guildDataCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any): void {
  guildDataCache.set(key, { data, timestamp: Date.now() });
}

// Get user's guilds
router.get("/api/guilds", requireAuth, (req, res) => {
  const user = req.user as any;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const botClient = bot?.getClient();
  if (!botClient) {
    res.json([]);
    return;
  }

  const mutualGuilds = botClient.guilds.cache
    .filter(guild => {
      // In a real app, you'd check if the user is in this guild via Discord API
      return true;
    })
    .map(guild => ({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL(),
      memberCount: guild.memberCount,
    }));

  res.json(mutualGuilds);
});

// Get guild roles
router.get("/api/guilds/:guildId/roles", requireGuildPermission, async (req, res) => {
  try {
    const { guildId } = req.params;
    const cacheKey = `roles-${guildId}`;
    
    // Check cache first
    const cached = getCached(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const botClient = bot?.getClient();
    if (!botClient) {
      res.status(503).json({ error: "Bot not available" });
      return;
    }

    const guild = botClient.guilds.cache.get(guildId);
    if (!guild) {
      res.status(404).json({ error: "Guild not found" });
      return;
    }

    // Fetch roles from Discord cache or API
    let roles = guild.roles.cache;
    if (roles.size === 0) {
      // Fallback to REST API if cache is empty
      await guild.roles.fetch();
      roles = guild.roles.cache;
    }

    const roleList = roles
      .filter(role => role.id !== guildId) // Exclude @everyone unless needed
      .map(role => ({
        id: role.id,
        name: role.name,
        color: role.color,
        position: role.position,
      }))
      .sort((a, b) => b.position - a.position); // Highest position first

    setCache(cacheKey, roleList);
    res.json(roleList);
  } catch (error) {
    console.error('Error fetching guild roles:', error);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

// Get guild channels
router.get("/api/guilds/:guildId/channels", requireGuildPermission, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { type } = req.query; // Optional filter by channel type
    const cacheKey = `channels-${guildId}-${type || 'all'}`;
    
    // Check cache first
    const cached = getCached(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const botClient = bot?.getClient();
    if (!botClient) {
      res.status(503).json({ error: "Bot not available" });
      return;
    }

    const guild = botClient.guilds.cache.get(guildId);
    if (!guild) {
      res.status(404).json({ error: "Guild not found" });
      return;
    }

    // Fetch channels from Discord cache or API
    let channels = guild.channels.cache;
    if (channels.size === 0) {
      // Fallback to REST API if cache is empty
      await guild.channels.fetch();
      channels = guild.channels.cache;
    }

    let channelList = Array.from(channels.values()).map(channel => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
    }));

    // Filter by type if specified (0=text, 2=voice, 4=category, etc.)
    if (type) {
      const typeNum = parseInt(type as string);
      channelList = channelList.filter(ch => ch.type === typeNum);
    }

    // Sort: categories first, then by name
    channelList.sort((a, b) => {
      if (a.type === 4 && b.type !== 4) return -1;
      if (a.type !== 4 && b.type === 4) return 1;
      return a.name.localeCompare(b.name);
    });

    setCache(cacheKey, channelList);
    res.json(channelList);
  } catch (error) {
    console.error('Error fetching guild channels:', error);
    res.status(500).json({ error: "Failed to fetch channels" });
  }
});

// Guild Settings
router.get("/api/guilds/:guildId/settings", requireGuildPermission, async (req, res) => {
  try {
    const { guildId } = req.params;
    const guild = bot?.getClient().guilds.cache.get(guildId);
    if (!guild) {
      res.status(404).json({ error: "Guild not found" });
      return;
    }

    const settings = await storage.getOrCreateGuildSettings(guildId, guild.name);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.patch("/api/guilds/:guildId/settings", requireGuildPermission, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = await storage.updateGuildSettings(guildId, req.body);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// Economy
router.get("/api/guilds/:guildId/economy/settings", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const settings = await storage.getEconomySettings(guild.id);
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch economy settings" });
  }
});

router.patch("/api/guilds/:guildId/economy/settings", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const settings = await storage.updateEconomySettings(guild.id, req.body);
    
    // Re-register slash commands when economy module is toggled
    if (bot && req.body.enabled !== undefined) {
      await bot.registerSlashCommandsForGuild(req.params.guildId);
    }
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to update economy settings" });
  }
});

// Items
router.get("/api/guilds/:guildId/items", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const items = await storage.getItems(guild.id);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

router.post("/api/guilds/:guildId/items", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const item = await storage.createItem({ ...req.body, guildId: guild.id });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: "Failed to create item" });
  }
});

router.patch("/api/guilds/:guildId/items/:itemId", requireGuildPermission, async (req, res) => {
  try {
    const item = await storage.updateItem(parseInt(req.params.itemId), req.body);
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: "Failed to update item" });
  }
});

router.delete("/api/guilds/:guildId/items/:itemId", requireGuildPermission, async (req, res) => {
  try {
    await storage.deleteItem(parseInt(req.params.itemId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// Trades routes
router.get("/api/guilds/:guildId/trades", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const user = req.user as any;
    const discordUser = await storage.getDiscordUser(user.id);
    if (!discordUser) {
      return res.status(404).json({ error: "User not found" });
    }
    const trades = await storage.getTradesForUser(discordUser.id, guild.id);
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch trades" });
  }
});

router.post("/api/guilds/:guildId/trades", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const user = req.user as any;
    const discordUser = await storage.getDiscordUser(user.id);
    if (!discordUser) {
      return res.status(404).json({ error: "User not found" });
    }
    const trade = await storage.createTrade({
      ...req.body,
      senderId: discordUser.id,
      guildId: guild.id
    });
    res.json(trade);
  } catch (error) {
    res.status(500).json({ error: "Failed to create trade" });
  }
});

router.patch("/api/guilds/:guildId/trades/:tradeId", requireGuildPermission, async (req, res) => {
  try {
    const tradeId = parseInt(req.params.tradeId);
    const { status } = req.body;
    
    if (status === 'accepted') {
      const success = await storage.acceptTrade(tradeId);
      if (!success) {
        return res.status(400).json({ error: "Failed to execute trade" });
      }
      res.json({ success: true });
    } else {
      const trade = await storage.updateTrade(tradeId, { status });
      res.json(trade);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to update trade" });
  }
});

router.delete("/api/guilds/:guildId/trades/:tradeId", requireGuildPermission, async (req, res) => {
  try {
    const tradeId = parseInt(req.params.tradeId);
    await storage.deleteTrade(tradeId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete trade" });
  }
});

// Mystery Boxes
router.get("/api/guilds/:guildId/boxes", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const boxes = await storage.getMysteryBoxes(guild.id);
    res.json(boxes);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch boxes" });
  }
});

router.post("/api/guilds/:guildId/boxes", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const { rewards, ...boxData } = req.body;
    const box = await storage.createMysteryBox({ ...boxData, guildId: guild.id });
    
    // Add rewards if provided
    if (rewards && Array.isArray(rewards)) {
      await storage.replaceBoxRewards(box.id, rewards);
    }
    
    res.json(box);
  } catch (error) {
    res.status(500).json({ error: "Failed to create box" });
  }
});

router.get("/api/guilds/:guildId/boxes/:boxId/rewards", requireGuildPermission, async (req, res) => {
  try {
    const rewards = await storage.getMysteryBoxRewards(parseInt(req.params.boxId));
    res.json(rewards);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rewards" });
  }
});

router.post("/api/guilds/:guildId/boxes/:boxId/rewards", requireGuildPermission, async (req, res) => {
  try {
    const reward = await storage.addMysteryBoxReward({ ...req.body, boxId: parseInt(req.params.boxId) });
    res.json(reward);
  } catch (error) {
    res.status(500).json({ error: "Failed to add reward" });
  }
});

router.patch("/api/guilds/:guildId/boxes/:boxId", requireGuildPermission, async (req, res) => {
  try {
    const { rewards, ...boxData } = req.body;
    const box = await storage.updateMysteryBox(parseInt(req.params.boxId), boxData);
    
    // Update rewards if provided
    if (rewards && Array.isArray(rewards)) {
      await storage.replaceBoxRewards(parseInt(req.params.boxId), rewards);
    }
    
    res.json(box);
  } catch (error) {
    res.status(500).json({ error: "Failed to update box" });
  }
});

router.delete("/api/guilds/:guildId/boxes/:boxId", requireGuildPermission, async (req, res) => {
  try {
    await storage.deleteMysteryBox(parseInt(req.params.boxId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete box" });
  }
});

// Chests
router.get("/api/guilds/:guildId/chests", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const chests = await storage.getChests(guild.id);
    res.json(chests);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch chests" });
  }
});

router.post("/api/guilds/:guildId/chests", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const chest = await storage.createChest({ ...req.body, guildId: guild.id });
    res.json(chest);
  } catch (error) {
    res.status(500).json({ error: "Failed to create chest" });
  }
});

router.patch("/api/guilds/:guildId/chests/:chestId", requireGuildPermission, async (req, res) => {
  try {
    const chest = await storage.updateChest(parseInt(req.params.chestId), req.body);
    res.json(chest);
  } catch (error) {
    res.status(500).json({ error: "Failed to update chest" });
  }
});

router.delete("/api/guilds/:guildId/chests/:chestId", requireGuildPermission, async (req, res) => {
  try {
    await storage.deleteChest(parseInt(req.params.chestId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete chest" });
  }
});

// Chest Rarities
router.get("/api/guilds/:guildId/chests/rarities", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const rarities = await storage.getChestRarities(guild.id);
    res.json(rarities);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rarities" });
  }
});

router.post("/api/guilds/:guildId/chests/rarities", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const rarity = await storage.createChestRarity({ ...req.body, guildId: guild.id });
    res.json(rarity);
  } catch (error) {
    res.status(500).json({ error: "Failed to create rarity" });
  }
});

router.patch("/api/guilds/:guildId/chests/rarities/:rarityId", requireGuildPermission, async (req, res) => {
  try {
    const rarity = await storage.updateChestRarity(parseInt(req.params.rarityId), req.body);
    res.json(rarity);
  } catch (error) {
    res.status(500).json({ error: "Failed to update rarity" });
  }
});

router.delete("/api/guilds/:guildId/chests/rarities/:rarityId", requireGuildPermission, async (req, res) => {
  try {
    await storage.deleteChestRarity(parseInt(req.params.rarityId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete rarity" });
  }
});

// Chest Rewards
router.get("/api/guilds/:guildId/chests/:chestId/rewards", requireGuildPermission, async (req, res) => {
  try {
    const rewards = await storage.getChestRewards(parseInt(req.params.chestId));
    res.json(rewards);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rewards" });
  }
});

router.post("/api/guilds/:guildId/chests/:chestId/rewards", requireGuildPermission, async (req, res) => {
  try {
    const reward = await storage.addChestReward({ ...req.body, chestId: parseInt(req.params.chestId) });
    res.json(reward);
  } catch (error) {
    res.status(500).json({ error: "Failed to add reward" });
  }
});

router.patch("/api/guilds/:guildId/chests/rewards/:rewardId", requireGuildPermission, async (req, res) => {
  try {
    const reward = await storage.updateChestReward(parseInt(req.params.rewardId), req.body);
    res.json(reward);
  } catch (error) {
    res.status(500).json({ error: "Failed to update reward" });
  }
});

router.delete("/api/guilds/:guildId/chests/rewards/:rewardId", requireGuildPermission, async (req, res) => {
  try {
    await storage.deleteChestReward(parseInt(req.params.rewardId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete reward" });
  }
});

// Crafting
router.get("/api/guilds/:guildId/recipes", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const recipes = await storage.getCraftingRecipes(guild.id);
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch recipes" });
  }
});

router.post("/api/guilds/:guildId/recipes", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const { ingredients, ...recipeData } = req.body;
    const recipe = await storage.createCraftingRecipe({ ...recipeData, guildId: guild.id });
    
    // Add ingredients if provided
    if (ingredients && Array.isArray(ingredients)) {
      await storage.replaceRecipeIngredients(recipe.id, ingredients);
    }
    
    res.json(recipe);
  } catch (error) {
    res.status(500).json({ error: "Failed to create recipe" });
  }
});

router.patch("/api/guilds/:guildId/recipes/:recipeId", requireGuildPermission, async (req, res) => {
  try {
    const { ingredients, ...recipeData } = req.body;
    const recipe = await storage.updateCraftingRecipe(parseInt(req.params.recipeId), recipeData);
    
    // Update ingredients if provided
    if (ingredients && Array.isArray(ingredients)) {
      await storage.replaceRecipeIngredients(parseInt(req.params.recipeId), ingredients);
    }
    
    res.json(recipe);
  } catch (error) {
    res.status(500).json({ error: "Failed to update recipe" });
  }
});

router.delete("/api/guilds/:guildId/recipes/:recipeId", requireGuildPermission, async (req, res) => {
  try {
    await storage.deleteCraftingRecipe(parseInt(req.params.recipeId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete recipe" });
  }
});

// Modmail
router.get("/api/guilds/:guildId/modmail/tickets", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const tickets = await storage.getModmailTickets(guild.id);
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

router.get("/api/guilds/:guildId/modmail/settings", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const settings = await storage.getModmailSettings(guild.id);
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch modmail settings" });
  }
});

router.patch("/api/guilds/:guildId/modmail/settings", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const settings = await storage.updateModmailSettings(guild.id, req.body);
    
    // Auto-register slash commands when module is enabled/disabled
    if (bot) {
      await bot.registerSlashCommandsForGuild(req.params.guildId);
    }
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to update modmail settings" });
  }
});

// Moderation
router.get("/api/guilds/:guildId/moderation/actions", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const actions = await storage.getModerationActions(guild.id);
    res.json(actions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch moderation actions" });
  }
});

router.get("/api/guilds/:guildId/moderation/automod", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const settings = await storage.getAutoModSettings(guild.id);
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch automod settings" });
  }
});

router.patch("/api/guilds/:guildId/moderation/automod", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const settings = await storage.updateAutoModSettings(guild.id, req.body);
    
    // Auto-register slash commands when module is enabled/disabled
    if (bot) {
      await bot.registerSlashCommandsForGuild(req.params.guildId);
    }
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to update automod settings" });
  }
});

// Shadowbans
router.get("/api/guilds/:guildId/shadowbans", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const shadowbans = await storage.getShadowbans(guild.id);
    res.json(shadowbans);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch shadowbans" });
  }
});

router.post("/api/guilds/:guildId/shadowbans", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const user = req.user as any;
    const moderator = await storage.getDiscordUser(user.id);
    
    if (!moderator) {
      return res.status(404).json({ error: "Moderator not found" });
    }

    // Validate request body
    const validatedRequest = shadowbanRequestSchema.parse(req.body);

    // Look up or create the target user by their Discord ID
    const targetUser = await storage.getOrCreateDiscordUser(
      validatedRequest.discordId, 
      `User-${validatedRequest.discordId}`
    );

    // Construct the DB insert object with proper type
    const shadowbanInsert: InsertShadowban = {
      userId: targetUser.id,
      guildId: guild.id,
      moderatorId: moderator.id,
      reason: validatedRequest.reason || "No reason provided"
    };

    // Create the shadowban
    const shadowban = await storage.createShadowban(shadowbanInsert);

    res.json(shadowban);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request data", details: error.issues });
    } else {
      console.error("Error creating shadowban:", error);
      res.status(500).json({ error: "Failed to create shadowban" });
    }
  }
});

router.delete("/api/guilds/:guildId/shadowbans/:shadowbanId", requireGuildPermission, async (req, res) => {
  try {
    const shadowbanId = parseInt(req.params.shadowbanId);
    await storage.deleteShadowban(shadowbanId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove shadowban" });
  }
});

// Security
router.get("/api/guilds/:guildId/security", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const settings = await storage.getSecuritySettings(guild.id);
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch security settings" });
  }
});

router.patch("/api/guilds/:guildId/security", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const settings = await storage.updateSecuritySettings(guild.id, req.body);
    
    // Re-register slash commands when security module is toggled
    if (bot && req.body.enabled !== undefined) {
      await bot.registerSlashCommandsForGuild(req.params.guildId);
    }
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to update security settings" });
  }
});

// Appeals
router.get("/api/guilds/:guildId/appeals/settings", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const settings = await storage.getAppealSettings(guild.id);
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch appeal settings" });
  }
});

router.patch("/api/guilds/:guildId/appeals/settings", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const settings = await storage.updateAppealSettings(guild.id, req.body);
    
    // Re-register slash commands when appeal module is toggled
    if (bot && req.body.enabled !== undefined) {
      await bot.registerSlashCommandsForGuild(req.params.guildId);
    }
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to update appeal settings" });
  }
});

router.get("/api/guilds/:guildId/appeals", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const status = req.query.status as string | undefined;
    const appeals = await storage.getAppeals(guild.id, status);
    res.json(appeals);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch appeals" });
  }
});

router.get("/api/guilds/:guildId/appeals/:id", requireGuildPermission, async (req, res) => {
  try {
    const appeal = await storage.getAppeal(parseInt(req.params.id));
    if (!appeal) {
      return res.status(404).json({ error: "Appeal not found" });
    }
    res.json(appeal);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch appeal" });
  }
});

router.post("/api/guilds/:guildId/appeals", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const appeal = await storage.createAppeal({ ...req.body, guildId: guild.id });
    res.json(appeal);
  } catch (error) {
    res.status(500).json({ error: "Failed to create appeal" });
  }
});

router.patch("/api/guilds/:guildId/appeals/:id", requireGuildPermission, async (req, res) => {
  try {
    const appeal = await storage.getAppeal(parseInt(req.params.id));
    if (!appeal) {
      return res.status(404).json({ error: "Appeal not found" });
    }
    
    // Update appeal with decision (storage handles the fields)
    const updateData: any = { ...req.body };
    if (req.body.status) {
      updateData.decidedAt = new Date();
    }
    
    const updated = await storage.updateAppeal(appeal.id, updateData);
    
    // If approved, unban the user via bot
    if (req.body.status === 'approved' && bot && appeal.moderationActionId) {
      try {
        // Deactivate the ban in database
        await storage.deactivateModerationAction(appeal.moderationActionId);
        
        // Unban via Discord API
        const discordUserResult = await db.select().from(schema.discordUsers).where(eq(schema.discordUsers.id, appeal.userId));
        if (discordUserResult[0] && bot) {
          const client = bot.getClient();
          const guildObj = await client.guilds.fetch(req.params.guildId);
          if (guildObj) {
            await guildObj.bans.remove(discordUserResult[0].discordId, "Appeal approved");
          }
        }
      } catch (error) {
        console.error('Failed to unban user:', error);
      }
    }
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update appeal" });
  }
});

// Logging
router.get("/api/guilds/:guildId/logging", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const settings = await storage.getLoggingSettings(guild.id);
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch logging settings" });
  }
});

router.patch("/api/guilds/:guildId/logging", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const settings = await storage.updateLoggingSettings(guild.id, req.body);
    
    // Re-register slash commands when logging module is toggled
    if (bot && req.body.enabled !== undefined) {
      await bot.registerSlashCommandsForGuild(req.params.guildId);
    }
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to update logging settings" });
  }
});

// Custom Commands
router.get("/api/guilds/:guildId/commands", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const commands = await storage.getCustomCommands(guild.id);
    res.json(commands);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch commands" });
  }
});

router.post("/api/guilds/:guildId/commands", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const command = await storage.createCustomCommand({ ...req.body, guildId: guild.id });
    
    // Re-register slash commands if this is a slash command
    if (req.body.isSlashCommand && bot) {
      await bot.registerSlashCommandsForGuild(req.params.guildId);
    }
    
    res.json(command);
  } catch (error) {
    res.status(500).json({ error: "Failed to create command" });
  }
});

router.patch("/api/guilds/:guildId/commands/:commandId", requireGuildPermission, async (req, res) => {
  try {
    const command = await storage.updateCustomCommand(parseInt(req.params.commandId), req.body);
    
    // Re-register slash commands if this command is (or was) a slash command
    if (bot) {
      await bot.registerSlashCommandsForGuild(req.params.guildId);
    }
    
    res.json(command);
  } catch (error) {
    res.status(500).json({ error: "Failed to update command" });
  }
});

router.delete("/api/guilds/:guildId/commands/:commandId", requireGuildPermission, async (req, res) => {
  try {
    await storage.deleteCustomCommand(parseInt(req.params.commandId));
    
    // Re-register slash commands to remove deleted command
    if (bot) {
      await bot.registerSlashCommandsForGuild(req.params.guildId);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete command" });
  }
});

// Workflows
router.get("/api/guilds/:guildId/workflows", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const workflows = await storage.getWorkflows(guild.id);
    res.json(workflows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch workflows" });
  }
});

router.get("/api/guilds/:guildId/workflows/:workflowId", requireGuildPermission, async (req, res) => {
  try {
    const workflow = await storage.getWorkflow(parseInt(req.params.workflowId));
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    const nodes = await storage.getWorkflowNodes(workflow.id);
    res.json({ ...workflow, nodes });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch workflow" });
  }
});

// Atomic save endpoint - saves workflow + all nodes in a database transaction
router.post("/api/guilds/:guildId/workflows/save", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    
    // Validate workflow metadata
    const workflowParsed = insertWorkflowSchema.safeParse({
      ...req.body.workflow,
      guildId: guild.id
    });
    if (!workflowParsed.success) {
      return res.status(400).json({ 
        error: "Invalid workflow data", 
        code: "VALIDATION_ERROR",
        field: "workflow",
        details: workflowParsed.error 
      });
    }
    
    // Validate nodes
    if (!Array.isArray(req.body.nodes)) {
      return res.status(400).json({ 
        error: "Nodes must be an array", 
        code: "VALIDATION_ERROR",
        field: "nodes"
      });
    }
    
    // Validate all nodes before starting transaction and extract node IDs
    const validatedNodes = [];
    const nodeIdsForValidation = [];
    
    for (const nodeData of req.body.nodes) {
      const nodeParsed = insertWorkflowNodeSchema.partial().safeParse(nodeData);
      if (!nodeParsed.success) {
        return res.status(400).json({ 
          error: "Invalid node data", 
          code: "VALIDATION_ERROR",
          field: "nodes",
          details: nodeParsed.error 
        });
      }
      
      const nodeDataValidation = workflowNodeDataSchema.safeParse(nodeParsed.data.nodeData);
      if (!nodeDataValidation.success) {
        return res.status(400).json({ 
          error: "Invalid node configuration", 
          code: "NODE_DATA_ERROR",
          field: "nodeData",
          details: nodeDataValidation.error 
        });
      }
      
      // Extract node ID from request (clientId, id, or generate from index)
      const nodeId = nodeData.clientId || nodeData.id || `node-${validatedNodes.length}`;
      nodeIdsForValidation.push(nodeId);
      validatedNodes.push(nodeParsed.data);
    }
    
    // Graph-level validation using extracted node IDs
    const graphValidation = validateWorkflowGraph(validatedNodes.map((node, index) => ({
      id: nodeIdsForValidation[index],
      nodeType: node.nodeType!,
      nodeData: node.nodeData as any
    })));
    
    if (!graphValidation.valid) {
      return res.status(400).json({
        error: "Invalid workflow graph",
        code: "GRAPH_VALIDATION_ERROR",
        details: graphValidation.errors
      });
    }
    
    // Execute workflow + nodes creation in a transaction
    const result = await storage.createWorkflowWithNodes(workflowParsed.data, validatedNodes);
    
    // Register/unregister Discord command based on enabled state
    if (bot) {
      await bot.registerSlashCommandsForGuild(req.params.guildId);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to save workflow" });
  }
});

// Update existing workflow atomically with transaction
router.patch("/api/guilds/:guildId/workflows/:workflowId/save", requireGuildPermission, async (req, res) => {
  try {
    const workflowId = parseInt(req.params.workflowId);
    const existing = await storage.getWorkflow(workflowId);
    
    if (!existing) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    
    // Validate workflow metadata (partial for updates)
    const workflowParsed = insertWorkflowSchema.partial().safeParse(req.body.workflow);
    if (!workflowParsed.success) {
      return res.status(400).json({ 
        error: "Invalid workflow data", 
        code: "VALIDATION_ERROR",
        field: "workflow",
        details: workflowParsed.error 
      });
    }
    
    // If nodes provided, validate all nodes before transaction
    let validatedNodes: Partial<InsertWorkflowNode>[] | undefined = undefined;
    let nodeIdsForValidation: string[] = [];
    
    if (req.body.nodes && Array.isArray(req.body.nodes)) {
      validatedNodes = [];
      for (const nodeData of req.body.nodes) {
        const nodeParsed = insertWorkflowNodeSchema.partial().safeParse(nodeData);
        if (!nodeParsed.success) {
          return res.status(400).json({ 
            error: "Invalid node data", 
            code: "VALIDATION_ERROR",
            field: "nodes",
            details: nodeParsed.error 
          });
        }
        
        const nodeDataValidation = workflowNodeDataSchema.safeParse(nodeParsed.data.nodeData);
        if (!nodeDataValidation.success) {
          return res.status(400).json({ 
            error: "Invalid node configuration", 
            code: "NODE_DATA_ERROR",
            field: "nodeData",
            details: nodeDataValidation.error 
          });
        }
        
        // Extract node ID from request
        const nodeId = nodeData.clientId || nodeData.id || `node-${validatedNodes.length}`;
        nodeIdsForValidation.push(nodeId);
        validatedNodes.push(nodeParsed.data);
      }
    }
    
    // Graph-level validation (if nodes are being updated)
    if (validatedNodes) {
      const graphValidation = validateWorkflowGraph(validatedNodes.map((node, index) => ({
        id: nodeIdsForValidation[index],
        nodeType: node.nodeType!,
        nodeData: node.nodeData as any
      })));
      
      if (!graphValidation.valid) {
        return res.status(400).json({
          error: "Invalid workflow graph",
          code: "GRAPH_VALIDATION_ERROR",
          details: graphValidation.errors
        });
      }
    }
    
    // Update workflow and nodes transactionally
    const result = validatedNodes
      ? await storage.updateWorkflowWithNodes(workflowId, workflowParsed.data, validatedNodes, existing.version)
      : await storage.updateWorkflow(workflowId, workflowParsed.data, existing.version).then(workflow => 
          workflow ? storage.getWorkflowNodes(workflowId).then(nodes => ({ workflow, nodes })) : undefined
        );
    
    if (!result) {
      return res.status(409).json({ 
        error: "Workflow has been modified by another user", 
        code: "VERSION_CONFLICT",
        currentVersion: (await storage.getWorkflow(workflowId))?.version
      });
    }
    
    // Re-register commands if enabled state changed
    if (bot && req.body.workflow?.enabled !== undefined) {
      await bot.registerSlashCommandsForGuild(req.params.guildId);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update workflow" });
  }
});

router.delete("/api/guilds/:guildId/workflows/:workflowId", requireGuildPermission, async (req, res) => {
  try {
    await storage.deleteWorkflow(parseInt(req.params.workflowId));
    
    // Unregister command from Discord
    if (bot) {
      await bot.registerSlashCommandsForGuild(req.params.guildId);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete workflow" });
  }
});

// Welcome/Leave System
router.get("/api/guilds/:guildId/welcome", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const settings = await storage.getWelcomeSettings(guild.id);
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch welcome settings" });
  }
});

router.patch("/api/guilds/:guildId/welcome", requireGuildPermission, async (req, res) => {
  try {
    const parsed = insertWelcomeSettingsSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid welcome settings data", details: parsed.error });
    }
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const settings = await storage.updateWelcomeSettings(guild.id, parsed.data);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to update welcome settings" });
  }
});

// Reaction Roles
router.get("/api/guilds/:guildId/reaction-roles", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const roles = await storage.getReactionRoles(guild.id);
    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reaction roles" });
  }
});

router.post("/api/guilds/:guildId/reaction-roles", requireGuildPermission, async (req, res) => {
  try {
    const parsed = insertReactionRoleSchema.omit({ guildId: true }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid reaction role data", details: parsed.error });
    }
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const role = await storage.createReactionRole({ ...parsed.data, guildId: guild.id } as any);
    
    // Add reaction to the message via bot
    if (bot) {
      try {
        await bot.addReactionRole(parsed.data.channelId, parsed.data.messageId, parsed.data.emoji);
      } catch (error) {
        console.error("Failed to add reaction to message:", error);
      }
    }
    
    res.json(role);
  } catch (error) {
    res.status(500).json({ error: "Failed to create reaction role" });
  }
});

router.patch("/api/guilds/:guildId/reaction-roles/:roleId", requireGuildPermission, async (req, res) => {
  try {
    const parsed = insertReactionRoleSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid reaction role data", details: parsed.error });
    }
    const role = await storage.updateReactionRole(parseInt(req.params.roleId), parsed.data);
    res.json(role);
  } catch (error) {
    res.status(500).json({ error: "Failed to update reaction role" });
  }
});

router.delete("/api/guilds/:guildId/reaction-roles/:roleId", requireGuildPermission, async (req, res) => {
  try {
    await storage.deleteReactionRole(parseInt(req.params.roleId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete reaction role" });
  }
});

// Embed Templates
router.get("/api/guilds/:guildId/embeds", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const templates = await storage.getEmbedTemplates(guild.id);
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch embed templates" });
  }
});

router.post("/api/guilds/:guildId/embeds", requireGuildPermission, async (req, res) => {
  try {
    const parsed = insertEmbedTemplateSchema.omit({ guildId: true }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid embed template data", details: parsed.error });
    }
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const template = await storage.createEmbedTemplate({ ...parsed.data, guildId: guild.id } as any);
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: "Failed to create embed template" });
  }
});

router.patch("/api/guilds/:guildId/embeds/:embedId", requireGuildPermission, async (req, res) => {
  try {
    const parsed = insertEmbedTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid embed template data", details: parsed.error });
    }
    const template = await storage.updateEmbedTemplate(parseInt(req.params.embedId), parsed.data);
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: "Failed to update embed template" });
  }
});

router.delete("/api/guilds/:guildId/embeds/:embedId", requireGuildPermission, async (req, res) => {
  try {
    await storage.deleteEmbedTemplate(parseInt(req.params.embedId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete embed template" });
  }
});

router.post("/api/guilds/:guildId/embeds/:embedId/send", requireGuildPermission, async (req, res) => {
  try {
    const template = await storage.getEmbedTemplate(parseInt(req.params.embedId));
    if (!template) {
      return res.status(404).json({ error: "Embed template not found" });
    }
    
    if (bot) {
      await bot.sendEmbed(req.body.channelId, template.embedData);
      res.json({ success: true });
    } else {
      res.status(503).json({ error: "Bot is not available" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to send embed" });
  }
});

// Statistics Dashboard
router.get("/api/guilds/:guildId/stats", requireGuildPermission, async (req, res) => {
  try {
    if (!bot) {
      return res.status(503).json({ error: "Bot is not available" });
    }
    
    const stats = await bot.getGuildStats(req.params.guildId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch guild stats" });
  }
});

// Giveaway Settings
router.get("/api/guilds/:guildId/giveaway-settings", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const settings = await storage.getGiveawaySettings(guild.id);
    res.json(settings || { enabled: false });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch giveaway settings" });
  }
});

router.patch("/api/guilds/:guildId/giveaway-settings", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const parsed = insertGiveawaySettingsSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid giveaway settings data", details: parsed.error });
    }
    const settings = await storage.updateGiveawaySettings(guild.id, parsed.data);
    
    if (bot) {
      await bot.registerSlashCommandsForGuild(req.params.guildId);
    }
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to update giveaway settings" });
  }
});

// Giveaway Templates
router.get("/api/guilds/:guildId/giveaway-templates", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const templates = await storage.getGiveawayTemplates(guild.id);
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch giveaway templates" });
  }
});

router.post("/api/guilds/:guildId/giveaway-templates", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const parsed = insertGiveawayTemplateSchema.omit({ guildId: true }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid template data", details: parsed.error });
    }
    const template = await storage.createGiveawayTemplate({
      guildId: guild.id,
      ...parsed.data
    });
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: "Failed to create giveaway template" });
  }
});

router.patch("/api/guilds/:guildId/giveaway-templates/:templateId", requireGuildPermission, async (req, res) => {
  try {
    const parsed = insertGiveawayTemplateSchema.partial().omit({ guildId: true }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid template data", details: parsed.error });
    }
    const template = await storage.updateGiveawayTemplate(parseInt(req.params.templateId), parsed.data);
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: "Failed to update giveaway template" });
  }
});

router.delete("/api/guilds/:guildId/giveaway-templates/:templateId", requireGuildPermission, async (req, res) => {
  try {
    await storage.deleteGiveawayTemplate(parseInt(req.params.templateId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete giveaway template" });
  }
});

// Giveaway Role Modifiers
router.get("/api/guilds/:guildId/giveaway-role-modifiers", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const modifiers = await storage.getGiveawayRoleModifiers(guild.id);
    res.json(modifiers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch role modifiers" });
  }
});

router.post("/api/guilds/:guildId/giveaway-role-modifiers", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const parsed = insertGiveawayRoleModifierSchema.omit({ guildId: true }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid role modifier data", details: parsed.error });
    }
    const modifier = await storage.createGiveawayRoleModifier({
      guildId: guild.id,
      ...parsed.data
    });
    res.json(modifier);
  } catch (error) {
    res.status(500).json({ error: "Failed to create role modifier" });
  }
});

router.patch("/api/guilds/:guildId/giveaway-role-modifiers/:modifierId", requireGuildPermission, async (req, res) => {
  try {
    const parsed = insertGiveawayRoleModifierSchema.partial().omit({ guildId: true }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid role modifier data", details: parsed.error });
    }
    const modifier = await storage.updateGiveawayRoleModifier(parseInt(req.params.modifierId), parsed.data);
    res.json(modifier);
  } catch (error) {
    res.status(500).json({ error: "Failed to update role modifier" });
  }
});

router.delete("/api/guilds/:guildId/giveaway-role-modifiers/:modifierId", requireGuildPermission, async (req, res) => {
  try {
    await storage.deleteGiveawayRoleModifier(parseInt(req.params.modifierId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete role modifier" });
  }
});

// Giveaways List
router.get("/api/guilds/:guildId/giveaways", requireGuildPermission, async (req, res) => {
  try {
    const guild = await storage.getOrCreateGuildSettings(req.params.guildId, "");
    const activeOnly = req.query.active === 'true';
    const giveaways = await storage.getGiveaways(guild.id, activeOnly);
    res.json(giveaways);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch giveaways" });
  }
});
