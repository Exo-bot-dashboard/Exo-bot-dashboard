import OpenAI from 'openai';

// Initialize OpenAI client with Replit AI Integrations
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface AIModSuggestion {
  suggestedAction: 'warn' | 'mute' | 'kick' | 'ban' | 'ignore';
  analysis: string;
  confidenceScore: number;
  suggestedDuration?: number; // in minutes for mute/ban
  rawResponse?: string;
}

export interface ChannelMessage {
  content: string;
  authorId: string;
  authorUsername: string;
  timestamp: Date;
}

export interface AIPunishmentSuggestion {
  shouldPunish: boolean;
  targetUserId: string | null;
  targetUsername: string | null;
  suggestedAction: 'warn' | 'mute' | 'timeout' | 'kick' | 'ban' | 'temp_ban' | 'quarantine_temp' | 'quarantine_perm' | 'shadowban' | 'role_remove' | 'none';
  reasoning: string;
  confidenceScore: number;
  suggestedDuration?: number; // in minutes for mute/ban/timeout/temp_ban/quarantine_temp
  roleToRemove?: string; // role name for role_remove action
  rawResponse: string;
}

export async function analyzeMessageForModeration(
  messageContent: string,
  userHistory?: {
    previousWarnings: number;
    previousMutes: number;
    previousBans: number;
  }
): Promise<AIModSuggestion> {
  const historyContext = userHistory
    ? `\nUser moderation history: ${userHistory.previousWarnings} warnings, ${userHistory.previousMutes} mutes, ${userHistory.previousBans} bans.`
    : '';

  const prompt = `You are an AI moderation assistant analyzing a Discord message for potential rule violations.

Message content:
"${messageContent}"
${historyContext}

Analyze this message and recommend ONE of the following actions:
- **warn**: Message is mildly inappropriate or violates community guidelines but not severe
- **mute**: Message contains spam, harassment, or repeated violations (suggest duration in minutes)
- **kick**: Message is severely inappropriate or harmful but doesn't warrant permanent removal
- **ban**: Message contains illegal content, severe harassment, or threats (suggest duration in minutes, or 0 for permanent)
- **ignore**: Message is acceptable or flagged incorrectly

Provide your analysis in the following JSON format:
{
  "suggestedAction": "warn|mute|kick|ban|ignore",
  "analysis": "Brief explanation of why you recommend this action (2-3 sentences)",
  "confidenceScore": 0-100,
  "suggestedDuration": (optional, in minutes for mute/ban, 0 for permanent ban)
}

Consider:
- Severity of language or behavior
- Context and intent
- User's moderation history (if provided)
- Community safety vs. over-moderation balance

Be fair, objective, and err on the side of lighter moderation when in doubt.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a fair and objective Discord moderation assistant. Respond ONLY with valid JSON in the exact format specified.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent/deterministic outputs
      max_tokens: 300,
      response_format: { type: 'json_object' }, // Enforce JSON output
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    // Log raw AI output for audit trail
    console.log('[AI Mod] Raw response:', {
      timestamp: new Date().toISOString(),
      message: messageContent.substring(0, 100) + '...',
      response: responseText,
    });

    // Parse and validate JSON response
    const result = JSON.parse(responseText);

    // Hard validation of all fields
    const validActions: AIModSuggestion['suggestedAction'][] = ['warn', 'mute', 'kick', 'ban', 'ignore'];
    
    const suggestedAction = validActions.includes(result.suggestedAction) 
      ? result.suggestedAction 
      : 'ignore';
    
    const analysis = typeof result.analysis === 'string' && result.analysis.length > 0
      ? result.analysis.substring(0, 500) // Cap analysis length
      : 'No analysis provided';
    
    const confidenceScore = typeof result.confidenceScore === 'number'
      ? Math.min(100, Math.max(0, result.confidenceScore))
      : 50;
    
    const suggestedDuration = typeof result.suggestedDuration === 'number'
      ? Math.max(0, result.suggestedDuration)
      : undefined;

    // Validate duration makes sense for the action
    const finalDuration = (['mute', 'ban'].includes(suggestedAction) && suggestedDuration !== undefined)
      ? suggestedDuration
      : undefined;

    return {
      suggestedAction,
      analysis,
      confidenceScore,
      suggestedDuration: finalDuration,
      rawResponse: responseText,
    };
  } catch (error) {
    console.error('AI moderation analysis error:', error);
    
    // Log error for audit trail
    console.error('[AI Mod] Analysis failed:', {
      timestamp: new Date().toISOString(),
      message: messageContent.substring(0, 100) + '...',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    // Fallback suggestion when AI fails
    return {
      suggestedAction: 'ignore',
      analysis: 'AI analysis failed. Manual review required.',
      confidenceScore: 0,
      rawResponse: JSON.stringify({ error: 'AI analysis failed' }),
    };
  }
}

/**
 * Analyzes the last 10 messages in a channel to determine if anyone should be punished
 * This is used by the /aipunish slash command
 */
export async function analyzeChannelForPunishment(
  messages: ChannelMessage[],
  userHistories: Map<string, { warnings: number; mutes: number; bans: number }>
): Promise<AIPunishmentSuggestion> {
  // Format messages for AI analysis
  const conversationContext = messages
    .map((msg, idx) => {
      const history = userHistories.get(msg.authorId);
      const historyNote = history 
        ? ` [History: ${history.warnings}W/${history.mutes}M/${history.bans}B]`
        : '';
      return `${idx + 1}. @${msg.authorUsername} (${msg.timestamp.toLocaleTimeString()})${historyNote}:\n   "${msg.content}"`;
    })
    .join('\n\n');

  const prompt = `You are an expert Discord moderation AI assistant analyzing a conversation to determine if anyone should be punished.

**Recent Channel Messages (oldest to newest):**
${conversationContext}

**Your Task:**
Analyze these messages carefully and determine:
1. Is there ANY rule violation, inappropriate behavior, harassment, spam, or harmful content?
2. If YES: Who is the primary violator? What punishment is appropriate?
3. If NO: Explain why no punishment is needed.

**Moderation Guidelines:**
- **warn**: Minor violations (mild profanity, off-topic spam, minor arguments)
- **mute**: Repeated spam, harassment, disrespectful behavior (permanent mute in server)
- **timeout**: Temporary restriction from chatting (suggest duration in minutes: 5-1440)
- **kick**: Serious violations (severe harassment, hate speech, intentional disruption)
- **ban**: Permanent ban from server for extreme violations (threats, illegal content, severe hate speech)
- **temp_ban**: Temporary ban from server (suggest duration in minutes: 60-10080)
- **quarantine_temp**: Apply quarantine role temporarily to restrict access (suggest duration in minutes: 60-10080)
- **quarantine_perm**: Apply quarantine role permanently to restrict access without full ban
- **shadowban**: User can send messages but nobody else can see them (invisible to community)
- **role_remove**: Remove a specific role as punishment (e.g., remove "Verified" or "Member" role)
- **none**: No violations detected OR behavior is acceptable in context

**Important Considerations:**
- Context matters: Friendly banter vs actual harassment
- Examine the ENTIRE conversation flow, not just individual messages
- Consider user history: Repeat offenders deserve harsher punishment
- Be fair and objective: Don't over-moderate casual conversations
- Look for patterns: Is someone consistently problematic?
- If multiple people are arguing, identify who started it or who's being most harmful

**Response Format (JSON only):**
{
  "shouldPunish": true/false,
  "targetUserId": "user_id_or_null",
  "targetUsername": "username_or_null",
  "suggestedAction": "warn|mute|timeout|kick|ban|temp_ban|quarantine_temp|quarantine_perm|shadowban|role_remove|none",
  "reasoning": "Detailed explanation of your decision (3-5 sentences). If no punishment: explain why the conversation is acceptable.",
  "confidenceScore": 0-100,
  "suggestedDuration": (optional, in minutes for timeout/temp_ban/quarantine_temp),
  "roleToRemove": (optional, role name if action is role_remove)
}

**Examples:**
- Friendly teasing between friends → none
- One user spamming links repeatedly → timeout (15-60 min)
- Minor first-time rudeness → warn
- Repeated harassment after warnings → temp_ban (1-3 days)
- Serious threats or illegal content → ban (permanent)
- Toxic user who needs cooling off → quarantine_temp (1-7 days)
- User spreading misinformation maliciously → shadowban
- User abusing role privileges → role_remove
- Heated argument where both parties are civil → none
- One person being consistently toxic while others are normal → timeout/temp_ban depending on severity

Analyze carefully and be thorough. Your decision impacts community safety.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert Discord moderation AI. You must be thorough, fair, and context-aware. Respond ONLY with valid JSON in the exact format specified. Be decisive but fair.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.4, // Slightly higher for nuanced understanding
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    // Log raw AI output for audit trail
    console.log('[AI Punish] Raw response:', {
      timestamp: new Date().toISOString(),
      messageCount: messages.length,
      response: responseText,
    });

    // Parse and validate JSON response
    const result = JSON.parse(responseText);

    // Hard validation of all fields
    const validActions: AIPunishmentSuggestion['suggestedAction'][] = [
      'warn', 'mute', 'timeout', 'kick', 'ban', 'temp_ban', 
      'quarantine_temp', 'quarantine_perm', 'shadowban', 'role_remove', 'none'
    ];
    
    const shouldPunish = result.shouldPunish === true;
    const targetUserId = shouldPunish && typeof result.targetUserId === 'string' ? result.targetUserId : null;
    const targetUsername = shouldPunish && typeof result.targetUsername === 'string' ? result.targetUsername : null;
    
    const suggestedAction = validActions.includes(result.suggestedAction) 
      ? result.suggestedAction 
      : 'none';
    
    const reasoning = typeof result.reasoning === 'string' && result.reasoning.length > 0
      ? result.reasoning.substring(0, 1000) // Cap reasoning length
      : 'No reasoning provided';
    
    const confidenceScore = typeof result.confidenceScore === 'number'
      ? Math.min(100, Math.max(0, result.confidenceScore))
      : 50;
    
    const suggestedDuration = typeof result.suggestedDuration === 'number'
      ? Math.max(0, result.suggestedDuration)
      : undefined;

    const roleToRemove = typeof result.roleToRemove === 'string' && result.roleToRemove.length > 0
      ? result.roleToRemove
      : undefined;

    // Validate duration makes sense for the action
    const actionsNeedingDuration = ['timeout', 'temp_ban', 'quarantine_temp'];
    const finalDuration = (actionsNeedingDuration.includes(suggestedAction) && suggestedDuration !== undefined)
      ? suggestedDuration
      : undefined;

    return {
      shouldPunish,
      targetUserId,
      targetUsername,
      suggestedAction,
      reasoning,
      confidenceScore,
      suggestedDuration: finalDuration,
      roleToRemove,
      rawResponse: responseText,
    };
  } catch (error) {
    console.error('AI punishment analysis error:', error);
    
    // Log error for audit trail
    console.error('[AI Punish] Analysis failed:', {
      timestamp: new Date().toISOString(),
      messageCount: messages.length,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    // Fallback suggestion when AI fails
    return {
      shouldPunish: false,
      targetUserId: null,
      targetUsername: null,
      suggestedAction: 'none',
      reasoning: 'AI analysis failed. Manual review of the conversation is recommended.',
      confidenceScore: 0,
      rawResponse: JSON.stringify({ error: 'AI analysis failed' }),
    };
  }
}
