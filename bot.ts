import { Client, GatewayIntentBits, Events, Message, Guild, GuildMember, TextChannel, EmbedBuilder, PermissionsBitField, User, DMChannel, ChannelType, REST, Routes, SlashCommandBuilder, ChatInputCommandInteraction, ApplicationCommandDataResolvable, MessageReaction, PartialMessageReaction, PartialUser, Partials } from "discord.js";
import { storage } from "./storage";

export class DiscordBot {
  private client: Client;
  private isReady = false;
  private rest: REST | null = null;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessageReactions,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on(Events.ClientReady, async () => {
      console.log(`Bot logged in as ${this.client.user?.tag}`);
      this.isReady = true;
      this.client.user?.setPresence({
        activities: [{ name: 'Dashboard at /dashboard', type: 0 }],
        status: 'online',
      });
      
      // Initialize REST client for slash commands
      if (process.env.DISCORD_BOT_TOKEN) {
        this.rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
      }
      
      // Register slash commands for all guilds on startup
      await this.registerSlashCommandsForAllGuilds();
    });

    // Handle slash command interactions
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.handleSlashCommand(interaction);
    });

    this.client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;
      
      // Track user activity
      try {
        await storage.updateUserLastSeen(message.author.id);
      } catch (error) {
        console.error('Error updating last seen:', error);
      }

      // Check for shadowban and delete message immediately
      if (message.guild) {
        try {
          const guildSettings = await storage.getOrCreateGuildSettings(message.guild.id, message.guild.name);
          const user = await storage.getDiscordUser(message.author.id);
          
          if (user) {
            const shadowban = await storage.getShadowban(user.id, guildSettings.id);
            if (shadowban) {
              // Shadowbanned user - delete their message silently
              await message.delete().catch(() => {});
              return; // Don't process the message further
            }
          }
        } catch (error) {
          console.error('Error checking shadowban:', error);
        }
      }

      // Handle bot mentions
      if (message.mentions.has(this.client.user!.id)) {
        try {
          const guildSettings = message.guild ? await storage.getOrCreateGuildSettings(message.guild.id, message.guild.name) : null;
          const prefix = guildSettings?.prefix || '!';
          
          // Get the dashboard URL from environment
          const dashboardUrl = process.env.REPLIT_DEV_DOMAIN 
            ? `https://${process.env.REPLIT_DEV_DOMAIN}`
            : 'https://exo-dashboard.replit.app';
          
          const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('👋 Hello! I\'m Exo')
            .setDescription('A comprehensive Discord bot with moderation, economy, and more!')
            .addFields(
              { name: 'Prefix', value: `\`${prefix}\``, inline: true },
              { name: 'Dashboard', value: `[Configure me here](${dashboardUrl})`, inline: true }
            )
            .setFooter({ text: 'Use /help to see available commands' });
          
          await message.reply({ embeds: [embed] });
        } catch (error) {
          console.error('Error handling bot mention:', error);
        }
      }

      await this.handleCommand(message);
      await this.handleModmail(message);
      await this.handleAutoMod(message);
    });

    this.client.on(Events.GuildMemberAdd, async (member) => {
      await this.handleWelcome(member);
      await this.handleSecurity(member);
    });

    this.client.on(Events.GuildMemberRemove, async (member) => {
      if (member.partial) {
        try {
          await member.fetch();
        } catch (error) {
          console.error('Could not fetch partial member:', error);
          return;
        }
      }
      await this.handleGoodbye(member);
    });

    // Reaction role handlers
    this.client.on(Events.MessageReactionAdd, async (reaction, user) => {
      await this.handleReactionRoleAdd(reaction, user);
    });

    this.client.on(Events.MessageReactionRemove, async (reaction, user) => {
      await this.handleReactionRoleRemove(reaction, user);
    });
  }

  // Slash command registration methods
  public async registerSlashCommandsForGuild(guildId: string): Promise<void> {
    if (!this.rest || !this.client.user) return;

    try {
      const guildSettings = await storage.getOrCreateGuildSettings(guildId, "");
      const modmailSettings = await storage.getModmailSettings(guildSettings.id);
      const autoModSettings = await storage.getAutoModSettings(guildSettings.id);
      const economySettings = await storage.getEconomySettings(guildSettings.id);
      const giveawaySettings = await storage.getGiveawaySettings(guildSettings.id);
      const appealSettings = await storage.getAppealSettings(guildSettings.id);

      const commands: ApplicationCommandDataResolvable[] = [];

      // User tracking commands (always available)
      commands.push(
        new SlashCommandBuilder()
          .setName('seen')
          .setDescription('Check when a user was last seen')
          .addUserOption(option =>
            option.setName('user')
              .setDescription('User to check')
              .setRequired(true)
          ).toJSON()
      );

      // Economy commands (if economy is enabled)
      if (economySettings?.enabled) {
        commands.push(
          new SlashCommandBuilder()
            .setName('balance')
            .setDescription('Check your balance')
            .addUserOption(option =>
              option.setName('user')
                .setDescription('User to check balance for (optional)')
                .setRequired(false)
            ).toJSON(),
          new SlashCommandBuilder()
            .setName('daily')
            .setDescription('Claim your daily reward')
            .toJSON(),
          new SlashCommandBuilder()
            .setName('work')
            .setDescription('Work to earn coins')
            .toJSON(),
          new SlashCommandBuilder()
            .setName('pay')
            .setDescription('Pay coins to another user')
            .addUserOption(option =>
              option.setName('user')
                .setDescription('User to pay')
                .setRequired(true)
            )
            .addIntegerOption(option =>
              option.setName('amount')
                .setDescription('Amount to pay')
                .setRequired(true)
                .setMinValue(1)
            ).toJSON(),
          new SlashCommandBuilder()
            .setName('shop')
            .setDescription('View the shop')
            .toJSON(),
          new SlashCommandBuilder()
            .setName('buy')
            .setDescription('Buy an item from the shop')
            .addStringOption(option =>
              option.setName('item')
                .setDescription('Item name to buy')
                .setRequired(true)
            ).toJSON(),
          new SlashCommandBuilder()
            .setName('trade')
            .setDescription('Propose a trade with another user')
            .addUserOption(option =>
              option.setName('user')
                .setDescription('User to trade with')
                .setRequired(true)
            ).toJSON(),
          new SlashCommandBuilder()
            .setName('accept')
            .setDescription('Accept a pending trade offer')
            .addIntegerOption(option =>
              option.setName('trade_id')
                .setDescription('ID of the trade to accept')
                .setRequired(true)
            ).toJSON(),
          new SlashCommandBuilder()
            .setName('decline')
            .setDescription('Decline a pending trade offer')
            .addIntegerOption(option =>
              option.setName('trade_id')
                .setDescription('ID of the trade to decline')
                .setRequired(true)
            ).toJSON(),
          new SlashCommandBuilder()
            .setName('trades')
            .setDescription('View your active trade offers')
            .toJSON()
        );
      }

      // Modmail commands (if modmail is enabled)
      if (modmailSettings?.enabled) {
        commands.push(
          new SlashCommandBuilder()
            .setName('ticket')
            .setDescription('Create a support ticket')
            .addStringOption(option =>
              option.setName('subject')
                .setDescription('Subject of your ticket')
                .setRequired(false)
            ).toJSON(),
          new SlashCommandBuilder()
            .setName('closeticket')
            .setDescription('Close the current support ticket')
            .toJSON()
        );
      }

      // Moderation commands (always available - permissions enforced at command level)
      commands.push(
        new SlashCommandBuilder()
          .setName('warn')
          .setDescription('Warn a user')
          .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
          .addUserOption(option =>
            option.setName('user')
              .setDescription('User to warn')
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName('reason')
              .setDescription('Reason for the warning')
              .setRequired(true)
          ).toJSON(),
        new SlashCommandBuilder()
          .setName('mute')
          .setDescription('Mute a user')
          .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
          .addUserOption(option =>
            option.setName('user')
              .setDescription('User to mute')
              .setRequired(true)
          )
          .addIntegerOption(option =>
            option.setName('duration')
              .setDescription('Duration in minutes')
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName('reason')
              .setDescription('Reason for the mute')
              .setRequired(true)
          ).toJSON(),
        new SlashCommandBuilder()
          .setName('kick')
          .setDescription('Kick a user')
          .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers)
          .addUserOption(option =>
            option.setName('user')
              .setDescription('User to kick')
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName('reason')
              .setDescription('Reason for the kick')
              .setRequired(true)
          ).toJSON(),
        new SlashCommandBuilder()
          .setName('ban')
          .setDescription('Ban a user')
          .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
          .addUserOption(option =>
            option.setName('user')
              .setDescription('User to ban')
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName('reason')
              .setDescription('Reason for the ban')
              .setRequired(true)
          ).toJSON(),
        new SlashCommandBuilder()
          .setName('shadowban')
          .setDescription('Shadowban a user (they can send messages but no one else can see them)')
          .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
          .addUserOption(option =>
            option.setName('user')
              .setDescription('User to shadowban')
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName('reason')
              .setDescription('Reason for the shadowban')
              .setRequired(false)
          ).toJSON(),
        new SlashCommandBuilder()
          .setName('unshadowban')
          .setDescription('Remove shadowban from a user')
          .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
          .addUserOption(option =>
            option.setName('user')
              .setDescription('User to unshadowban')
              .setRequired(true)
          ).toJSON(),
        new SlashCommandBuilder()
          .setName('aipunish')
          .setDescription('AI analyzes recent messages to decide who to punish and what the punishment should be')
          .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
          .addIntegerOption(option =>
            option.setName('messages')
              .setDescription('Number of recent messages to analyze (1-250, default: 10)')
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(250)
          )
          .toJSON()
      );

      // Giveaway commands (if giveaways are enabled)
      if (giveawaySettings?.enabled) {
        commands.push(
          new SlashCommandBuilder()
            .setName('giveaway')
            .setDescription('Create a giveaway')
            .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
            .addSubcommand(subcommand =>
              subcommand
                .setName('create')
                .setDescription('Create a new giveaway')
                .addStringOption(option =>
                  option.setName('prize')
                    .setDescription('What are you giving away?')
                    .setRequired(true)
                )
                .addIntegerOption(option =>
                  option.setName('duration')
                    .setDescription('Duration in minutes')
                    .setRequired(true)
                    .setMinValue(1)
                )
                .addIntegerOption(option =>
                  option.setName('winners')
                    .setDescription('Number of winners')
                    .setRequired(false)
                    .setMinValue(1)
                )
                .addChannelOption(option =>
                  option.setName('channel')
                    .setDescription('Channel to post the giveaway')
                    .setRequired(false)
                )
                .addRoleOption(option =>
                  option.setName('modifier_1_role')
                    .setDescription('Role with modified entry chance (1/5)')
                    .setRequired(false)
                )
                .addNumberOption(option =>
                  option.setName('modifier_1_multiplier')
                    .setDescription('Entry multiplier for role 1 (0.1-10.0, <1 = less chance, >1 = more)')
                    .setRequired(false)
                    .setMinValue(0.1)
                    .setMaxValue(10.0)
                )
                .addRoleOption(option =>
                  option.setName('modifier_2_role')
                    .setDescription('Role with modified entry chance (2/5)')
                    .setRequired(false)
                )
                .addNumberOption(option =>
                  option.setName('modifier_2_multiplier')
                    .setDescription('Entry multiplier for role 2 (0.1-10.0, <1 = less chance, >1 = more)')
                    .setRequired(false)
                    .setMinValue(0.1)
                    .setMaxValue(10.0)
                )
                .addRoleOption(option =>
                  option.setName('modifier_3_role')
                    .setDescription('Role with modified entry chance (3/5)')
                    .setRequired(false)
                )
                .addNumberOption(option =>
                  option.setName('modifier_3_multiplier')
                    .setDescription('Entry multiplier for role 3 (0.1-10.0, <1 = less chance, >1 = more)')
                    .setRequired(false)
                    .setMinValue(0.1)
                    .setMaxValue(10.0)
                )
                .addRoleOption(option =>
                  option.setName('modifier_4_role')
                    .setDescription('Role with modified entry chance (4/5)')
                    .setRequired(false)
                )
                .addNumberOption(option =>
                  option.setName('modifier_4_multiplier')
                    .setDescription('Entry multiplier for role 4 (0.1-10.0, <1 = less chance, >1 = more)')
                    .setRequired(false)
                    .setMinValue(0.1)
                    .setMaxValue(10.0)
                )
                .addRoleOption(option =>
                  option.setName('modifier_5_role')
                    .setDescription('Role with modified entry chance (5/5)')
                    .setRequired(false)
                )
                .addNumberOption(option =>
                  option.setName('modifier_5_multiplier')
                    .setDescription('Entry multiplier for role 5 (0.1-10.0, <1 = less chance, >1 = more)')
                    .setRequired(false)
                    .setMinValue(0.1)
                    .setMaxValue(10.0)
                )
            )
            .addSubcommand(subcommand =>
              subcommand
                .setName('template')
                .setDescription('Create a giveaway from a template')
                .addStringOption(option =>
                  option.setName('name')
                    .setDescription('Template name')
                    .setRequired(true)
                )
                .addChannelOption(option =>
                  option.setName('channel')
                    .setDescription('Channel to post the giveaway')
                    .setRequired(false)
                )
            ).toJSON(),
          new SlashCommandBuilder()
            .setName('reroll')
            .setDescription('Reroll the winners of a giveaway')
            .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
            .addIntegerOption(option =>
              option.setName('giveaway_id')
                .setDescription('ID of the giveaway to reroll')
                .setRequired(true)
            ).toJSON(),
          new SlashCommandBuilder()
            .setName('end')
            .setDescription('End a giveaway early')
            .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
            .addIntegerOption(option =>
              option.setName('giveaway_id')
                .setDescription('ID of the giveaway to end')
                .setRequired(true)
            ).toJSON()
        );
      }

      // Appeal commands (if appeals are enabled)
      if (appealSettings?.enabled) {
        commands.push(
          new SlashCommandBuilder()
            .setName('appeal')
            .setDescription('Appeal your ban')
            .addStringOption(option =>
              option.setName('reason')
                .setDescription('Why should your ban be appealed?')
                .setRequired(true)
            ).toJSON()
        );
      }

      // Custom slash commands
      const customCommands = await storage.getCustomCommands(guildSettings.id);
      for (const customCmd of customCommands.filter(c => c.isSlashCommand)) {
        commands.push(
          new SlashCommandBuilder()
            .setName(customCmd.trigger)
            .setDescription(customCmd.description || 'Custom command')
            .toJSON()
        );
      }

      // Register commands for this guild
      await this.rest.put(
        Routes.applicationGuildCommands(this.client.user.id, guildId),
        { body: commands }
      );

      console.log(`Registered ${commands.length} slash commands for guild ${guildId}`);
    } catch (error) {
      console.error(`Error registering slash commands for guild ${guildId}:`, error);
    }
  }

  private async registerSlashCommandsForAllGuilds(): Promise<void> {
    if (!this.client.guilds) return;

    for (const guild of this.client.guilds.cache.values()) {
      await this.registerSlashCommandsForGuild(guild.id);
    }
  }

  private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const { commandName } = interaction;

    try {
      // User tracking commands
      if (commandName === 'seen') {
        await this.handleSeenSlashCommand(interaction);
      }
      // Economy commands
      else if (commandName === 'balance') {
        await this.handleBalanceSlashCommand(interaction);
      } else if (commandName === 'daily') {
        await this.handleDailySlashCommand(interaction);
      } else if (commandName === 'work') {
        await this.handleWorkSlashCommand(interaction);
      } else if (commandName === 'pay') {
        await this.handlePaySlashCommand(interaction);
      } else if (commandName === 'shop') {
        await this.handleShopSlashCommand(interaction);
      } else if (commandName === 'buy') {
        await this.handleBuySlashCommand(interaction);
      } else if (commandName === 'trade') {
        await this.handleTradeSlashCommand(interaction);
      } else if (commandName === 'accept') {
        await this.handleAcceptTradeSlashCommand(interaction);
      } else if (commandName === 'decline') {
        await this.handleDeclineTradeSlashCommand(interaction);
      } else if (commandName === 'trades') {
        await this.handleTradesSlashCommand(interaction);
      }
      // Modmail commands
      else if (commandName === 'ticket') {
        await this.handleTicketSlashCommand(interaction);
      } else if (commandName === 'closeticket') {
        await this.handleCloseTicketSlashCommand(interaction);
      }
      // Moderation commands
      else if (commandName === 'warn') {
        await this.handleWarnSlashCommand(interaction);
      } else if (commandName === 'mute') {
        await this.handleMuteSlashCommand(interaction);
      } else if (commandName === 'kick') {
        await this.handleKickSlashCommand(interaction);
      } else if (commandName === 'ban') {
        await this.handleBanSlashCommand(interaction);
      } else if (commandName === 'shadowban') {
        await this.handleShadowbanSlashCommand(interaction);
      } else if (commandName === 'unshadowban') {
        await this.handleUnshadowbanSlashCommand(interaction);
      } else if (commandName === 'aipunish') {
        await this.handleAIPunishSlashCommand(interaction);
      }
      // Giveaway commands
      else if (commandName === 'giveaway') {
        await this.handleGiveawaySlashCommand(interaction);
      } else if (commandName === 'reroll') {
        await this.handleRerollSlashCommand(interaction);
      } else if (commandName === 'end') {
        await this.handleEndGiveawaySlashCommand(interaction);
      }
      // Appeal commands
      else if (commandName === 'appeal') {
        await this.handleAppealSlashCommand(interaction);
      }
      // Custom commands
      else {
        await this.handleCustomSlashCommand(interaction);
      }
    } catch (error) {
      console.error(`Error executing slash command ${commandName}:`, error);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: 'An error occurred while executing the command.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'An error occurred while executing the command.', ephemeral: true });
      }
    }
  }

  private async handleCustomSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) return;

    const guildSettings = await storage.getOrCreateGuildSettings(interaction.guildId, "");
    const customCommands = await storage.getCustomCommands(guildSettings.id);
    const command = customCommands.find(c => c.trigger === interaction.commandName && c.isSlashCommand);

    if (!command) {
      await interaction.reply({ content: 'Command not found.', ephemeral: true });
      return;
    }

    // Create a mock message object for template parsing
    const mockMessage: any = {
      author: interaction.user,
      guild: interaction.guild,
      channel: interaction.channel,
    };

    const response = this.parseTemplateVariables(command.response, mockMessage);
    const title = command.embedTitle ? this.parseTemplateVariables(command.embedTitle, mockMessage) : undefined;

    if (command.embedEnabled) {
      const embed = new EmbedBuilder()
        .setDescription(response);
      
      if (command.embedColor) embed.setColor(command.embedColor as any);
      if (title) embed.setTitle(title);

      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.reply(response);
    }
  }

  // Slash command handlers (stubs for now)
  private async handleTicketSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({ content: 'Ticket system will be implemented in the modmail dashboard.', ephemeral: true });
  }

  private async handleCloseTicketSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({ content: 'Ticket closing will be implemented in the modmail dashboard.', ephemeral: true });
  }

  private async handleWarnSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
      return;
    }

    // Runtime permission check (use memberPermissions which is always a Permissions object)
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers)) {
      await interaction.reply({ content: '❌ You need the Moderate Members permission to use this command.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    await interaction.reply({ content: `⚠️ Warning slash command received for ${user.tag}: ${reason}. Full implementation in moderation dashboard.`, ephemeral: true });
  }

  private async handleMuteSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
      return;
    }

    // Runtime permission check (use memberPermissions which is always a Permissions object)
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers)) {
      await interaction.reply({ content: '❌ You need the Moderate Members permission to use this command.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const duration = interaction.options.getInteger('duration', true);
    const reason = interaction.options.getString('reason', true);
    await interaction.reply({ content: `🔇 Mute slash command received for ${user.tag} (${duration}min): ${reason}. Full implementation in moderation dashboard.`, ephemeral: true });
  }

  private async handleKickSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
      return;
    }

    // Runtime permission check (use memberPermissions which is always a Permissions object)
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.KickMembers)) {
      await interaction.reply({ content: '❌ You need the Kick Members permission to use this command.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    await interaction.reply({ content: `👢 Kick slash command received for ${user.tag}: ${reason}. Full implementation in moderation dashboard.`, ephemeral: true });
  }

  private async handleBanSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
      return;
    }

    // Runtime permission check (use memberPermissions which is always a Permissions object)
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.BanMembers)) {
      await interaction.reply({ content: '❌ You need the Ban Members permission to use this command.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    await interaction.reply({ content: `🔨 Ban slash command received for ${user.tag}: ${reason}. Full implementation in moderation dashboard.`, ephemeral: true });
  }

  private async handleAppealSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const guildId = interaction.guild?.id;
      if (!guildId) {
        await interaction.reply({ content: '❌ This command must be used in a server.', ephemeral: true });
        return;
      }

      const reason = interaction.options.getString('reason', true);
      const guildSettings = await storage.getOrCreateGuildSettings(guildId, interaction.guild!.name);
      const appealSettings = await storage.getAppealSettings(guildSettings.id);

      if (!appealSettings?.enabled) {
        await interaction.reply({ content: '❌ The appeal system is not enabled in this server.', ephemeral: true });
        return;
      }

      const user = await storage.getOrCreateDiscordUser(interaction.user.id, interaction.user.username, interaction.user.discriminator, interaction.user.avatar);
      const activeBan = await storage.getActiveBanForUser(user.id, guildSettings.id);

      if (!activeBan) {
        await interaction.reply({ content: '❌ You do not have an active ban in this server.', ephemeral: true });
        return;
      }

      await storage.createAppeal({
        guildId: guildSettings.id,
        userId: user.id,
        moderationActionId: activeBan.id,
        banReason: activeBan.reason,
        appealReason: reason
      });

      await interaction.reply({
        content: '✅ Your appeal has been submitted successfully! Server moderators will review it soon.',
        ephemeral: true
      });
    } catch (error) {
      console.error('Error handling appeal:', error);
      await interaction.reply({ content: '❌ Failed to submit appeal. Please try again later.', ephemeral: true });
    }
  }

  private async handleShadowbanSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
      return;
    }

    // Runtime permission check (use memberPermissions which is always a Permissions object)
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers)) {
      await interaction.reply({ content: '❌ You need the Moderate Members permission to use this command.', ephemeral: true });
      return;
    }

    try {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') || 'No reason provided';
      
      const guildSettings = await storage.getOrCreateGuildSettings(interaction.guildId!, interaction.guild!.name);
      const moderator = await storage.getOrCreateDiscordUser(interaction.user.id, interaction.user.username);
      const targetUser = await storage.getOrCreateDiscordUser(user.id, user.username);

      // Check if user is already shadowbanned
      const existing = await storage.getShadowban(targetUser.id, guildSettings.id);
      if (existing) {
        await interaction.reply({ content: `${user.tag} is already shadowbanned.`, ephemeral: true });
        return;
      }

      // Create shadowban
      await storage.createShadowban({
        userId: targetUser.id,
        guildId: guildSettings.id,
        moderatorId: moderator.id,
        reason
      });

      await interaction.reply({ content: `🔇 Successfully shadowbanned ${user.tag}. Their messages will now be invisible to other users.`, ephemeral: true });
    } catch (error) {
      console.error('Error in shadowban command:', error);
      await interaction.reply({ content: 'An error occurred while shadowbanning the user.', ephemeral: true });
    }
  }

  private async handleUnshadowbanSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
      return;
    }

    // Runtime permission check (use memberPermissions which is always a Permissions object)
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers)) {
      await interaction.reply({ content: '❌ You need the Moderate Members permission to use this command.', ephemeral: true });
      return;
    }

    try {
      const user = interaction.options.getUser('user', true);
      
      const guildSettings = await storage.getOrCreateGuildSettings(interaction.guildId!, interaction.guild!.name);
      const targetUser = await storage.getOrCreateDiscordUser(user.id, user.username);

      // Find and remove shadowban
      const shadowban = await storage.getShadowban(targetUser.id, guildSettings.id);
      if (!shadowban) {
        await interaction.reply({ content: `${user.tag} is not shadowbanned.`, ephemeral: true });
        return;
      }

      await storage.deleteShadowban(shadowban.id);
      await interaction.reply({ content: `✅ Successfully removed shadowban from ${user.tag}.`, ephemeral: true });
    } catch (error) {
      console.error('Error in unshadowban command:', error);
      await interaction.reply({ content: 'An error occurred while removing the shadowban.', ephemeral: true });
    }
  }

  private async handleAIPunishSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.member || !interaction.channel) {
      await interaction.reply({ content: '❌ This command can only be used in a server text channel.', ephemeral: true });
      return;
    }

    // Runtime permission check
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers)) {
      await interaction.reply({ content: '❌ You need the Moderate Members permission to use this command.', ephemeral: true });
      return;
    }

    // Defer reply as AI analysis may take a moment
    await interaction.deferReply({ ephemeral: true });

    try {
      const { analyzeChannelForPunishment } = await import('./ai-mod');
      
      const guildSettings = await storage.getOrCreateGuildSettings(interaction.guildId!, interaction.guild.name);
      const channel = interaction.channel as TextChannel;

      // Get message count from option (default: 10)
      const messageCount = interaction.options.getInteger('messages') || 10;

      // Fetch messages with pagination support (Discord API limit is 100 per fetch)
      // Continue until we have enough USER messages (not just raw messages)
      const allMessages: Message[] = [];
      let lastMessageId: string | undefined = undefined;
      let userMessageCount = 0;
      const maxFetches = 30; // Safety limit (30 * 100 = 3000 messages max)
      let fetchCount = 0;
      
      while (userMessageCount < messageCount && fetchCount < maxFetches) {
        const batch = await channel.messages.fetch({
          limit: 100,
          ...(lastMessageId && { before: lastMessageId }),
        });
        
        if (batch.size === 0) {
          break; // No more messages in channel
        }
        
        // Add all messages to collection
        allMessages.push(...Array.from(batch.values()));
        
        // Count user messages (excluding bots and command itself)
        userMessageCount = allMessages.filter(
          msg => !msg.author.bot && msg.id !== interaction.id
        ).length;
        
        lastMessageId = batch.last()?.id;
        fetchCount++;
        
        if (batch.size < 100) {
          break; // Reached end of channel history
        }
      }

      // Filter and sort messages
      const userMessages = allMessages
        .filter(msg => !msg.author.bot && msg.id !== interaction.id)
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .slice(-messageCount); // Get last N user messages

      if (userMessages.length === 0) {
        await interaction.editReply({ content: '❌ No recent messages found to analyze.' });
        return;
      }

      // Get unique user IDs from messages
      const uniqueUserIds = [...new Set(userMessages.map(msg => msg.author.id))];
      
      // Get user histories for all users
      const userHistories = new Map<string, { warnings: number; mutes: number; bans: number }>();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const userId of uniqueUserIds) {
        const user = await storage.getOrCreateDiscordUser(userId, 'Unknown');
        
        const [warnings, actions] = await Promise.all([
          storage.getWarnings(guildSettings.id, user.id),
          storage.getModerationActions(guildSettings.id)
        ]);

        // Filter to last 30 days and count by type
        const recentWarnings = warnings.filter(w => w.createdAt >= thirtyDaysAgo);
        const recentActions = actions.filter(a => a.userId === user.id && a.createdAt >= thirtyDaysAgo);
        
        userHistories.set(userId, {
          warnings: recentWarnings.length,
          mutes: recentActions.filter(a => a.action === 'mute').length,
          bans: recentActions.filter(a => a.action === 'ban').length,
        });
      }

      // Format messages for AI
      const channelMessages = userMessages.map(msg => ({
        content: msg.content,
        authorId: msg.author.id,
        authorUsername: msg.author.username,
        timestamp: msg.createdAt,
      }));

      // Call AI analysis
      const aiResult = await analyzeChannelForPunishment(channelMessages, userHistories);

      // Create response embed
      const embed = new EmbedBuilder()
        .setTitle('🤖 AI Moderation Analysis')
        .setColor(aiResult.shouldPunish ? '#FF0000' : '#00FF00')
        .setDescription(aiResult.reasoning)
        .addFields(
          { name: 'Messages Analyzed', value: `${channelMessages.length}`, inline: true },
          { name: 'Confidence', value: `${aiResult.confidenceScore}%`, inline: true },
          { name: 'Punishment Recommended', value: aiResult.shouldPunish ? 'Yes' : 'No', inline: true }
        )
        .setTimestamp();

      if (aiResult.shouldPunish && aiResult.targetUserId && aiResult.targetUsername) {
        // Format action name for display
        const actionDisplayNames: Record<string, string> = {
          'warn': 'Warn',
          'mute': 'Mute (Permanent)',
          'timeout': 'Timeout',
          'kick': 'Kick',
          'ban': 'Ban (Permanent)',
          'temp_ban': 'Temporary Ban',
          'quarantine_temp': 'Quarantine Role (Temporary)',
          'quarantine_perm': 'Quarantine Role (Permanent)',
          'shadowban': 'Shadowban',
          'role_remove': 'Remove Role',
          'none': 'None'
        };

        const actionDisplay = actionDisplayNames[aiResult.suggestedAction] || aiResult.suggestedAction.toUpperCase();

        embed.addFields(
          { name: 'Target User', value: `@${aiResult.targetUsername}`, inline: true },
          { name: 'Suggested Action', value: actionDisplay, inline: true }
        );

        if (aiResult.suggestedDuration) {
          const hours = Math.floor(aiResult.suggestedDuration / 60);
          const minutes = aiResult.suggestedDuration % 60;
          let durationText = '';
          
          if (hours > 0 && minutes > 0) {
            durationText = `${hours}h ${minutes}m`;
          } else if (hours > 0) {
            durationText = `${hours} hours`;
          } else {
            durationText = `${minutes} minutes`;
          }
          
          embed.addFields({ name: 'Duration', value: durationText, inline: true });
        }

        if (aiResult.roleToRemove) {
          embed.addFields({ name: 'Role to Remove', value: aiResult.roleToRemove, inline: true });
        }
      }

      await interaction.editReply({ embeds: [embed] });

      // Note: Punishment is NOT auto-executed for safety
      // Moderator must manually review and take action based on AI suggestion

    } catch (error) {
      console.error('Error in aipunish command:', error);
      await interaction.editReply({ content: '❌ An error occurred while analyzing the messages. Please try again.' });
    }
  }

  // User tracking slash commands
  private async handleSeenSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user', true);
    const lastSeenDate = await storage.getUserLastSeen(targetUser.id);
    
    if (!lastSeenDate) {
      await interaction.reply({ content: `I haven't seen ${targetUser.username} yet.`, ephemeral: true });
      return;
    }

    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let timeAgo = '';
    if (diffDays > 0) {
      timeAgo = `${diffDays} day(s) ago`;
    } else if (diffHours > 0) {
      timeAgo = `${diffHours} hour(s) ago`;
    } else if (diffMins > 0) {
      timeAgo = `${diffMins} minute(s) ago`;
    } else {
      timeAgo = 'just now';
    }

    await interaction.reply({ content: `👀 **${targetUser.username}** was last seen ${timeAgo}` });
  }

  // Economy slash commands
  private async handleBalanceSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const user = await storage.getOrCreateDiscordUser(
      targetUser.id,
      targetUser.username,
      targetUser.discriminator || undefined,
      targetUser.avatar || undefined
    );
    const guildDb = await storage.getOrCreateGuildSettings(interaction.guildId!, interaction.guild?.name || '');
    const economy = await storage.getOrCreateEconomy(user.id, guildDb.id);
    
    await interaction.reply({ content: `💰 **${targetUser.username}**'s balance: ${economy.balance} coins` });
  }

  private async handleDailySlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const user = await storage.getOrCreateDiscordUser(
      interaction.user.id,
      interaction.user.username,
      interaction.user.discriminator || undefined,
      interaction.user.avatar || undefined
    );
    const guildDb = await storage.getOrCreateGuildSettings(interaction.guildId!, interaction.guild?.name || '');
    const economy = await storage.getOrCreateEconomy(user.id, guildDb.id);
    const settings = await storage.getEconomySettings(guildDb.id);
    const dailyAmount = settings?.dailyAmount || 100;

    const now = new Date();
    if (economy.lastDaily) {
      const lastDaily = new Date(economy.lastDaily);
      const diffMs = now.getTime() - lastDaily.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours < 24) {
        const hoursLeft = Math.ceil(24 - diffHours);
        await interaction.reply({ content: `⏰ You already claimed your daily reward! Come back in ${hoursLeft} hours.`, ephemeral: true });
        return;
      }
    }

    await storage.updateEconomy(user.id, guildDb.id, {
      balance: economy.balance + dailyAmount,
      lastDaily: now,
    });

    await interaction.reply({ content: `💰 You claimed your daily reward of **${dailyAmount} coins**!` });
  }

  private async handleWorkSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const jobs = [
      { name: 'Programmer', emoji: '👨‍💻', min: 50, max: 150 },
      { name: 'Chef', emoji: '👨‍🍳', min: 40, max: 120 },
      { name: 'Doctor', emoji: '👨‍⚕️', min: 80, max: 200 },
      { name: 'Artist', emoji: '👨‍🎨', min: 30, max: 100 },
      { name: 'Teacher', emoji: '👨‍🏫', min: 45, max: 110 },
      { name: 'Mechanic', emoji: '🔧', min: 35, max: 90 },
      { name: 'Musician', emoji: '🎵', min: 25, max: 80 },
      { name: 'Scientist', emoji: '🔬', min: 70, max: 180 },
    ];

    const user = await storage.getOrCreateDiscordUser(
      interaction.user.id,
      interaction.user.username,
      interaction.user.discriminator || undefined,
      interaction.user.avatar || undefined
    );
    const guildDb = await storage.getOrCreateGuildSettings(interaction.guildId!, interaction.guild?.name || '');
    const economy = await storage.getOrCreateEconomy(user.id, guildDb.id);

    const job = jobs[Math.floor(Math.random() * jobs.length)];
    const earnings = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;

    await storage.updateEconomy(user.id, guildDb.id, {
      balance: economy.balance + earnings,
    });

    await interaction.reply({ content: `${job.emoji} You worked as a **${job.name}** and earned **${earnings} coins**!` });
  }

  private async handlePaySlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);

    if (targetUser.id === interaction.user.id) {
      await interaction.reply({ content: 'You cannot pay yourself!', ephemeral: true });
      return;
    }

    const user = await storage.getOrCreateDiscordUser(
      interaction.user.id,
      interaction.user.username,
      interaction.user.discriminator || undefined,
      interaction.user.avatar || undefined
    );
    const target = await storage.getOrCreateDiscordUser(
      targetUser.id,
      targetUser.username,
      targetUser.discriminator || undefined,
      targetUser.avatar || undefined
    );
    const guildDb = await storage.getOrCreateGuildSettings(interaction.guildId!, interaction.guild?.name || '');
    const senderEconomy = await storage.getOrCreateEconomy(user.id, guildDb.id);
    const targetEconomy = await storage.getOrCreateEconomy(target.id, guildDb.id);

    if (senderEconomy.balance < amount) {
      await interaction.reply({ content: `You don't have enough coins! Your balance: ${senderEconomy.balance}`, ephemeral: true });
      return;
    }

    await storage.updateEconomy(user.id, guildDb.id, { balance: senderEconomy.balance - amount });
    await storage.updateEconomy(target.id, guildDb.id, { balance: targetEconomy.balance + amount });

    await interaction.reply({ content: `✅ Successfully paid **${amount} coins** to ${targetUser.username}!` });
  }

  private async handleShopSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildDb = await storage.getOrCreateGuildSettings(interaction.guildId!, interaction.guild?.name || '');
    const items = await storage.getItems(guildDb.id);
    const shopItems = items.filter(item => item.isShopItem);

    if (shopItems.length === 0) {
      await interaction.reply({ content: '🛒 The shop is currently empty!', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🛒 Shop')
      .setDescription('Use `/buy <item>` to purchase an item');

    shopItems.forEach(item => {
      embed.addFields({
        name: `${item.name} - ${item.price} coins`,
        value: item.description || 'No description',
        inline: true
      });
    });

    await interaction.reply({ embeds: [embed] });
  }

  private async handleBuySlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const itemName = interaction.options.getString('item', true);
    const guildDb = await storage.getOrCreateGuildSettings(interaction.guildId!, interaction.guild?.name || '');
    const items = await storage.getItems(guildDb.id);
    const item = items.find(i => i.name.toLowerCase() === itemName.toLowerCase() && i.isShopItem);

    if (!item) {
      await interaction.reply({ content: `Item "${itemName}" not found in shop!`, ephemeral: true });
      return;
    }

    const user = await storage.getOrCreateDiscordUser(
      interaction.user.id,
      interaction.user.username,
      interaction.user.discriminator || undefined,
      interaction.user.avatar || undefined
    );
    const economy = await storage.getOrCreateEconomy(user.id, guildDb.id);

    if (economy.balance < item.price) {
      await interaction.reply({ content: `❌ You don't have enough coins! Price: ${item.price}, Your balance: ${economy.balance}`, ephemeral: true });
      return;
    }

    await storage.updateEconomy(user.id, guildDb.id, { balance: economy.balance - item.price });
    await storage.addToInventory(user.id, item.id, 1);

    if (item.itemType === 'role' && item.roleId) {
      const member = interaction.member;
      if (member && 'roles' in member) {
        try {
          await member.roles.add(item.roleId);
          await interaction.reply({ content: `✅ Successfully purchased **${item.name}** and received the role!` });
        } catch (error) {
          await interaction.reply({ content: `✅ Purchased **${item.name}**, but couldn't assign the role. Contact an admin.` });
        }
      }
    } else {
      await interaction.reply({ content: `✅ Successfully purchased **${item.name}**!` });
    }
  }

  private async handleTradeSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({ 
      content: '🔄 Trading system is available! Use the dashboard to create detailed trade offers with multiple items.',
      ephemeral: true 
    });
  }

  private async handleAcceptTradeSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const tradeId = interaction.options.getInteger('trade_id', true);
    
    const user = await storage.getOrCreateDiscordUser(
      interaction.user.id,
      interaction.user.username,
      interaction.user.discriminator || undefined,
      interaction.user.avatar || undefined
    );
    const guildDb = await storage.getOrCreateGuildSettings(interaction.guildId!, interaction.guild?.name || '');
    
    const trade = await storage.getTrade(tradeId);
    if (!trade) {
      await interaction.reply({ content: '❌ Trade not found!', ephemeral: true });
      return;
    }
    
    if (trade.receiverId !== user.id) {
      await interaction.reply({ content: '❌ This trade is not for you!', ephemeral: true });
      return;
    }
    
    if (trade.status !== 'pending') {
      await interaction.reply({ content: '❌ This trade is no longer pending!', ephemeral: true });
      return;
    }
    
    const success = await storage.acceptTrade(tradeId);
    if (success) {
      await interaction.reply({ content: '✅ Trade accepted! Items have been exchanged.' });
    } else {
      await interaction.reply({ content: '❌ Trade failed! Make sure both parties have the required items.', ephemeral: true });
    }
  }

  private async handleDeclineTradeSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const tradeId = interaction.options.getInteger('trade_id', true);
    
    const user = await storage.getOrCreateDiscordUser(
      interaction.user.id,
      interaction.user.username,
      interaction.user.discriminator || undefined,
      interaction.user.avatar || undefined
    );
    
    const trade = await storage.getTrade(tradeId);
    if (!trade) {
      await interaction.reply({ content: '❌ Trade not found!', ephemeral: true });
      return;
    }
    
    if (trade.receiverId !== user.id) {
      await interaction.reply({ content: '❌ This trade is not for you!', ephemeral: true });
      return;
    }
    
    if (trade.status !== 'pending') {
      await interaction.reply({ content: '❌ This trade is no longer pending!', ephemeral: true });
      return;
    }
    
    await storage.updateTrade(tradeId, { status: 'rejected' });
    await interaction.reply({ content: '❌ Trade declined.' });
  }

  private async handleTradesSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const user = await storage.getOrCreateDiscordUser(
      interaction.user.id,
      interaction.user.username,
      interaction.user.discriminator || undefined,
      interaction.user.avatar || undefined
    );
    const guildDb = await storage.getOrCreateGuildSettings(interaction.guildId!, interaction.guild?.name || '');
    
    const trades = await storage.getPendingTradesForUser(user.id, guildDb.id);
    
    if (trades.length === 0) {
      await interaction.reply({ content: 'You have no pending trade offers.', ephemeral: true });
      return;
    }
    
    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('📦 Your Pending Trades')
      .setDescription('Use `/accept <trade_id>` or `/decline <trade_id>` to respond');
    
    for (const trade of trades) {
      embed.addFields({
        name: `Trade ID: ${trade.id}`,
        value: `From: <@${(await storage.getDiscordUser(String(trade.senderId)))?.discordId}>`,
        inline: false
      });
    }
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async handleCommand(message: Message) {
    if (!message.guild) return;

    const guildSettings = await storage.getOrCreateGuildSettings(message.guild.id, message.guild.name);
    const prefix = guildSettings.prefix;

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    try {
      // Economy Commands
      if (commandName === 'balance' || commandName === 'bal') {
        await this.balanceCommand(message);
      } else if (commandName === 'daily') {
        await this.dailyCommand(message);
      } else if (commandName === 'work') {
        await this.workCommand(message);
      } else if (commandName === 'pay') {
        await this.payCommand(message, args);
      } else if (commandName === 'leaderboard' || commandName === 'lb') {
        await this.leaderboardCommand(message);
      }
      // Shop & Items
      else if (commandName === 'shop') {
        await this.shopCommand(message);
      } else if (commandName === 'buy') {
        await this.buyCommand(message, args);
      } else if (commandName === 'inventory' || commandName === 'inv') {
        await this.inventoryCommand(message);
      } else if (commandName === 'use') {
        await this.useCommand(message, args);
      }
      // Mystery Boxes
      else if (commandName === 'open') {
        await this.openBoxCommand(message, args);
      }
      // Crafting
      else if (commandName === 'craft') {
        await this.craftCommand(message, args);
      } else if (commandName === 'recipes') {
        await this.recipesCommand(message);
      }
      // Moderation
      else if (commandName === 'warn') {
        await this.warnCommand(message, args);
      } else if (commandName === 'warnings') {
        await this.warningsCommand(message, args);
      } else if (commandName === 'mute') {
        await this.muteCommand(message, args);
      } else if (commandName === 'kick') {
        await this.kickCommand(message, args);
      } else if (commandName === 'ban') {
        await this.banCommand(message, args);
      }
      // User Tracking
      else if (commandName === 'seen') {
        await this.seenCommand(message, args);
      }
      // Custom Commands
      else {
        await this.customCommand(message, commandName);
      }
    } catch (error) {
      console.error(`Error executing command ${commandName}:`, error);
      await message.reply('An error occurred while executing the command.');
    }
  }

  // Economy Commands
  private async balanceCommand(message: Message) {
    const user = await storage.getOrCreateDiscordUser(
      message.author.id,
      message.author.username,
      message.author.discriminator || undefined,
      message.author.avatar || undefined
    );
    const guildDb = await storage.getOrCreateGuildSettings(message.guild!.id, message.guild!.name);
    const economy = await storage.getOrCreateEconomy(user.id, guildDb.id);

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`${message.author.username}'s Balance`)
      .addFields(
        { name: 'Wallet', value: `💰 ${economy.balance} coins`, inline: true },
        { name: 'Bank', value: `🏦 ${economy.bank} coins`, inline: true },
        { name: 'Total', value: `💎 ${economy.balance + economy.bank} coins`, inline: true }
      )
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  private async dailyCommand(message: Message) {
    const user = await storage.getOrCreateDiscordUser(
      message.author.id,
      message.author.username,
      message.author.discriminator || undefined,
      message.author.avatar || undefined
    );
    const guildDb = await storage.getOrCreateGuildSettings(message.guild!.id, message.guild!.name);
    const economy = await storage.getOrCreateEconomy(user.id, guildDb.id);
    const settings = await storage.getEconomySettings(guildDb.id);
    const dailyAmount = settings?.dailyAmount || 100;

    const now = new Date();
    if (economy.lastDaily) {
      const lastDaily = new Date(economy.lastDaily);
      const diff = now.getTime() - lastDaily.getTime();
      const hours = diff / (1000 * 60 * 60);
      
      if (hours < 24) {
        const hoursLeft = Math.ceil(24 - hours);
        await message.reply(`⏰ You already claimed your daily reward! Come back in ${hoursLeft} hours.`);
        return;
      }
    }

    await storage.updateEconomy(user.id, guildDb.id, {
      balance: economy.balance + dailyAmount,
      lastDaily: now,
    });

    await message.reply(`💰 You claimed your daily reward of **${dailyAmount} coins**!`);
  }

  private async workCommand(message: Message) {
    const jobs = [
      { name: 'Programmer', emoji: '👨‍💻', min: 50, max: 150 },
      { name: 'Chef', emoji: '👨‍🍳', min: 40, max: 120 },
      { name: 'Doctor', emoji: '👨‍⚕️', min: 80, max: 200 },
      { name: 'Artist', emoji: '👨‍🎨', min: 30, max: 100 },
      { name: 'Teacher', emoji: '👨‍🏫', min: 45, max: 110 },
      { name: 'Mechanic', emoji: '🔧', min: 35, max: 90 },
      { name: 'Musician', emoji: '🎵', min: 25, max: 80 },
      { name: 'Scientist', emoji: '🔬', min: 70, max: 180 },
    ];

    const user = await storage.getOrCreateDiscordUser(
      message.author.id,
      message.author.username,
      message.author.discriminator || undefined,
      message.author.avatar || undefined
    );
    const guildDb = await storage.getOrCreateGuildSettings(message.guild!.id, message.guild!.name);
    const economy = await storage.getOrCreateEconomy(user.id, guildDb.id);

    // Random job selection
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    const earnings = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;

    await storage.updateEconomy(user.id, guildDb.id, {
      balance: economy.balance + earnings,
    });

    await message.reply(`${job.emoji} You worked as a **${job.name}** and earned **${earnings} coins**!`);
  }

  private async payCommand(message: Message, args: string[]) {
    if (args.length < 2) {
      await message.reply('Usage: `!pay @user amount`');
      return;
    }

    const targetUser = message.mentions.users.first();
    if (!targetUser) {
      await message.reply('Please mention a user to pay.');
      return;
    }

    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0) {
      await message.reply('Please provide a valid amount.');
      return;
    }

    const user = await storage.getOrCreateDiscordUser(
      message.author.id,
      message.author.username,
      message.author.discriminator || undefined,
      message.author.avatar || undefined
    );
    const target = await storage.getOrCreateDiscordUser(
      targetUser.id,
      targetUser.username,
      targetUser.discriminator || undefined,
      targetUser.avatar || undefined
    );
    const guildDb = await storage.getOrCreateGuildSettings(message.guild!.id, message.guild!.name);
    const senderEconomy = await storage.getOrCreateEconomy(user.id, guildDb.id);
    const targetEconomy = await storage.getOrCreateEconomy(target.id, guildDb.id);

    if (senderEconomy.balance < amount) {
      await message.reply(`You don't have enough coins! Your balance: ${senderEconomy.balance}`);
      return;
    }

    await storage.updateEconomy(user.id, guildDb.id, { balance: senderEconomy.balance - amount });
    await storage.updateEconomy(target.id, guildDb.id, { balance: targetEconomy.balance + amount });

    await message.reply(`✅ Successfully paid **${amount} coins** to ${targetUser.username}!`);
  }

  private async leaderboardCommand(message: Message) {
    await message.reply('📊 Leaderboard feature coming soon via dashboard!');
  }

  // Shop & Items
  private async shopCommand(message: Message) {
    const guildDb = await storage.getOrCreateGuildSettings(message.guild!.id, message.guild!.name);
    const items = await storage.getItems(guildDb.id);
    const shopItems = items.filter(item => item.isShopItem);

    if (shopItems.length === 0) {
      await message.reply('🛒 The shop is currently empty!');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🛒 Shop')
      .setDescription('Use `!buy <item_name>` to purchase an item');

    shopItems.forEach(item => {
      embed.addFields({
        name: `${item.emoji || '📦'} ${item.name}`,
        value: `${item.description}\nPrice: **${item.price} coins**`,
        inline: false
      });
    });

    await message.reply({ embeds: [embed] });
  }

  private async buyCommand(message: Message, args: string[]) {
    if (args.length === 0) {
      await message.reply('Usage: `!buy <item_name>`');
      return;
    }

    const itemName = args.join(' ').toLowerCase();
    const guildDb = await storage.getOrCreateGuildSettings(message.guild!.id, message.guild!.name);
    const items = await storage.getItems(guildDb.id);
    const item = items.find(i => i.name.toLowerCase() === itemName && i.isShopItem);

    if (!item) {
      await message.reply('❌ Item not found in the shop!');
      return;
    }

    const user = await storage.getOrCreateDiscordUser(
      message.author.id,
      message.author.username,
      message.author.discriminator || undefined,
      message.author.avatar || undefined
    );
    const economy = await storage.getOrCreateEconomy(user.id, guildDb.id);

    if (economy.balance < item.price) {
      await message.reply(`❌ You don't have enough coins! Price: ${item.price}, Your balance: ${economy.balance}`);
      return;
    }

    await storage.updateEconomy(user.id, guildDb.id, { balance: economy.balance - item.price });
    await storage.addToInventory(user.id, item.id, 1);

    // Handle role items
    if (item.itemType === 'role' && item.roleId) {
      const member = message.member;
      if (member) {
        try {
          await member.roles.add(item.roleId);
          await message.reply(`✅ Successfully purchased **${item.name}** and received the role!`);
        } catch (error) {
          await message.reply(`✅ Purchased **${item.name}**, but couldn't assign the role. Contact an admin.`);
        }
      }
    } else {
      await message.reply(`✅ Successfully purchased **${item.name}**!`);
    }
  }

  private async inventoryCommand(message: Message) {
    const user = await storage.getOrCreateDiscordUser(
      message.author.id,
      message.author.username,
      message.author.discriminator || undefined,
      message.author.avatar || undefined
    );
    const inventory = await storage.getInventory(user.id);

    if (inventory.length === 0) {
      await message.reply('🎒 Your inventory is empty!');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle(`${message.author.username}'s Inventory`);

    for (const inv of inventory) {
      const item = await storage.getItem(inv.itemId);
      if (item) {
        embed.addFields({
          name: `${item.emoji || '📦'} ${item.name}`,
          value: `Quantity: **${inv.quantity}**`,
          inline: true
        });
      }
    }

    await message.reply({ embeds: [embed] });
  }

  private async useCommand(message: Message, args: string[]) {
    if (args.length === 0) {
      await message.reply('Usage: `!use <item_name>`');
      return;
    }

    const itemName = args.join(' ').toLowerCase();
    const user = await storage.getOrCreateDiscordUser(
      message.author.id,
      message.author.username,
      message.author.discriminator || undefined,
      message.author.avatar || undefined
    );
    const guildDb = await storage.getOrCreateGuildSettings(message.guild!.id, message.guild!.name);
    const items = await storage.getItems(guildDb.id);
    const item = items.find(i => i.name.toLowerCase() === itemName);

    if (!item) {
      await message.reply('❌ Item not found!');
      return;
    }

    const success = await storage.removeFromInventory(user.id, item.id, 1);
    if (!success) {
      await message.reply('❌ You don\'t have this item in your inventory!');
      return;
    }

    await message.reply(`✨ You used **${item.name}**!`);
  }

  // Mystery Boxes
  private async openBoxCommand(message: Message, args: string[]) {
    if (args.length === 0) {
      await message.reply('Usage: `!open <box_name>`');
      return;
    }

    const boxName = args.join(' ').toLowerCase();
    const guildDb = await storage.getOrCreateGuildSettings(message.guild!.id, message.guild!.name);
    const boxes = await storage.getMysteryBoxes(guildDb.id);
    const box = boxes.find(b => b.name.toLowerCase() === boxName);

    if (!box) {
      await message.reply('❌ Mystery box not found!');
      return;
    }

    const user = await storage.getOrCreateDiscordUser(
      message.author.id,
      message.author.username,
      message.author.discriminator || undefined,
      message.author.avatar || undefined
    );
    const economy = await storage.getOrCreateEconomy(user.id, guildDb.id);

    if (economy.balance < box.price) {
      await message.reply(`❌ You need ${box.price} coins to open this box!`);
      return;
    }

    const rewards = await storage.getMysteryBoxRewards(box.id);
    if (rewards.length === 0) {
      await message.reply('❌ This box has no rewards configured!');
      return;
    }

    // Weighted random selection
    const totalWeight = rewards.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedReward = rewards[0];

    for (const reward of rewards) {
      random -= reward.weight;
      if (random <= 0) {
        selectedReward = reward;
        break;
      }
    }

    await storage.updateEconomy(user.id, guildDb.id, { balance: economy.balance - box.price });

    if (selectedReward.rewardType === 'item' && selectedReward.itemId) {
      await storage.addToInventory(user.id, selectedReward.itemId, selectedReward.quantity);
      const item = await storage.getItem(selectedReward.itemId);
      await message.reply(`🎁 You opened **${box.name}** and received **${selectedReward.quantity}x ${item?.name}** (${selectedReward.rarity})!`);
    } else if (selectedReward.rewardType === 'coins' && selectedReward.coinAmount) {
      await storage.updateEconomy(user.id, guildDb.id, { balance: economy.balance - box.price + selectedReward.coinAmount });
      await message.reply(`🎁 You opened **${box.name}** and received **${selectedReward.coinAmount} coins** (${selectedReward.rarity})!`);
    }
  }

  // Crafting
  private async craftCommand(message: Message, args: string[]) {
    await message.reply('🔨 Crafting system available via dashboard!');
  }

  private async recipesCommand(message: Message) {
    await message.reply('📜 View recipes via dashboard!');
  }

  // Moderation
  private async warnCommand(message: Message, args: string[]) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      await message.reply('❌ You need the Moderate Members permission to use this command.');
      return;
    }

    const target = message.mentions.users.first();
    if (!target) {
      await message.reply('Usage: `!warn @user reason`');
      return;
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';
    const targetUser = await storage.getOrCreateDiscordUser(target.id, target.username, target.discriminator || undefined, target.avatar || undefined);
    const mod = await storage.getOrCreateDiscordUser(message.author.id, message.author.username, message.author.discriminator || undefined, message.author.avatar || undefined);
    const guildDb = await storage.getOrCreateGuildSettings(message.guild!.id, message.guild!.name);

    await storage.createWarning({
      guildId: guildDb.id,
      userId: targetUser.id,
      moderatorId: mod.id,
      reason,
    });

    await message.reply(`⚠️ Warned ${target.username} for: ${reason}`);
  }

  private async warningsCommand(message: Message, args: string[]) {
    const target = message.mentions.users.first() || message.author;
    const targetUser = await storage.getOrCreateDiscordUser(target.id, target.username, target.discriminator || undefined, target.avatar || undefined);
    const guildDb = await storage.getOrCreateGuildSettings(message.guild!.id, message.guild!.name);
    const warnings = await storage.getWarnings(targetUser.id, guildDb.id);

    if (warnings.length === 0) {
      await message.reply(`${target.username} has no warnings!`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle(`Warnings for ${target.username}`)
      .setDescription(`Total warnings: ${warnings.length}`);

    warnings.slice(0, 5).forEach((warn, i) => {
      embed.addFields({
        name: `Warning #${i + 1}`,
        value: warn.reason,
        inline: false
      });
    });

    await message.reply({ embeds: [embed] });
  }

  private async muteCommand(message: Message, args: string[]) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      await message.reply('❌ You need the Moderate Members permission to use this command.');
      return;
    }

    const target = message.mentions.members?.first();
    if (!target) {
      await message.reply('Usage: `!mute @user duration(minutes) reason`');
      return;
    }

    const duration = parseInt(args[1]) || 60;
    const reason = args.slice(2).join(' ') || 'No reason provided';

    try {
      await target.timeout(duration * 60 * 1000, reason);
      await message.reply(`🔇 Muted ${target.user.username} for ${duration} minutes.`);
    } catch (error) {
      await message.reply('❌ Failed to mute the user.');
    }
  }

  private async kickCommand(message: Message, args: string[]) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      await message.reply('❌ You need the Kick Members permission to use this command.');
      return;
    }

    const target = message.mentions.members?.first();
    if (!target) {
      await message.reply('Usage: `!kick @user reason`');
      return;
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    try {
      await target.kick(reason);
      await message.reply(`👢 Kicked ${target.user.username}.`);
    } catch (error) {
      await message.reply('❌ Failed to kick the user.');
    }
  }

  private async banCommand(message: Message, args: string[]) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      await message.reply('❌ You need the Ban Members permission to use this command.');
      return;
    }

    const target = message.mentions.members?.first();
    if (!target) {
      await message.reply('Usage: `!ban @user reason`');
      return;
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    try {
      await target.ban({ reason });
      await message.reply(`🔨 Banned ${target.user.username}.`);
    } catch (error) {
      await message.reply('❌ Failed to ban the user.');
    }
  }

  // User Tracking
  private async seenCommand(message: Message, args: string[]) {
    const target = message.mentions.users?.first();
    if (!target) {
      await message.reply('Usage: `!seen @user`');
      return;
    }

    try {
      const user = await storage.getDiscordUser(target.id);
      
      if (!user || !user.lastSeen) {
        await message.reply(`❌ I haven't seen ${target.username} yet.`);
        return;
      }

      const lastSeenDate = new Date(user.lastSeen);
      const now = new Date();
      const diffMs = now.getTime() - lastSeenDate.getTime();
      
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      let timeAgo = '';
      if (diffDays > 0) {
        timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else if (diffHours > 0) {
        timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else if (diffMinutes > 0) {
        timeAgo = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
      } else {
        timeAgo = 'just now';
      }

      const embed = new EmbedBuilder()
        .setColor('#00FFFF')
        .setTitle(`👁️ Last Seen: ${target.username}`)
        .setDescription(`${target.username} was last seen **${timeAgo}**`)
        .addFields(
          { name: 'Exact Time', value: lastSeenDate.toLocaleString(), inline: false }
        )
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in seen command:', error);
      await message.reply('❌ Failed to retrieve user information.');
    }
  }

  // Custom Commands
  private async customCommand(message: Message, commandName: string) {
    const guildDb = await storage.getOrCreateGuildSettings(message.guild!.id, message.guild!.name);
    const commands = await storage.getCustomCommands(guildDb.id);
    const command = commands.find(c => c.trigger.toLowerCase() === commandName && !c.isSlashCommand);

    if (!command) return;

    // Parse template variables
    const response = this.parseTemplateVariables(command.response, message);
    const title = command.embedTitle ? this.parseTemplateVariables(command.embedTitle, message) : undefined;

    if (command.embedEnabled) {
      const embed = new EmbedBuilder()
        .setDescription(response);
      
      if (command.embedColor) embed.setColor(command.embedColor as any);
      if (title) embed.setTitle(title);

      await message.reply({ embeds: [embed] });
    } else {
      await message.reply(response);
    }
  }

  private parseTemplateVariables(template: string, message: Message): string {
    let result = template;
    
    // Replace user variables
    result = result.replace(/\{user\}/g, `<@${message.author.id}>`);
    result = result.replace(/\{user\.id\}/g, message.author.id);
    result = result.replace(/\{user\.username\}/g, message.author.username);
    result = result.replace(/\{user\.tag\}/g, message.author.tag);
    
    // Replace server variables
    result = result.replace(/\{server\}/g, message.guild?.name || 'Unknown Server');
    result = result.replace(/\{server\.id\}/g, message.guild?.id || '');
    result = result.replace(/\{server\.members\}/g, message.guild?.memberCount?.toString() || '0');
    
    // Replace channel variables
    result = result.replace(/\{channel\}/g, (message.channel as TextChannel).name || 'Unknown Channel');
    result = result.replace(/\{channel\.id\}/g, message.channel.id);
    
    // Replace bot ping
    const ping = this.client.ws.ping;
    result = result.replace(/\{ping\}/g, ping.toString());
    
    return result;
  }

  // Modmail
  private async handleModmail(message: Message) {
    if (message.channel.type !== ChannelType.DM) return;

    // User is DMing the bot - create/update modmail ticket
    await message.reply('📬 Modmail feature available! Contact server staff via dashboard.');
  }

  // Auto-Moderation
  private async handleAutoMod(message: Message) {
    if (!message.guild) return;
    // Auto-mod logic (anti-spam, bad words, etc.) would go here
  }

  // Welcome System
  private async handleWelcome(member: GuildMember) {
    try {
      const guildSettings = await storage.getOrCreateGuildSettings(member.guild.id, member.guild.name);
      const welcomeSettings = await storage.getWelcomeSettings(guildSettings.id);

      if (!welcomeSettings?.enabled || !welcomeSettings.welcomeChannelId) return;

      const channel = member.guild.channels.cache.get(welcomeSettings.welcomeChannelId) as TextChannel;
      if (!channel) return;

      // Parse welcome message with template variables
      let message = welcomeSettings.welcomeMessage || "Welcome {user} to {server}!";
      message = message.replace(/\{user\}/g, `<@${member.id}>`);
      message = message.replace(/\{user\.tag\}/g, member.user.tag);
      message = message.replace(/\{user\.username\}/g, member.user.username);
      message = message.replace(/\{server\}/g, member.guild.name);
      message = message.replace(/\{server\.members\}/g, member.guild.memberCount.toString());

      if (welcomeSettings.welcomeEmbedEnabled) {
        const colorCode = welcomeSettings.welcomeEmbedColor || '#5865F2';
        const embed = new EmbedBuilder()
          .setColor(colorCode as `#${string}`)
          .setTitle(welcomeSettings.welcomeEmbedTitle || `Welcome to ${member.guild.name}!`)
          .setDescription(welcomeSettings.welcomeEmbedDescription || message)
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
      } else {
        await channel.send(message);
      }

      // Auto-role assignment
      if (welcomeSettings.autoRoleEnabled && welcomeSettings.autoRoleIds && welcomeSettings.autoRoleIds.length > 0) {
        for (const roleId of welcomeSettings.autoRoleIds) {
          try {
            const role = member.guild.roles.cache.get(roleId);
            if (role) {
              await member.roles.add(role);
            }
          } catch (error) {
            console.error(`Failed to assign role ${roleId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error in handleWelcome:', error);
    }
  }

  private async handleGoodbye(member: GuildMember) {
    try {
      const guildSettings = await storage.getOrCreateGuildSettings(member.guild.id, member.guild.name);
      const welcomeSettings = await storage.getWelcomeSettings(guildSettings.id);

      if (!welcomeSettings?.leaveEnabled || !welcomeSettings.leaveChannelId) return;

      const channel = member.guild.channels.cache.get(welcomeSettings.leaveChannelId) as TextChannel;
      if (!channel) return;

      // Parse leave message with template variables
      let message = welcomeSettings.leaveMessage || "{user} has left {server}.";
      message = message.replace(/\{user\}/g, member.user.tag);
      message = message.replace(/\{user\.tag\}/g, member.user.tag);
      message = message.replace(/\{user\.username\}/g, member.user.username);
      message = message.replace(/\{server\}/g, member.guild.name);
      message = message.replace(/\{server\.members\}/g, member.guild.memberCount.toString());

      await channel.send(message);
    } catch (error) {
      console.error('Error in handleGoodbye:', error);
    }
  }

  // Reaction Roles
  private async handleReactionRoleAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;

    try {
      if (reaction.partial) {
        await reaction.fetch();
      }

      const message = reaction.message;
      if (!message.guild) return;

      const reactionRoles = await storage.getReactionRolesByMessage(message.id);
      const emoji = reaction.emoji.id || reaction.emoji.name;
      
      const matchingRole = reactionRoles.find(rr => rr.emoji === emoji);
      if (!matchingRole) return;

      const member = await message.guild.members.fetch(user.id);
      const role = message.guild.roles.cache.get(matchingRole.roleId);

      if (role && member) {
        await member.roles.add(role);
        console.log(`Added role ${role.name} to ${member.user.tag}`);
      }
    } catch (error) {
      console.error('Error in handleReactionRoleAdd:', error);
    }
  }

  private async handleReactionRoleRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;

    try {
      if (reaction.partial) {
        await reaction.fetch();
      }

      const message = reaction.message;
      if (!message.guild) return;

      const reactionRoles = await storage.getReactionRolesByMessage(message.id);
      const emoji = reaction.emoji.id || reaction.emoji.name;
      
      const matchingRole = reactionRoles.find(rr => rr.emoji === emoji);
      if (!matchingRole) return;

      const member = await message.guild.members.fetch(user.id);
      const role = message.guild.roles.cache.get(matchingRole.roleId);

      if (role && member) {
        await member.roles.remove(role);
        console.log(`Removed role ${role.name} from ${member.user.tag}`);
      }
    } catch (error) {
      console.error('Error in handleReactionRoleRemove:', error);
    }
  }

  // Security
  private async handleSecurity(member: GuildMember) {
    // Anti-raid logic would go here
  }

  // Utility Methods for API Routes
  public async addReactionRole(channelId: string, messageId: string, emoji: string) {
    try {
      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      if (!channel) return;

      const message = await channel.messages.fetch(messageId);
      if (!message) return;

      await message.react(emoji);
    } catch (error) {
      console.error('Error adding reaction:', error);
      throw error;
    }
  }

  public async sendEmbed(channelId: string, embedData: any) {
    try {
      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      if (!channel) throw new Error('Channel not found');

      const embed = new EmbedBuilder(embedData);
      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error sending embed:', error);
      throw error;
    }
  }

  public async getGuildStats(guildId: string) {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      if (!guild) throw new Error('Guild not found');

      // Fetch all members to get accurate counts
      await guild.members.fetch();

      const totalMembers = guild.memberCount;
      const onlineMembers = guild.members.cache.filter(m => m.presence?.status !== 'offline').size;
      const botMembers = guild.members.cache.filter(m => m.user.bot).size;
      const humanMembers = totalMembers - botMembers;

      // Channel counts
      const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
      const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
      const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;

      // Role count
      const roles = guild.roles.cache.size;

      // Emoj count
      const emojis = guild.emojis.cache.size;

      return {
        guildId: guild.id,
        guildName: guild.name,
        guildIcon: guild.iconURL(),
        totalMembers,
        humanMembers,
        botMembers,
        onlineMembers,
        textChannels,
        voiceChannels,
        categories,
        roles,
        emojis,
        createdAt: guild.createdAt,
        ownerId: guild.ownerId,
        boostLevel: guild.premiumTier,
        boostCount: guild.premiumSubscriptionCount || 0,
      };
    } catch (error) {
      console.error('Error getting guild stats:', error);
      throw error;
    }
  }

  // Giveaway Command Handlers
  private async handleGiveawaySlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) return;

    const subcommand = interaction.options.getSubcommand();
    const guildSettings = await storage.getOrCreateGuildSettings(interaction.guildId, "");
    const host = await storage.getOrCreateDiscordUser(interaction.user.id, interaction.user.username);

    if (subcommand === 'create') {
      const prize = interaction.options.getString('prize', true);
      const duration = interaction.options.getInteger('duration', true);
      const winners = interaction.options.getInteger('winners') || 1;
      const channel = interaction.options.getChannel('channel') as TextChannel || interaction.channel as TextChannel;

      // Parse role modifiers
      const roleOverrides: Array<{ roleId: string; roleName: string; multiplier: number }> = [];
      for (let i = 1; i <= 5; i++) {
        const role = interaction.options.getRole(`modifier_${i}_role`);
        const multiplier = interaction.options.getNumber(`modifier_${i}_multiplier`);
        
        // Only add if both role and multiplier are provided
        if (role && multiplier !== null) {
          // Round to 2 decimal places
          const roundedMultiplier = Math.round(multiplier * 100) / 100;
          roleOverrides.push({
            roleId: role.id,
            roleName: role.name,
            multiplier: roundedMultiplier
          });
        }
      }

      await this.createGiveaway(interaction, guildSettings.id, host.id, prize, duration, winners, channel, roleOverrides);
    } else if (subcommand === 'template') {
      const templateName = interaction.options.getString('name', true);
      const channel = interaction.options.getChannel('channel') as TextChannel || interaction.channel as TextChannel;

      const template = await storage.getGiveawayTemplateByName(guildSettings.id, templateName);
      if (!template) {
        await interaction.reply({ content: `Template "${templateName}" not found.`, ephemeral: true });
        return;
      }

      await this.createGiveaway(interaction, guildSettings.id, host.id, template.prize, template.duration, template.winnerCount, channel, []);
    }
  }

  private async createGiveaway(
    interaction: ChatInputCommandInteraction, 
    guildId: number, 
    hostId: number, 
    prize: string, 
    duration: number, 
    winnerCount: number, 
    channel: TextChannel,
    roleOverrides: Array<{ roleId: string; roleName: string; multiplier: number }> = []
  ): Promise<void> {
    const endTime = new Date(Date.now() + duration * 60 * 1000);

    // Build embed description with role modifiers info if present
    let description = `**Prize:** ${prize}\n\n**Winners:** ${winnerCount}\n**Ends:** <t:${Math.floor(endTime.getTime() / 1000)}:R>\n\nReact with 🎉 to enter!`;
    
    if (roleOverrides.length > 0) {
      description += '\n\n**Entry Modifiers:**';
      roleOverrides.forEach(mod => {
        const emoji = mod.multiplier > 1 ? '⬆️' : mod.multiplier < 1 ? '⬇️' : '➡️';
        description += `\n${emoji} <@&${mod.roleId}>: ${mod.multiplier}x entries`;
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎉 GIVEAWAY 🎉')
      .setDescription(description)
      .setColor('#FF00FF')
      .setFooter({ text: `Hosted by ${interaction.user.username}` })
      .setTimestamp(endTime);

    const message = await channel.send({ embeds: [embed] });
    await message.react('🎉');

    const giveaway = await storage.createGiveaway({
      guildId,
      channelId: channel.id,
      messageId: message.id,
      prize,
      winnerCount,
      duration,
      endTime,
      ended: false,
      hostId,
      roleOverrides: roleOverrides.length > 0 ? roleOverrides : [],
    });

    await interaction.reply({ content: `Giveaway created! ID: ${giveaway.id}`, ephemeral: true });

    // Schedule automatic end
    setTimeout(async () => {
      await this.endGiveaway(giveaway.id);
    }, duration * 60 * 1000);
  }

  private async handleRerollSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) return;

    const giveawayId = interaction.options.getInteger('giveaway_id', true);
    const giveaway = await storage.getGiveaway(giveawayId);

    if (!giveaway) {
      await interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
      return;
    }

    if (!giveaway.ended) {
      await interaction.reply({ content: 'This giveaway has not ended yet.', ephemeral: true });
      return;
    }

    await this.selectAndAnnounceWinners(giveaway, true);
    await interaction.reply({ content: 'Winners rerolled!', ephemeral: true });
  }

  private async handleEndGiveawaySlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) return;

    const giveawayId = interaction.options.getInteger('giveaway_id', true);
    const giveaway = await storage.getGiveaway(giveawayId);

    if (!giveaway) {
      await interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
      return;
    }

    if (giveaway.ended) {
      await interaction.reply({ content: 'This giveaway has already ended.', ephemeral: true });
      return;
    }

    await this.endGiveaway(giveawayId);
    await interaction.reply({ content: 'Giveaway ended!', ephemeral: true });
  }

  private async endGiveaway(giveawayId: number): Promise<void> {
    const giveaway = await storage.getGiveaway(giveawayId);
    if (!giveaway || giveaway.ended) return;

    await this.selectAndAnnounceWinners(giveaway, false);
  }

  private async selectAndAnnounceWinners(giveaway: any, isReroll: boolean): Promise<void> {
    try {
      if (!giveaway.messageId || !giveaway.channelId) return;

      const channel = await this.client.channels.fetch(giveaway.channelId) as TextChannel;
      if (!channel) return;

      const message = await channel.messages.fetch(giveaway.messageId);
      if (!message) return;

      const reaction = message.reactions.cache.get('🎉');
      if (!reaction) {
        await channel.send('No one entered the giveaway!');
        await storage.endGiveaway(giveaway.id, []);
        return;
      }

      const users = await reaction.users.fetch();
      const participants = users.filter(u => !u.bot);

      if (participants.size === 0) {
        await channel.send('No one entered the giveaway!');
        await storage.endGiveaway(giveaway.id, []);
        return;
      }

      const guildSettings = await storage.getGuildSettingsById(giveaway.guildId);
      if (!guildSettings) return;

      const guild = await this.client.guilds.fetch(guildSettings.guildId);
      const guildRoleModifiers = await storage.getGiveawayRoleModifiers(giveaway.guildId);
      
      // Merge per-giveaway overrides with guild-wide modifiers
      // Per-giveaway overrides take precedence over guild defaults
      const roleModifierMap = new Map<string, number>();
      
      // First add guild-wide modifiers
      for (const modifier of guildRoleModifiers) {
        roleModifierMap.set(modifier.roleId, modifier.multiplier);
      }
      
      // Then apply per-giveaway overrides (they win on duplicates)
      if (giveaway.roleOverrides && Array.isArray(giveaway.roleOverrides)) {
        for (const override of giveaway.roleOverrides) {
          roleModifierMap.set(override.roleId, override.multiplier);
        }
      }

      const weightedParticipants: { userId: string; weight: number }[] = [];

      for (const [userId, user] of participants) {
        try {
          const member = await guild.members.fetch(userId);
          let weight = 1.0;

          // Apply modifiers from the merged map
          for (const [roleId, multiplier] of roleModifierMap) {
            if (member.roles.cache.has(roleId)) {
              weight *= multiplier;
            }
          }

          weightedParticipants.push({ userId, weight });
        } catch (error) {
          console.error(`Error fetching member ${userId}:`, error);
        }
      }

      const winners: string[] = [];
      const winnerCount = Math.min(giveaway.winnerCount, weightedParticipants.length);

      for (let i = 0; i < winnerCount; i++) {
        const totalWeight = weightedParticipants.reduce((sum, p) => sum + p.weight, 0);
        let random = Math.random() * totalWeight;

        for (let j = 0; j < weightedParticipants.length; j++) {
          random -= weightedParticipants[j].weight;
          if (random <= 0) {
            winners.push(weightedParticipants[j].userId);
            weightedParticipants.splice(j, 1);
            break;
          }
        }
      }

      await storage.endGiveaway(giveaway.id, winners);

      const winnerMentions = winners.map(w => `<@${w}>`).join(', ');
      const embed = new EmbedBuilder()
        .setTitle('🎉 GIVEAWAY ENDED 🎉')
        .setDescription(`**Prize:** ${giveaway.prize}\n\n**${isReroll ? 'New Winners' : 'Winners'}:** ${winnerMentions}`)
        .setColor('#00FF00')
        .setTimestamp();

      await message.edit({ embeds: [embed] });
      await channel.send(`Congratulations ${winnerMentions}! You won **${giveaway.prize}**!`);
    } catch (error) {
      console.error('Error selecting winners:', error);
    }
  }

  async start(token: string) {
    await this.client.login(token);
  }

  getClient() {
    return this.client;
  }

  isClientReady() {
    return this.isReady;
  }
}

export let bot: DiscordBot | null = null;

export function initBot(token: string) {
  if (!bot) {
    bot = new DiscordBot();
    bot.start(token);
  }
  return bot;
}
