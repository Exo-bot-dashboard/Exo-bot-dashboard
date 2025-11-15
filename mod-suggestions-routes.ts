import { Router } from "express";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { analyzeMessageForModeration } from "./ai-mod";

export const modSuggestionsRouter = Router();

// Get mod suggestions for a guild
modSuggestionsRouter.get("/api/guilds/:guildId/mod-suggestions", async (req, res) => {
  try {
    const { guildId } = req.params;
    const { status } = req.query;
    
    const guildSettings = await db.query.guildSettings.findFirst({
      where: eq(schema.guildSettings.guildId, guildId),
    });

    if (!guildSettings) {
      return res.status(404).json({ error: "Guild not found" });
    }

    let suggestions;
    if (status) {
      suggestions = await db.query.modSuggestions.findMany({
        where: and(
          eq(schema.modSuggestions.guildId, guildSettings.id),
          eq(schema.modSuggestions.status, status as string)
        ),
        with: {
          user: true,
          flaggedByUser: true,
          reviewedByUser: true,
        },
        orderBy: [desc(schema.modSuggestions.createdAt)],
      });
    } else {
      suggestions = await db.query.modSuggestions.findMany({
        where: eq(schema.modSuggestions.guildId, guildSettings.id),
        with: {
          user: true,
          flaggedByUser: true,
          reviewedByUser: true,
        },
        orderBy: [desc(schema.modSuggestions.createdAt)],
      });
    }

    res.json(suggestions);
  } catch (error) {
    console.error("Error fetching mod suggestions:", error);
    res.status(500).json({ error: "Failed to fetch mod suggestions" });
  }
});

// Create new mod suggestion (called by /flag command)
modSuggestionsRouter.post("/api/guilds/:guildId/mod-suggestions", async (req, res) => {
  try {
    const { guildId } = req.params;
    const { messageId, messageContent, channelId, channelName, userId, flaggedByDiscordId } = req.body;

    if (!messageId || !messageContent || !channelId || !userId || !flaggedByDiscordId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const guildSettings = await db.query.guildSettings.findFirst({
      where: eq(schema.guildSettings.guildId, guildId),
    });

    if (!guildSettings) {
      return res.status(404).json({ error: "Guild not found" });
    }

    //Get user records
    const [user, flaggedBy] = await Promise.all([
      db.query.discordUsers.findFirst({
        where: eq(schema.discordUsers.discordId, userId),
      }),
      db.query.discordUsers.findFirst({
        where: eq(schema.discordUsers.discordId, flaggedByDiscordId),
      }),
    ]);

    if (!user || !flaggedBy) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user's moderation history (past 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [warnings, actions] = await Promise.all([
      db.query.warnings.findMany({
        where: and(
          eq(schema.warnings.guildId, guildSettings.id),
          eq(schema.warnings.userId, user.id),
          gte(schema.warnings.createdAt, thirtyDaysAgo)
        ),
      }),
      db.query.moderationActions.findMany({
        where: and(
          eq(schema.moderationActions.guildId, guildSettings.id),
          eq(schema.moderationActions.userId, user.id),
          gte(schema.moderationActions.createdAt, thirtyDaysAgo)
        ),
      }),
    ]);

    const userHistory = {
      previousWarnings: warnings.length,
      previousMutes: actions.filter(a => a.action === 'mute').length,
      previousBans: actions.filter(a => a.action === 'ban').length,
    };

    // Run AI analysis
    const aiResult = await analyzeMessageForModeration(messageContent, userHistory);

    // Calculate expiration (48 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    // Create suggestion with raw AI response for audit trail
    const [suggestion] = await db.insert(schema.modSuggestions).values({
      guildId: guildSettings.id,
      userId: user.id,
      flaggedBy: flaggedBy.id,
      messageId,
      messageContent,
      channelId,
      channelName: channelName || null,
      aiAnalysis: aiResult.analysis,
      rawAiResponse: aiResult.rawResponse,
      suggestedAction: aiResult.suggestedAction,
      suggestedDuration: aiResult.suggestedDuration || null,
      confidenceScore: aiResult.confidenceScore,
      status: 'pending',
      expiresAt,
    }).returning();

    res.json(suggestion);
  } catch (error: any) {
    console.error("Error creating mod suggestion:", error);
    
    // Handle duplicate constraint violation
    if (error.code === '23505') {
      return res.status(409).json({ error: "This message has already been flagged" });
    }
    
    res.status(500).json({ error: "Failed to create mod suggestion" });
  }
});

// Accept suggestion and execute moderation action
modSuggestionsRouter.post("/api/guilds/:guildId/mod-suggestions/:id/accept", async (req, res) => {
  try {
    const { guildId, id } = req.params;
    const { reviewNotes, reviewerDiscordId } = req.body;

    // Validate guild exists
    const guildSettings = await db.query.guildSettings.findFirst({
      where: eq(schema.guildSettings.guildId, guildId),
    });

    if (!guildSettings) {
      return res.status(404).json({ error: "Guild not found" });
    }

    // Fetch suggestion with guild validation
    const suggestion = await db.query.modSuggestions.findFirst({
      where: and(
        eq(schema.modSuggestions.id, parseInt(id)),
        eq(schema.modSuggestions.guildId, guildSettings.id)
      ),
    });

    if (!suggestion) {
      return res.status(404).json({ error: "Suggestion not found in this guild" });
    }

    if (suggestion.status !== 'pending') {
      return res.status(400).json({ error: "Suggestion has already been reviewed" });
    }

    const reviewer = await db.query.discordUsers.findFirst({
      where: eq(schema.discordUsers.discordId, reviewerDiscordId),
    });

    if (!reviewer) {
      return res.status(404).json({ error: "Reviewer not found" });
    }

    // Execute moderation action (except 'ignore')
    let moderationActionId: number | null = null;
    
    if (suggestion.suggestedAction !== 'ignore') {
      const user = await db.query.discordUsers.findFirst({
        where: eq(schema.discordUsers.id, suggestion.userId),
      });

      if (user) {
        // For warnings, create warning record only
        if (suggestion.suggestedAction === 'warn') {
          await db.insert(schema.warnings).values({
            guildId: suggestion.guildId,
            userId: user.id,
            moderatorId: reviewer.id,
            reason: suggestion.aiAnalysis,
          });
        } else {
          // For mute/kick/ban, create moderation action record
          const [action] = await db.insert(schema.moderationActions).values({
            guildId: suggestion.guildId,
            userId: user.id,
            moderatorId: reviewer.id,
            action: suggestion.suggestedAction,
            reason: `AI-suggested action: ${suggestion.aiAnalysis}`,
            duration: suggestion.suggestedDuration || null,
            expiresAt: suggestion.suggestedDuration ? new Date(Date.now() + suggestion.suggestedDuration * 60000) : null,
            active: true,
          }).returning();

          moderationActionId = action.id;
        }
      }
    }

    // Update suggestion status
    const [updated] = await db.update(schema.modSuggestions)
      .set({
        status: 'accepted',
        reviewedBy: reviewer.id,
        reviewNotes: reviewNotes || null,
        moderationActionId,
        decidedAt: new Date(),
      })
      .where(eq(schema.modSuggestions.id, parseInt(id)))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("Error accepting mod suggestion:", error);
    res.status(500).json({ error: "Failed to accept suggestion" });
  }
});

// Reject suggestion
modSuggestionsRouter.post("/api/guilds/:guildId/mod-suggestions/:id/reject", async (req, res) => {
  try {
    const { guildId, id } = req.params;
    const { reviewNotes, reviewerDiscordId } = req.body;

    // Validate guild exists
    const guildSettings = await db.query.guildSettings.findFirst({
      where: eq(schema.guildSettings.guildId, guildId),
    });

    if (!guildSettings) {
      return res.status(404).json({ error: "Guild not found" });
    }

    // Fetch suggestion with guild validation
    const suggestion = await db.query.modSuggestions.findFirst({
      where: and(
        eq(schema.modSuggestions.id, parseInt(id)),
        eq(schema.modSuggestions.guildId, guildSettings.id)
      ),
    });

    if (!suggestion) {
      return res.status(404).json({ error: "Suggestion not found in this guild" });
    }

    if (suggestion.status !== 'pending') {
      return res.status(400).json({ error: "Suggestion has already been reviewed" });
    }

    const reviewer = await db.query.discordUsers.findFirst({
      where: eq(schema.discordUsers.discordId, reviewerDiscordId),
    });

    if (!reviewer) {
      return res.status(404).json({ error: "Reviewer not found" });
    }

    // Update suggestion status
    const [updated] = await db.update(schema.modSuggestions)
      .set({
        status: 'rejected',
        reviewedBy: reviewer.id,
        reviewNotes: reviewNotes || null,
        decidedAt: new Date(),
      })
      .where(eq(schema.modSuggestions.id, parseInt(id)))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("Error rejecting mod suggestion:", error);
    res.status(500).json({ error: "Failed to reject suggestion" });
  }
});
