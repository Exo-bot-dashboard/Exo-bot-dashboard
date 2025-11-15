// Storage interface based on blueprint:javascript_database
import { db } from "./db";
import { eq, and, desc, or, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  DiscordUser, InsertDiscordUser,
  GuildSettings, InsertGuildSettings,
  Economy, InsertEconomy,
  EconomySettings, InsertEconomySettings,
  Item, InsertItem,
  Inventory, InsertInventory,
  Trade, InsertTrade,
  MysteryBox, InsertMysteryBox,
  MysteryBoxReward, InsertMysteryBoxReward,
  Chest, InsertChest,
  ChestRarity, InsertChestRarity,
  ChestReward, InsertChestReward,
  CraftingRecipe, InsertCraftingRecipe,
  RecipeIngredient, InsertRecipeIngredient,
  ModmailTicket, InsertModmailTicket,
  ModmailMessage, InsertModmailMessage,
  ModmailSettings, InsertModmailSettings,
  Warning, InsertWarning,
  ModerationAction, InsertModerationAction,
  Shadowban, InsertShadowban,
  AutoModSettings, InsertAutoModSettings,
  SecuritySettings, InsertSecuritySettings,
  LoggingSettings, InsertLoggingSettings,
  CustomCommand, InsertCustomCommand,
  Workflow, InsertWorkflow,
  WorkflowNode, InsertWorkflowNode,
  WelcomeSettings, InsertWelcomeSettings,
  ReactionRole, InsertReactionRole,
  EmbedTemplate, InsertEmbedTemplate,
  Giveaway, InsertGiveaway,
  GiveawayTemplate, InsertGiveawayTemplate,
  GiveawayEntry, InsertGiveawayEntry,
  GiveawayRoleModifier, InsertGiveawayRoleModifier,
  GiveawaySettings, InsertGiveawaySettings,
  Appeal, InsertAppeal,
  AppealSettings, InsertAppealSettings
} from "@shared/schema";

export interface IStorage {
  // Discord Users
  getDiscordUser(discordId: string): Promise<DiscordUser | undefined>;
  getOrCreateDiscordUser(discordId: string, username: string, discriminator?: string, avatar?: string): Promise<DiscordUser>;
  updateUserLastSeen(discordId: string): Promise<void>;
  
  // Guild Settings
  getOrCreateGuildSettings(guildId: string, guildName: string): Promise<GuildSettings>;
  getGuildSettingsById(id: number): Promise<GuildSettings | undefined>;
  updateGuildSettings(guildId: string, data: Partial<InsertGuildSettings>): Promise<GuildSettings | undefined>;
  
  // Economy
  getOrCreateEconomy(userId: number, guildId: number): Promise<Economy>;
  updateEconomy(userId: number, guildId: number, data: Partial<InsertEconomy>): Promise<Economy | undefined>;
  getEconomySettings(guildId: number): Promise<EconomySettings | undefined>;
  updateEconomySettings(guildId: number, data: Partial<InsertEconomySettings>): Promise<EconomySettings>;
  
  // Items
  getItems(guildId: number): Promise<Item[]>;
  getItem(id: number): Promise<Item | undefined>;
  createItem(data: InsertItem): Promise<Item>;
  updateItem(id: number, data: Partial<InsertItem>): Promise<Item | undefined>;
  deleteItem(id: number): Promise<void>;
  
  // Inventory
  getInventory(userId: number): Promise<Inventory[]>;
  addToInventory(userId: number, itemId: number, quantity: number): Promise<Inventory>;
  removeFromInventory(userId: number, itemId: number, quantity: number): Promise<boolean>;
  
  // Mystery Boxes
  getMysteryBoxes(guildId: number): Promise<MysteryBox[]>;
  getMysteryBox(id: number): Promise<MysteryBox | undefined>;
  createMysteryBox(data: InsertMysteryBox): Promise<MysteryBox>;
  updateMysteryBox(id: number, data: Partial<InsertMysteryBox>): Promise<MysteryBox | undefined>;
  deleteMysteryBox(id: number): Promise<void>;
  getMysteryBoxRewards(boxId: number): Promise<MysteryBoxReward[]>;
  addMysteryBoxReward(data: InsertMysteryBoxReward): Promise<MysteryBoxReward>;
  deleteMysteryBoxReward(id: number): Promise<void>;
  replaceBoxRewards(boxId: number, rewards: { item: string; weight: number }[]): Promise<void>;
  
  // Chests
  getChests(guildId: number): Promise<Chest[]>;
  getChest(id: number): Promise<Chest | undefined>;
  createChest(data: InsertChest): Promise<Chest>;
  updateChest(id: number, data: Partial<InsertChest>): Promise<Chest | undefined>;
  deleteChest(id: number): Promise<void>;
  getChestRarities(guildId: number): Promise<ChestRarity[]>;
  createChestRarity(data: InsertChestRarity): Promise<ChestRarity>;
  updateChestRarity(id: number, data: Partial<InsertChestRarity>): Promise<ChestRarity | undefined>;
  deleteChestRarity(id: number): Promise<void>;
  getChestRewards(chestId: number): Promise<ChestReward[]>;
  addChestReward(data: InsertChestReward): Promise<ChestReward>;
  updateChestReward(id: number, data: Partial<InsertChestReward>): Promise<ChestReward | undefined>;
  deleteChestReward(id: number): Promise<void>;
  
  // Crafting
  getCraftingRecipes(guildId: number): Promise<CraftingRecipe[]>;
  getCraftingRecipe(id: number): Promise<CraftingRecipe | undefined>;
  createCraftingRecipe(data: InsertCraftingRecipe): Promise<CraftingRecipe>;
  updateCraftingRecipe(id: number, data: Partial<InsertCraftingRecipe>): Promise<CraftingRecipe | undefined>;
  deleteCraftingRecipe(id: number): Promise<void>;
  getRecipeIngredients(recipeId: number): Promise<RecipeIngredient[]>;
  addRecipeIngredient(data: InsertRecipeIngredient): Promise<RecipeIngredient>;
  replaceRecipeIngredients(recipeId: number, ingredients: { item: string; quantity: number }[]): Promise<void>;
  
  // Modmail
  getModmailTickets(guildId: number): Promise<ModmailTicket[]>;
  getModmailTicket(id: number): Promise<ModmailTicket | undefined>;
  createModmailTicket(data: InsertModmailTicket): Promise<ModmailTicket>;
  updateModmailTicket(id: number, data: Partial<InsertModmailTicket>): Promise<ModmailTicket | undefined>;
  getModmailMessages(ticketId: number): Promise<ModmailMessage[]>;
  createModmailMessage(data: InsertModmailMessage): Promise<ModmailMessage>;
  getModmailSettings(guildId: number): Promise<ModmailSettings | undefined>;
  updateModmailSettings(guildId: number, data: Partial<InsertModmailSettings>): Promise<ModmailSettings>;
  
  // Moderation
  getWarnings(userId: number, guildId: number): Promise<Warning[]>;
  createWarning(data: InsertWarning): Promise<Warning>;
  getModerationActions(guildId: number): Promise<ModerationAction[]>;
  createModerationAction(data: InsertModerationAction): Promise<ModerationAction>;
  deactivateModerationAction(id: number): Promise<void>;
  getShadowbans(guildId: number): Promise<Shadowban[]>;
  getShadowban(userId: number, guildId: number): Promise<Shadowban | undefined>;
  createShadowban(data: InsertShadowban): Promise<Shadowban>;
  deleteShadowban(id: number): Promise<void>;
  getAutoModSettings(guildId: number): Promise<AutoModSettings | undefined>;
  updateAutoModSettings(guildId: number, data: Partial<InsertAutoModSettings>): Promise<AutoModSettings>;
  
  // Security
  getSecuritySettings(guildId: number): Promise<SecuritySettings | undefined>;
  updateSecuritySettings(guildId: number, data: Partial<InsertSecuritySettings>): Promise<SecuritySettings>;
  
  // Appeals
  getAppealSettings(guildId: number): Promise<AppealSettings | undefined>;
  updateAppealSettings(guildId: number, data: Partial<InsertAppealSettings>): Promise<AppealSettings>;
  getAppeals(guildId: number, status?: string): Promise<Appeal[]>;
  getAppeal(id: number): Promise<Appeal | undefined>;
  createAppeal(data: InsertAppeal): Promise<Appeal>;
  updateAppeal(id: number, data: Partial<InsertAppeal>): Promise<Appeal | undefined>;
  getActiveBanForUser(userId: number, guildId: number): Promise<ModerationAction | undefined>;
  
  // Logging
  getLoggingSettings(guildId: number): Promise<LoggingSettings | undefined>;
  updateLoggingSettings(guildId: number, data: Partial<InsertLoggingSettings>): Promise<LoggingSettings>;
  
  // Custom Commands
  getCustomCommands(guildId: number): Promise<CustomCommand[]>;
  createCustomCommand(data: InsertCustomCommand): Promise<CustomCommand>;
  updateCustomCommand(id: number, data: Partial<InsertCustomCommand>): Promise<CustomCommand | undefined>;
  deleteCustomCommand(id: number): Promise<void>;
  
  // Workflows
  getWorkflows(guildId: number): Promise<Workflow[]>;
  getWorkflow(id: number): Promise<Workflow | undefined>;
  createWorkflow(data: InsertWorkflow): Promise<Workflow>;
  createWorkflowWithNodes(workflowData: InsertWorkflow, nodesData: Partial<InsertWorkflowNode>[]): Promise<{ workflow: Workflow; nodes: WorkflowNode[] }>;
  updateWorkflow(id: number, data: Partial<InsertWorkflow>, expectedVersion?: number): Promise<Workflow | undefined>;
  updateWorkflowWithNodes(id: number, workflowData: Partial<InsertWorkflow>, nodesData: Partial<InsertWorkflowNode>[], expectedVersion?: number): Promise<{ workflow: Workflow; nodes: WorkflowNode[] } | undefined>;
  deleteWorkflow(id: number): Promise<void>;
  
  // Workflow Nodes
  getWorkflowNodes(workflowId: number): Promise<WorkflowNode[]>;
  createWorkflowNode(data: InsertWorkflowNode): Promise<WorkflowNode>;
  updateWorkflowNode(id: number, data: Partial<InsertWorkflowNode>): Promise<WorkflowNode | undefined>;
  deleteWorkflowNode(id: number): Promise<void>;
  deleteWorkflowNodes(workflowId: number): Promise<void>;
  
  // Welcome/Leave System
  getWelcomeSettings(guildId: number): Promise<WelcomeSettings | undefined>;
  updateWelcomeSettings(guildId: number, data: Partial<InsertWelcomeSettings>): Promise<WelcomeSettings>;
  
  // Reaction Roles
  getReactionRoles(guildId: number): Promise<ReactionRole[]>;
  getReactionRolesByMessage(messageId: string): Promise<ReactionRole[]>;
  createReactionRole(data: InsertReactionRole): Promise<ReactionRole>;
  updateReactionRole(id: number, data: Partial<InsertReactionRole>): Promise<ReactionRole | undefined>;
  deleteReactionRole(id: number): Promise<void>;
  
  // Embed Templates
  getEmbedTemplates(guildId: number): Promise<EmbedTemplate[]>;
  getEmbedTemplate(id: number): Promise<EmbedTemplate | undefined>;
  createEmbedTemplate(data: InsertEmbedTemplate): Promise<EmbedTemplate>;
  updateEmbedTemplate(id: number, data: Partial<InsertEmbedTemplate>): Promise<EmbedTemplate | undefined>;
  deleteEmbedTemplate(id: number): Promise<void>;
  
  // User tracking
  getUserLastSeen(discordId: string): Promise<Date | null>;
  
  // Giveaways
  getGiveaways(guildId: number, activeOnly?: boolean): Promise<Giveaway[]>;
  getGiveaway(id: number): Promise<Giveaway | undefined>;
  createGiveaway(data: InsertGiveaway): Promise<Giveaway>;
  updateGiveaway(id: number, data: Partial<InsertGiveaway>): Promise<Giveaway | undefined>;
  endGiveaway(id: number, winners: string[]): Promise<Giveaway | undefined>;
  deleteGiveaway(id: number): Promise<void>;
  
  // Giveaway Templates
  getGiveawayTemplates(guildId: number): Promise<GiveawayTemplate[]>;
  getGiveawayTemplate(id: number): Promise<GiveawayTemplate | undefined>;
  getGiveawayTemplateByName(guildId: number, name: string): Promise<GiveawayTemplate | undefined>;
  createGiveawayTemplate(data: InsertGiveawayTemplate): Promise<GiveawayTemplate>;
  updateGiveawayTemplate(id: number, data: Partial<InsertGiveawayTemplate>): Promise<GiveawayTemplate | undefined>;
  deleteGiveawayTemplate(id: number): Promise<void>;
  
  // Giveaway Entries
  getGiveawayEntries(giveawayId: number): Promise<GiveawayEntry[]>;
  createGiveawayEntry(data: InsertGiveawayEntry): Promise<GiveawayEntry>;
  deleteGiveawayEntry(giveawayId: number, userId: number): Promise<void>;
  
  // Giveaway Role Modifiers
  getGiveawayRoleModifiers(guildId: number): Promise<GiveawayRoleModifier[]>;
  createGiveawayRoleModifier(data: InsertGiveawayRoleModifier): Promise<GiveawayRoleModifier>;
  updateGiveawayRoleModifier(id: number, data: Partial<InsertGiveawayRoleModifier>): Promise<GiveawayRoleModifier | undefined>;
  deleteGiveawayRoleModifier(id: number): Promise<void>;
  
  // Giveaway Settings
  getGiveawaySettings(guildId: number): Promise<GiveawaySettings | undefined>;
  updateGiveawaySettings(guildId: number, data: Partial<InsertGiveawaySettings>): Promise<GiveawaySettings>;
}

// DatabaseStorage implementation
export class DatabaseStorage implements IStorage {
  // Discord Users
  async getDiscordUser(discordId: string): Promise<DiscordUser | undefined> {
    const [user] = await db.select().from(schema.discordUsers).where(eq(schema.discordUsers.discordId, discordId));
    return user;
  }

  async getOrCreateDiscordUser(discordId: string, username: string, discriminator?: string, avatar?: string): Promise<DiscordUser> {
    const [existing] = await db.select().from(schema.discordUsers).where(eq(schema.discordUsers.discordId, discordId));
    
    if (existing) {
      // Update user info if it's different (handles placeholder "Unknown User" updates)
      if (existing.username !== username || existing.discriminator !== discriminator || existing.avatar !== avatar) {
        const [updated] = await db.update(schema.discordUsers)
          .set({ username, discriminator, avatar })
          .where(eq(schema.discordUsers.discordId, discordId))
          .returning();
        return updated;
      }
      return existing;
    }
    
    const [user] = await db.insert(schema.discordUsers)
      .values({ discordId, username, discriminator, avatar })
      .returning();
    return user;
  }
  
  async updateUserLastSeen(discordId: string): Promise<void> {
    // Upsert: update if exists, insert if not
    const [existing] = await db.select().from(schema.discordUsers).where(eq(schema.discordUsers.discordId, discordId));
    
    if (existing) {
      await db.update(schema.discordUsers)
        .set({ lastSeen: new Date() })
        .where(eq(schema.discordUsers.discordId, discordId));
    } else {
      // Create minimal user entry with just the Discord ID and lastSeen
      await db.insert(schema.discordUsers)
        .values({ 
          discordId, 
          username: 'Unknown User', // Will be updated when they use a command
          lastSeen: new Date() 
        });
    }
  }
  
  // Guild Settings
  async getOrCreateGuildSettings(guildId: string, guildName: string): Promise<GuildSettings> {
    const [existing] = await db.select().from(schema.guildSettings).where(eq(schema.guildSettings.guildId, guildId));
    if (existing) return existing;
    
    const [guild] = await db.insert(schema.guildSettings)
      .values({ guildId, guildName })
      .returning();
    return guild;
  }
  
  async getGuildSettingsById(id: number): Promise<GuildSettings | undefined> {
    const [guild] = await db.select().from(schema.guildSettings).where(eq(schema.guildSettings.id, id));
    return guild;
  }
  
  async updateGuildSettings(guildId: string, data: Partial<InsertGuildSettings>): Promise<GuildSettings | undefined> {
    const [guild] = await db.update(schema.guildSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.guildSettings.guildId, guildId))
      .returning();
    return guild;
  }
  
  // Economy
  async getOrCreateEconomy(userId: number, guildId: number): Promise<Economy> {
    const [existing] = await db.select().from(schema.economy)
      .where(and(eq(schema.economy.userId, userId), eq(schema.economy.guildId, guildId)));
    if (existing) return existing;
    
    const [econ] = await db.insert(schema.economy)
      .values({ userId, guildId })
      .returning();
    return econ;
  }
  
  async updateEconomy(userId: number, guildId: number, data: Partial<InsertEconomy>): Promise<Economy | undefined> {
    const [econ] = await db.update(schema.economy)
      .set(data)
      .where(and(eq(schema.economy.userId, userId), eq(schema.economy.guildId, guildId)))
      .returning();
    return econ;
  }
  
  async getEconomySettings(guildId: number): Promise<EconomySettings | undefined> {
    const [settings] = await db.select().from(schema.economySettings)
      .where(eq(schema.economySettings.guildId, guildId));
    return settings;
  }
  
  async updateEconomySettings(guildId: number, data: Partial<InsertEconomySettings>): Promise<EconomySettings> {
    const existing = await this.getEconomySettings(guildId);
    if (existing) {
      const [settings] = await db.update(schema.economySettings)
        .set(data)
        .where(eq(schema.economySettings.guildId, guildId))
        .returning();
      return settings;
    }
    const [settings] = await db.insert(schema.economySettings)
      .values({ guildId, ...data })
      .returning();
    return settings;
  }
  
  // Items
  async getItems(guildId: number): Promise<Item[]> {
    return await db.select().from(schema.items).where(eq(schema.items.guildId, guildId));
  }
  
  async getItem(id: number): Promise<Item | undefined> {
    const [item] = await db.select().from(schema.items).where(eq(schema.items.id, id));
    return item;
  }
  
  async createItem(data: InsertItem): Promise<Item> {
    const [item] = await db.insert(schema.items).values(data).returning();
    return item;
  }
  
  async updateItem(id: number, data: Partial<InsertItem>): Promise<Item | undefined> {
    const [item] = await db.update(schema.items).set(data).where(eq(schema.items.id, id)).returning();
    return item;
  }
  
  async deleteItem(id: number): Promise<void> {
    await db.delete(schema.items).where(eq(schema.items.id, id));
  }
  
  // Inventory
  async getInventory(userId: number): Promise<Inventory[]> {
    return await db.select().from(schema.inventory).where(eq(schema.inventory.userId, userId));
  }
  
  async addToInventory(userId: number, itemId: number, quantity: number): Promise<Inventory> {
    const [existing] = await db.select().from(schema.inventory)
      .where(and(eq(schema.inventory.userId, userId), eq(schema.inventory.itemId, itemId)));
    
    if (existing) {
      const [updated] = await db.update(schema.inventory)
        .set({ quantity: existing.quantity + quantity })
        .where(eq(schema.inventory.id, existing.id))
        .returning();
      return updated;
    }
    
    const [inv] = await db.insert(schema.inventory)
      .values({ userId, itemId, quantity })
      .returning();
    return inv;
  }
  
  async removeFromInventory(userId: number, itemId: number, quantity: number): Promise<boolean> {
    const [existing] = await db.select().from(schema.inventory)
      .where(and(eq(schema.inventory.userId, userId), eq(schema.inventory.itemId, itemId)));
    
    if (!existing || existing.quantity < quantity) return false;
    
    if (existing.quantity === quantity) {
      await db.delete(schema.inventory).where(eq(schema.inventory.id, existing.id));
    } else {
      await db.update(schema.inventory)
        .set({ quantity: existing.quantity - quantity })
        .where(eq(schema.inventory.id, existing.id));
    }
    return true;
  }

  // Trades
  async createTrade(data: InsertTrade): Promise<Trade> {
    const [trade] = await db.insert(schema.trades).values(data).returning();
    return trade;
  }

  async getTrade(id: number): Promise<Trade | undefined> {
    const [trade] = await db.select().from(schema.trades).where(eq(schema.trades.id, id));
    return trade;
  }

  async getTradesForUser(userId: number, guildId: number): Promise<Trade[]> {
    return await db.select().from(schema.trades)
      .where(
        and(
          eq(schema.trades.guildId, guildId),
          or(
            eq(schema.trades.senderId, userId),
            eq(schema.trades.receiverId, userId)
          )
        )
      )
      .orderBy(schema.trades.createdAt);
  }

  async getPendingTradesForUser(userId: number, guildId: number): Promise<Trade[]> {
    return await db.select().from(schema.trades)
      .where(
        and(
          eq(schema.trades.guildId, guildId),
          eq(schema.trades.receiverId, userId),
          eq(schema.trades.status, 'pending')
        )
      )
      .orderBy(schema.trades.createdAt);
  }

  async updateTrade(id: number, data: Partial<Omit<Trade, 'id' | 'createdAt'>>): Promise<Trade | undefined> {
    const [trade] = await db.update(schema.trades)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.trades.id, id))
      .returning();
    return trade;
  }

  async deleteTrade(id: number): Promise<void> {
    await db.delete(schema.trades).where(eq(schema.trades.id, id));
  }

  async acceptTrade(tradeId: number): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // Get trade within transaction
      const [trade] = await tx.select().from(schema.trades).where(eq(schema.trades.id, tradeId));
      if (!trade || trade.status !== 'pending') return false;

      const offeredItems = trade.offeredItems as Array<{ itemId: number; quantity: number }>;
      const requestedItems = trade.requestedItems as Array<{ itemId: number; quantity: number }>;

      // Validate sender has offered items
      for (const item of offeredItems) {
        const inventory = await tx.select().from(schema.inventory)
          .where(and(
            eq(schema.inventory.userId, trade.senderId),
            eq(schema.inventory.itemId, item.itemId)
          ));
        if (!inventory[0] || inventory[0].quantity < item.quantity) {
          tx.rollback();
          return false;
        }
      }

      // Validate receiver has requested items
      for (const item of requestedItems) {
        const inventory = await tx.select().from(schema.inventory)
          .where(and(
            eq(schema.inventory.userId, trade.receiverId),
            eq(schema.inventory.itemId, item.itemId)
          ));
        if (!inventory[0] || inventory[0].quantity < item.quantity) {
          tx.rollback();
          return false;
        }
      }

      // Execute trade atomically within transaction
      // Remove offered items from sender, add to receiver
      for (const item of offeredItems) {
        await tx.update(schema.inventory)
          .set({ quantity: sql`quantity - ${item.quantity}` })
          .where(and(
            eq(schema.inventory.userId, trade.senderId),
            eq(schema.inventory.itemId, item.itemId)
          ));
        
        const [existing] = await tx.select().from(schema.inventory)
          .where(and(
            eq(schema.inventory.userId, trade.receiverId),
            eq(schema.inventory.itemId, item.itemId)
          ));
        
        if (existing) {
          await tx.update(schema.inventory)
            .set({ quantity: existing.quantity + item.quantity })
            .where(eq(schema.inventory.id, existing.id));
        } else {
          await tx.insert(schema.inventory).values({
            userId: trade.receiverId,
            itemId: item.itemId,
            quantity: item.quantity
          });
        }
      }

      // Remove requested items from receiver, add to sender
      for (const item of requestedItems) {
        await tx.update(schema.inventory)
          .set({ quantity: sql`quantity - ${item.quantity}` })
          .where(and(
            eq(schema.inventory.userId, trade.receiverId),
            eq(schema.inventory.itemId, item.itemId)
          ));
        
        const [existing] = await tx.select().from(schema.inventory)
          .where(and(
            eq(schema.inventory.userId, trade.senderId),
            eq(schema.inventory.itemId, item.itemId)
          ));
        
        if (existing) {
          await tx.update(schema.inventory)
            .set({ quantity: existing.quantity + item.quantity })
            .where(eq(schema.inventory.id, existing.id));
        } else {
          await tx.insert(schema.inventory).values({
            userId: trade.senderId,
            itemId: item.itemId,
            quantity: item.quantity
          });
        }
      }

      // Update trade status
      await tx.update(schema.trades)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(eq(schema.trades.id, tradeId));
      
      return true;
    });
  }
  
  // Mystery Boxes
  async getMysteryBoxes(guildId: number): Promise<MysteryBox[]> {
    return await db.select().from(schema.mysteryBoxes).where(eq(schema.mysteryBoxes.guildId, guildId));
  }
  
  async getMysteryBox(id: number): Promise<MysteryBox | undefined> {
    const [box] = await db.select().from(schema.mysteryBoxes).where(eq(schema.mysteryBoxes.id, id));
    return box;
  }
  
  async createMysteryBox(data: InsertMysteryBox): Promise<MysteryBox> {
    const [box] = await db.insert(schema.mysteryBoxes).values(data).returning();
    return box;
  }
  
  async updateMysteryBox(id: number, data: Partial<InsertMysteryBox>): Promise<MysteryBox | undefined> {
    const [box] = await db.update(schema.mysteryBoxes).set(data).where(eq(schema.mysteryBoxes.id, id)).returning();
    return box;
  }
  
  async deleteMysteryBox(id: number): Promise<void> {
    await db.delete(schema.mysteryBoxes).where(eq(schema.mysteryBoxes.id, id));
  }
  
  async getMysteryBoxRewards(boxId: number): Promise<MysteryBoxReward[]> {
    return await db.select().from(schema.mysteryBoxRewards).where(eq(schema.mysteryBoxRewards.boxId, boxId));
  }
  
  async addMysteryBoxReward(data: InsertMysteryBoxReward): Promise<MysteryBoxReward> {
    const [reward] = await db.insert(schema.mysteryBoxRewards).values(data).returning();
    return reward;
  }
  
  async deleteMysteryBoxReward(id: number): Promise<void> {
    await db.delete(schema.mysteryBoxRewards).where(eq(schema.mysteryBoxRewards.id, id));
  }

  async replaceBoxRewards(boxId: number, rewards: { item: string; weight: number }[]): Promise<void> {
    // Delete all existing rewards
    await db.delete(schema.mysteryBoxRewards).where(eq(schema.mysteryBoxRewards.boxId, boxId));
    // Insert new rewards
    if (rewards.length > 0) {
      await db.insert(schema.mysteryBoxRewards).values(
        rewards.map(r => ({ boxId, item: r.item, weight: r.weight }))
      );
    }
  }
  
  // Chests
  async getChests(guildId: number): Promise<Chest[]> {
    return await db.select().from(schema.chests).where(eq(schema.chests.guildId, guildId));
  }
  
  async getChest(id: number): Promise<Chest | undefined> {
    const [chest] = await db.select().from(schema.chests).where(eq(schema.chests.id, id));
    return chest;
  }
  
  async createChest(data: InsertChest): Promise<Chest> {
    const [chest] = await db.insert(schema.chests).values(data).returning();
    return chest;
  }
  
  async updateChest(id: number, data: Partial<InsertChest>): Promise<Chest | undefined> {
    const [chest] = await db.update(schema.chests).set(data).where(eq(schema.chests.id, id)).returning();
    return chest;
  }
  
  async deleteChest(id: number): Promise<void> {
    await db.delete(schema.chests).where(eq(schema.chests.id, id));
  }
  
  async getChestRarities(guildId: number): Promise<ChestRarity[]> {
    return await db.select().from(schema.chestRarities).where(eq(schema.chestRarities.guildId, guildId));
  }
  
  async createChestRarity(data: InsertChestRarity): Promise<ChestRarity> {
    const [rarity] = await db.insert(schema.chestRarities).values(data).returning();
    return rarity;
  }
  
  async updateChestRarity(id: number, data: Partial<InsertChestRarity>): Promise<ChestRarity | undefined> {
    const [rarity] = await db.update(schema.chestRarities).set(data).where(eq(schema.chestRarities.id, id)).returning();
    return rarity;
  }
  
  async deleteChestRarity(id: number): Promise<void> {
    await db.delete(schema.chestRarities).where(eq(schema.chestRarities.id, id));
  }
  
  async getChestRewards(chestId: number): Promise<ChestReward[]> {
    return await db.select().from(schema.chestRewards).where(eq(schema.chestRewards.chestId, chestId));
  }
  
  async addChestReward(data: InsertChestReward): Promise<ChestReward> {
    const [reward] = await db.insert(schema.chestRewards).values(data).returning();
    return reward;
  }
  
  async updateChestReward(id: number, data: Partial<InsertChestReward>): Promise<ChestReward | undefined> {
    const [reward] = await db.update(schema.chestRewards).set(data).where(eq(schema.chestRewards.id, id)).returning();
    return reward;
  }
  
  async deleteChestReward(id: number): Promise<void> {
    await db.delete(schema.chestRewards).where(eq(schema.chestRewards.id, id));
  }
  
  // Crafting
  async getCraftingRecipes(guildId: number): Promise<CraftingRecipe[]> {
    return await db.select().from(schema.craftingRecipes).where(eq(schema.craftingRecipes.guildId, guildId));
  }
  
  async getCraftingRecipe(id: number): Promise<CraftingRecipe | undefined> {
    const [recipe] = await db.select().from(schema.craftingRecipes).where(eq(schema.craftingRecipes.id, id));
    return recipe;
  }
  
  async createCraftingRecipe(data: InsertCraftingRecipe): Promise<CraftingRecipe> {
    const [recipe] = await db.insert(schema.craftingRecipes).values(data).returning();
    return recipe;
  }
  
  async updateCraftingRecipe(id: number, data: Partial<InsertCraftingRecipe>): Promise<CraftingRecipe | undefined> {
    const [recipe] = await db.update(schema.craftingRecipes).set(data).where(eq(schema.craftingRecipes.id, id)).returning();
    return recipe;
  }
  
  async deleteCraftingRecipe(id: number): Promise<void> {
    await db.delete(schema.craftingRecipes).where(eq(schema.craftingRecipes.id, id));
  }
  
  async getRecipeIngredients(recipeId: number): Promise<RecipeIngredient[]> {
    return await db.select().from(schema.recipeIngredients).where(eq(schema.recipeIngredients.recipeId, recipeId));
  }
  
  async addRecipeIngredient(data: InsertRecipeIngredient): Promise<RecipeIngredient> {
    const [ingredient] = await db.insert(schema.recipeIngredients).values(data).returning();
    return ingredient;
  }

  async replaceRecipeIngredients(recipeId: number, ingredients: { item: string; quantity: number }[]): Promise<void> {
    // Delete all existing ingredients
    await db.delete(schema.recipeIngredients).where(eq(schema.recipeIngredients.recipeId, recipeId));
    // Insert new ingredients
    if (ingredients.length > 0) {
      await db.insert(schema.recipeIngredients).values(
        ingredients.map(ing => ({ recipeId, item: ing.item, quantity: ing.quantity }))
      );
    }
  }
  
  // Modmail
  async getModmailTickets(guildId: number): Promise<ModmailTicket[]> {
    return await db.select().from(schema.modmailTickets)
      .where(eq(schema.modmailTickets.guildId, guildId))
      .orderBy(desc(schema.modmailTickets.createdAt));
  }
  
  async getModmailTicket(id: number): Promise<ModmailTicket | undefined> {
    const [ticket] = await db.select().from(schema.modmailTickets).where(eq(schema.modmailTickets.id, id));
    return ticket;
  }
  
  async createModmailTicket(data: InsertModmailTicket): Promise<ModmailTicket> {
    const [ticket] = await db.insert(schema.modmailTickets).values(data).returning();
    return ticket;
  }
  
  async updateModmailTicket(id: number, data: Partial<InsertModmailTicket>): Promise<ModmailTicket | undefined> {
    const [ticket] = await db.update(schema.modmailTickets).set(data).where(eq(schema.modmailTickets.id, id)).returning();
    return ticket;
  }
  
  async getModmailMessages(ticketId: number): Promise<ModmailMessage[]> {
    return await db.select().from(schema.modmailMessages)
      .where(eq(schema.modmailMessages.ticketId, ticketId))
      .orderBy(desc(schema.modmailMessages.createdAt));
  }
  
  async createModmailMessage(data: InsertModmailMessage): Promise<ModmailMessage> {
    const [message] = await db.insert(schema.modmailMessages).values(data).returning();
    return message;
  }
  
  async getModmailSettings(guildId: number): Promise<ModmailSettings | undefined> {
    const [settings] = await db.select().from(schema.modmailSettings).where(eq(schema.modmailSettings.guildId, guildId));
    return settings;
  }
  
  async updateModmailSettings(guildId: number, data: Partial<InsertModmailSettings>): Promise<ModmailSettings> {
    const existing = await this.getModmailSettings(guildId);
    if (existing) {
      const [settings] = await db.update(schema.modmailSettings)
        .set(data)
        .where(eq(schema.modmailSettings.guildId, guildId))
        .returning();
      return settings;
    }
    const [settings] = await db.insert(schema.modmailSettings)
      .values({ guildId, ...data })
      .returning();
    return settings;
  }
  
  // Moderation
  async getWarnings(userId: number, guildId: number): Promise<Warning[]> {
    return await db.select().from(schema.warnings)
      .where(and(eq(schema.warnings.userId, userId), eq(schema.warnings.guildId, guildId)))
      .orderBy(desc(schema.warnings.createdAt));
  }
  
  async createWarning(data: InsertWarning): Promise<Warning> {
    const [warning] = await db.insert(schema.warnings).values(data).returning();
    return warning;
  }
  
  async getModerationActions(guildId: number): Promise<ModerationAction[]> {
    return await db.select().from(schema.moderationActions)
      .where(eq(schema.moderationActions.guildId, guildId))
      .orderBy(desc(schema.moderationActions.createdAt));
  }
  
  async createModerationAction(data: InsertModerationAction): Promise<ModerationAction> {
    const [action] = await db.insert(schema.moderationActions).values(data).returning();
    return action;
  }
  
  async deactivateModerationAction(id: number): Promise<void> {
    await db.update(schema.moderationActions)
      .set({ active: false })
      .where(eq(schema.moderationActions.id, id));
  }
  
  async getShadowbans(guildId: number): Promise<any[]> {
    const results = await db.select({
      id: schema.shadowbans.id,
      guildId: schema.shadowbans.guildId,
      userId: schema.shadowbans.userId,
      moderatorId: schema.shadowbans.moderatorId,
      reason: schema.shadowbans.reason,
      createdAt: schema.shadowbans.createdAt,
      discordId: schema.discordUsers.discordId,
      username: schema.discordUsers.username,
    })
    .from(schema.shadowbans)
    .innerJoin(schema.discordUsers, eq(schema.shadowbans.userId, schema.discordUsers.id))
    .where(eq(schema.shadowbans.guildId, guildId))
    .orderBy(desc(schema.shadowbans.createdAt));
    
    return results;
  }

  async getShadowban(userId: number, guildId: number): Promise<Shadowban | undefined> {
    const [shadowban] = await db.select().from(schema.shadowbans)
      .where(and(
        eq(schema.shadowbans.userId, userId),
        eq(schema.shadowbans.guildId, guildId)
      ));
    return shadowban;
  }

  async createShadowban(data: InsertShadowban): Promise<Shadowban> {
    const [shadowban] = await db.insert(schema.shadowbans).values(data).returning();
    return shadowban;
  }

  async deleteShadowban(id: number): Promise<void> {
    await db.delete(schema.shadowbans).where(eq(schema.shadowbans.id, id));
  }
  
  async getAutoModSettings(guildId: number): Promise<AutoModSettings | undefined> {
    const [settings] = await db.select().from(schema.autoModSettings).where(eq(schema.autoModSettings.guildId, guildId));
    return settings;
  }
  
  async updateAutoModSettings(guildId: number, data: Partial<InsertAutoModSettings>): Promise<AutoModSettings> {
    const existing = await this.getAutoModSettings(guildId);
    if (existing) {
      const [settings] = await db.update(schema.autoModSettings)
        .set(data)
        .where(eq(schema.autoModSettings.guildId, guildId))
        .returning();
      return settings;
    }
    const [settings] = await db.insert(schema.autoModSettings)
      .values({ guildId, ...data })
      .returning();
    return settings;
  }
  
  // Security
  async getSecuritySettings(guildId: number): Promise<SecuritySettings | undefined> {
    const [settings] = await db.select().from(schema.securitySettings).where(eq(schema.securitySettings.guildId, guildId));
    return settings;
  }
  
  async updateSecuritySettings(guildId: number, data: Partial<InsertSecuritySettings>): Promise<SecuritySettings> {
    const existing = await this.getSecuritySettings(guildId);
    if (existing) {
      const [settings] = await db.update(schema.securitySettings)
        .set(data)
        .where(eq(schema.securitySettings.guildId, guildId))
        .returning();
      return settings;
    }
    const [settings] = await db.insert(schema.securitySettings)
      .values({ guildId, ...data })
      .returning();
    return settings;
  }
  
  // Appeals
  async getAppealSettings(guildId: number): Promise<AppealSettings | undefined> {
    const [settings] = await db.select().from(schema.appealSettings).where(eq(schema.appealSettings.guildId, guildId));
    return settings;
  }
  
  async updateAppealSettings(guildId: number, data: Partial<InsertAppealSettings>): Promise<AppealSettings> {
    const existing = await this.getAppealSettings(guildId);
    if (existing) {
      const [settings] = await db.update(schema.appealSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.appealSettings.guildId, guildId))
        .returning();
      return settings;
    }
    const [settings] = await db.insert(schema.appealSettings)
      .values({ guildId, ...data })
      .returning();
    return settings;
  }
  
  async getAppeals(guildId: number, status?: string): Promise<Appeal[]> {
    if (status) {
      return await db.select().from(schema.appeals)
        .where(and(eq(schema.appeals.guildId, guildId), eq(schema.appeals.status, status)))
        .orderBy(desc(schema.appeals.createdAt));
    }
    return await db.select().from(schema.appeals)
      .where(eq(schema.appeals.guildId, guildId))
      .orderBy(desc(schema.appeals.createdAt));
  }
  
  async getAppeal(id: number): Promise<Appeal | undefined> {
    const [appeal] = await db.select().from(schema.appeals).where(eq(schema.appeals.id, id));
    return appeal;
  }
  
  async createAppeal(data: InsertAppeal): Promise<Appeal> {
    const [appeal] = await db.insert(schema.appeals).values(data).returning();
    return appeal;
  }
  
  async updateAppeal(id: number, data: Partial<InsertAppeal>): Promise<Appeal | undefined> {
    const [appeal] = await db.update(schema.appeals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.appeals.id, id))
      .returning();
    return appeal;
  }
  
  async getActiveBanForUser(userId: number, guildId: number): Promise<ModerationAction | undefined> {
    const [ban] = await db.select().from(schema.moderationActions)
      .where(and(
        eq(schema.moderationActions.userId, userId),
        eq(schema.moderationActions.guildId, guildId),
        eq(schema.moderationActions.action, 'ban'),
        eq(schema.moderationActions.active, true)
      ))
      .orderBy(desc(schema.moderationActions.createdAt))
      .limit(1);
    return ban;
  }
  
  // Logging
  async getLoggingSettings(guildId: number): Promise<LoggingSettings | undefined> {
    const [settings] = await db.select().from(schema.loggingSettings).where(eq(schema.loggingSettings.guildId, guildId));
    return settings;
  }
  
  async updateLoggingSettings(guildId: number, data: Partial<InsertLoggingSettings>): Promise<LoggingSettings> {
    const existing = await this.getLoggingSettings(guildId);
    if (existing) {
      const [settings] = await db.update(schema.loggingSettings)
        .set(data)
        .where(eq(schema.loggingSettings.guildId, guildId))
        .returning();
      return settings;
    }
    const [settings] = await db.insert(schema.loggingSettings)
      .values({ guildId, ...data })
      .returning();
    return settings;
  }
  
  // Custom Commands
  async getCustomCommands(guildId: number): Promise<CustomCommand[]> {
    return await db.select().from(schema.customCommands).where(eq(schema.customCommands.guildId, guildId));
  }
  
  async createCustomCommand(data: InsertCustomCommand): Promise<CustomCommand> {
    const [command] = await db.insert(schema.customCommands).values(data).returning();
    return command;
  }
  
  async updateCustomCommand(id: number, data: Partial<InsertCustomCommand>): Promise<CustomCommand | undefined> {
    const [command] = await db.update(schema.customCommands).set(data).where(eq(schema.customCommands.id, id)).returning();
    return command;
  }
  
  async deleteCustomCommand(id: number): Promise<void> {
    await db.delete(schema.customCommands).where(eq(schema.customCommands.id, id));
  }
  
  // Workflows
  async getWorkflows(guildId: number): Promise<Workflow[]> {
    return await db.select().from(schema.workflows).where(eq(schema.workflows.guildId, guildId));
  }
  
  async getWorkflow(id: number): Promise<Workflow | undefined> {
    const [workflow] = await db.select().from(schema.workflows).where(eq(schema.workflows.id, id));
    return workflow;
  }
  
  async createWorkflow(data: InsertWorkflow): Promise<Workflow> {
    const [workflow] = await db.insert(schema.workflows).values(data).returning();
    return workflow;
  }
  
  async createWorkflowWithNodes(workflowData: InsertWorkflow, nodesData: Partial<InsertWorkflowNode>[]): Promise<{ workflow: Workflow; nodes: WorkflowNode[] }> {
    return await db.transaction(async (tx) => {
      // Create workflow
      const [workflow] = await tx.insert(schema.workflows).values(workflowData).returning();
      
      // Create nodes
      const nodes: WorkflowNode[] = [];
      for (const nodeData of nodesData) {
        const [node] = await tx.insert(schema.workflowNodes).values({
          ...nodeData,
          workflowId: workflow.id
        }).returning();
        nodes.push(node);
      }
      
      return { workflow, nodes };
    });
  }
  
  async updateWorkflow(id: number, data: Partial<InsertWorkflow>, expectedVersion?: number): Promise<Workflow | undefined> {
    const [workflow] = await db.update(schema.workflows)
      .set({
        ...data,
        version: sql`${schema.workflows.version} + 1`,
        updatedAt: new Date()
      })
      .where(
        expectedVersion !== undefined
          ? and(eq(schema.workflows.id, id), eq(schema.workflows.version, expectedVersion))
          : eq(schema.workflows.id, id)
      )
      .returning();
    return workflow;
  }
  
  async updateWorkflowWithNodes(id: number, workflowData: Partial<InsertWorkflow>, nodesData: Partial<InsertWorkflowNode>[], expectedVersion?: number): Promise<{ workflow: Workflow; nodes: WorkflowNode[] } | undefined> {
    return await db.transaction(async (tx) => {
      // Update workflow with version check
      const [workflow] = await tx.update(schema.workflows)
        .set({
          ...workflowData,
          version: sql`${schema.workflows.version} + 1`,
          updatedAt: new Date()
        })
        .where(
          expectedVersion !== undefined
            ? and(eq(schema.workflows.id, id), eq(schema.workflows.version, expectedVersion))
            : eq(schema.workflows.id, id)
        )
        .returning();
      
      if (!workflow) {
        // Version conflict or workflow not found
        return undefined;
      }
      
      // Delete existing nodes
      await tx.delete(schema.workflowNodes).where(eq(schema.workflowNodes.workflowId, id));
      
      // Create new nodes
      const nodes: WorkflowNode[] = [];
      for (const nodeData of nodesData) {
        const [node] = await tx.insert(schema.workflowNodes).values({
          ...nodeData,
          workflowId: id
        }).returning();
        nodes.push(node);
      }
      
      return { workflow, nodes };
    });
  }
  
  async deleteWorkflow(id: number): Promise<void> {
    await db.delete(schema.workflows).where(eq(schema.workflows.id, id));
  }
  
  // Workflow Nodes
  async getWorkflowNodes(workflowId: number): Promise<WorkflowNode[]> {
    return await db.select().from(schema.workflowNodes).where(eq(schema.workflowNodes.workflowId, workflowId));
  }
  
  async createWorkflowNode(data: InsertWorkflowNode): Promise<WorkflowNode> {
    const [node] = await db.insert(schema.workflowNodes).values(data).returning();
    return node;
  }
  
  async updateWorkflowNode(id: number, data: Partial<InsertWorkflowNode>): Promise<WorkflowNode | undefined> {
    const [node] = await db.update(schema.workflowNodes).set(data).where(eq(schema.workflowNodes.id, id)).returning();
    return node;
  }
  
  async deleteWorkflowNode(id: number): Promise<void> {
    await db.delete(schema.workflowNodes).where(eq(schema.workflowNodes.id, id));
  }
  
  async deleteWorkflowNodes(workflowId: number): Promise<void> {
    await db.delete(schema.workflowNodes).where(eq(schema.workflowNodes.workflowId, workflowId));
  }
  
  // Welcome/Leave System
  async getWelcomeSettings(guildId: number): Promise<WelcomeSettings | undefined> {
    const [settings] = await db.select().from(schema.welcomeSettings).where(eq(schema.welcomeSettings.guildId, guildId));
    return settings;
  }
  
  async updateWelcomeSettings(guildId: number, data: Partial<InsertWelcomeSettings>): Promise<WelcomeSettings> {
    const existing = await this.getWelcomeSettings(guildId);
    if (existing) {
      const [settings] = await db.update(schema.welcomeSettings)
        .set(data)
        .where(eq(schema.welcomeSettings.guildId, guildId))
        .returning();
      return settings;
    }
    const [settings] = await db.insert(schema.welcomeSettings)
      .values({ guildId, ...data })
      .returning();
    return settings;
  }
  
  // Reaction Roles
  async getReactionRoles(guildId: number): Promise<ReactionRole[]> {
    return await db.select().from(schema.reactionRoles).where(eq(schema.reactionRoles.guildId, guildId));
  }
  
  async getReactionRolesByMessage(messageId: string): Promise<ReactionRole[]> {
    return await db.select().from(schema.reactionRoles).where(eq(schema.reactionRoles.messageId, messageId));
  }
  
  async createReactionRole(data: InsertReactionRole): Promise<ReactionRole> {
    const [role] = await db.insert(schema.reactionRoles).values(data).returning();
    return role;
  }
  
  async updateReactionRole(id: number, data: Partial<InsertReactionRole>): Promise<ReactionRole | undefined> {
    const [role] = await db.update(schema.reactionRoles).set(data).where(eq(schema.reactionRoles.id, id)).returning();
    return role;
  }
  
  async deleteReactionRole(id: number): Promise<void> {
    await db.delete(schema.reactionRoles).where(eq(schema.reactionRoles.id, id));
  }
  
  // Embed Templates
  async getEmbedTemplates(guildId: number): Promise<EmbedTemplate[]> {
    return await db.select().from(schema.embedTemplates).where(eq(schema.embedTemplates.guildId, guildId));
  }
  
  async getEmbedTemplate(id: number): Promise<EmbedTemplate | undefined> {
    const [template] = await db.select().from(schema.embedTemplates).where(eq(schema.embedTemplates.id, id));
    return template;
  }
  
  async createEmbedTemplate(data: InsertEmbedTemplate): Promise<EmbedTemplate> {
    const [template] = await db.insert(schema.embedTemplates).values(data).returning();
    return template;
  }
  
  async updateEmbedTemplate(id: number, data: Partial<InsertEmbedTemplate>): Promise<EmbedTemplate | undefined> {
    const [template] = await db.update(schema.embedTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.embedTemplates.id, id))
      .returning();
    return template;
  }
  
  async deleteEmbedTemplate(id: number): Promise<void> {
    await db.delete(schema.embedTemplates).where(eq(schema.embedTemplates.id, id));
  }
  
  // User tracking
  async getUserLastSeen(discordId: string): Promise<Date | null> {
    const user = await this.getDiscordUser(discordId);
    return user?.lastSeen || null;
  }
  
  // Giveaways
  async getGiveaways(guildId: number, activeOnly = false): Promise<Giveaway[]> {
    if (activeOnly) {
      return await db.select().from(schema.giveaways)
        .where(and(
          eq(schema.giveaways.guildId, guildId),
          eq(schema.giveaways.ended, false)
        ))
        .orderBy(desc(schema.giveaways.endTime));
    }
    return await db.select().from(schema.giveaways)
      .where(eq(schema.giveaways.guildId, guildId))
      .orderBy(desc(schema.giveaways.createdAt));
  }
  
  async getGiveaway(id: number): Promise<Giveaway | undefined> {
    const [giveaway] = await db.select().from(schema.giveaways).where(eq(schema.giveaways.id, id));
    return giveaway;
  }
  
  async createGiveaway(data: InsertGiveaway): Promise<Giveaway> {
    const [giveaway] = await db.insert(schema.giveaways).values(data).returning();
    return giveaway;
  }
  
  async updateGiveaway(id: number, data: Partial<InsertGiveaway>): Promise<Giveaway | undefined> {
    const [giveaway] = await db.update(schema.giveaways).set(data).where(eq(schema.giveaways.id, id)).returning();
    return giveaway;
  }
  
  async endGiveaway(id: number, winners: string[]): Promise<Giveaway | undefined> {
    const [giveaway] = await db.update(schema.giveaways)
      .set({ ended: true, winners })
      .where(eq(schema.giveaways.id, id))
      .returning();
    return giveaway;
  }
  
  async deleteGiveaway(id: number): Promise<void> {
    await db.delete(schema.giveaways).where(eq(schema.giveaways.id, id));
  }
  
  // Giveaway Templates
  async getGiveawayTemplates(guildId: number): Promise<GiveawayTemplate[]> {
    return await db.select().from(schema.giveawayTemplates)
      .where(eq(schema.giveawayTemplates.guildId, guildId))
      .orderBy(desc(schema.giveawayTemplates.createdAt));
  }
  
  async getGiveawayTemplate(id: number): Promise<GiveawayTemplate | undefined> {
    const [template] = await db.select().from(schema.giveawayTemplates).where(eq(schema.giveawayTemplates.id, id));
    return template;
  }
  
  async getGiveawayTemplateByName(guildId: number, name: string): Promise<GiveawayTemplate | undefined> {
    const [template] = await db.select().from(schema.giveawayTemplates)
      .where(and(
        eq(schema.giveawayTemplates.guildId, guildId),
        eq(schema.giveawayTemplates.name, name)
      ));
    return template;
  }
  
  async createGiveawayTemplate(data: InsertGiveawayTemplate): Promise<GiveawayTemplate> {
    const [template] = await db.insert(schema.giveawayTemplates).values(data).returning();
    return template;
  }
  
  async updateGiveawayTemplate(id: number, data: Partial<InsertGiveawayTemplate>): Promise<GiveawayTemplate | undefined> {
    const [template] = await db.update(schema.giveawayTemplates).set(data).where(eq(schema.giveawayTemplates.id, id)).returning();
    return template;
  }
  
  async deleteGiveawayTemplate(id: number): Promise<void> {
    await db.delete(schema.giveawayTemplates).where(eq(schema.giveawayTemplates.id, id));
  }
  
  // Giveaway Entries
  async getGiveawayEntries(giveawayId: number): Promise<GiveawayEntry[]> {
    return await db.select().from(schema.giveawayEntries).where(eq(schema.giveawayEntries.giveawayId, giveawayId));
  }
  
  async createGiveawayEntry(data: InsertGiveawayEntry): Promise<GiveawayEntry> {
    const [entry] = await db.insert(schema.giveawayEntries).values(data).returning();
    return entry;
  }
  
  async deleteGiveawayEntry(giveawayId: number, userId: number): Promise<void> {
    await db.delete(schema.giveawayEntries)
      .where(and(
        eq(schema.giveawayEntries.giveawayId, giveawayId),
        eq(schema.giveawayEntries.userId, userId)
      ));
  }
  
  // Giveaway Role Modifiers
  async getGiveawayRoleModifiers(guildId: number): Promise<GiveawayRoleModifier[]> {
    return await db.select().from(schema.giveawayRoleModifiers)
      .where(eq(schema.giveawayRoleModifiers.guildId, guildId))
      .orderBy(desc(schema.giveawayRoleModifiers.createdAt));
  }
  
  async createGiveawayRoleModifier(data: InsertGiveawayRoleModifier): Promise<GiveawayRoleModifier> {
    const [modifier] = await db.insert(schema.giveawayRoleModifiers).values(data).returning();
    return modifier;
  }
  
  async updateGiveawayRoleModifier(id: number, data: Partial<InsertGiveawayRoleModifier>): Promise<GiveawayRoleModifier | undefined> {
    const [modifier] = await db.update(schema.giveawayRoleModifiers).set(data).where(eq(schema.giveawayRoleModifiers.id, id)).returning();
    return modifier;
  }
  
  async deleteGiveawayRoleModifier(id: number): Promise<void> {
    await db.delete(schema.giveawayRoleModifiers).where(eq(schema.giveawayRoleModifiers.id, id));
  }
  
  // Giveaway Settings
  async getGiveawaySettings(guildId: number): Promise<GiveawaySettings | undefined> {
    const [settings] = await db.select().from(schema.giveawaySettings).where(eq(schema.giveawaySettings.guildId, guildId));
    return settings;
  }
  
  async updateGiveawaySettings(guildId: number, data: Partial<InsertGiveawaySettings>): Promise<GiveawaySettings> {
    const existing = await this.getGiveawaySettings(guildId);
    if (existing) {
      const [settings] = await db.update(schema.giveawaySettings)
        .set(data)
        .where(eq(schema.giveawaySettings.guildId, guildId))
        .returning();
      return settings;
    }
    const [settings] = await db.insert(schema.giveawaySettings)
      .values({ guildId, ...data })
      .returning();
    return settings;
  }
}

export const storage = new DatabaseStorage();
