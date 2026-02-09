import { APIGuildMember } from '../types';
import { User } from './User';
import { Guild } from './Guild';
import type { Client } from '../Client';

/**
 * Permission flags - permission bits
 */
export const PermissionFlags = {
  CreateInstantInvite: 1n << 0n,
  KickMembers: 1n << 1n,
  BanMembers: 1n << 2n,
  Administrator: 1n << 3n,
  ManageChannels: 1n << 4n,
  ManageGuild: 1n << 5n,
  AddReactions: 1n << 6n,
  ViewAuditLog: 1n << 7n,
  PrioritySpeaker: 1n << 8n,
  Stream: 1n << 9n,
  ViewChannel: 1n << 10n,
  SendMessages: 1n << 11n,
  SendTTSMessages: 1n << 12n,
  ManageMessages: 1n << 13n,
  EmbedLinks: 1n << 14n,
  AttachFiles: 1n << 15n,
  ReadMessageHistory: 1n << 16n,
  MentionEveryone: 1n << 17n,
  UseExternalEmojis: 1n << 18n,
  ViewGuildInsights: 1n << 19n,
  Connect: 1n << 20n,
  Speak: 1n << 21n,
  MuteMembers: 1n << 22n,
  DeafenMembers: 1n << 23n,
  MoveMembers: 1n << 24n,
  UseVAD: 1n << 25n,
  ChangeNickname: 1n << 26n,
  ManageNicknames: 1n << 27n,
  ManageRoles: 1n << 28n,
  ManageWebhooks: 1n << 29n,
  ManageEmojisAndStickers: 1n << 30n,
  UseApplicationCommands: 1n << 31n,
  RequestToSpeak: 1n << 32n,
  ManageEvents: 1n << 33n,
  ManageThreads: 1n << 34n,
  CreatePublicThreads: 1n << 35n,
  CreatePrivateThreads: 1n << 36n,
  UseExternalStickers: 1n << 37n,
  SendMessagesInThreads: 1n << 38n,
  UseEmbeddedActivities: 1n << 39n,
  ModerateMembers: 1n << 40n,
} as const;

/**
 * Permissions helper class
 */
export class Permissions {
  private bitfield: bigint;
  private isOwner: boolean;

  constructor(bits: string | bigint | number = 0n, isOwner = false) {
    if (typeof bits === 'string') {
      this.bitfield = BigInt(bits);
    } else {
      this.bitfield = BigInt(bits);
    }
    this.isOwner = isOwner;
  }

  /**
   * Check if has a permission
   */
  has(permission: string | bigint): boolean {
    // Owner has all permissions
    if (this.isOwner) return true;
    
    // Administrator has all permissions
    if ((this.bitfield & PermissionFlags.Administrator) === PermissionFlags.Administrator) {
      return true;
    }
    
    let bit: bigint;
    if (typeof permission === 'string') {
      bit = PermissionFlags[permission as keyof typeof PermissionFlags] || 0n;
    } else {
      bit = permission;
    }
    
    return (this.bitfield & bit) === bit;
  }

  /**
   * Get the raw bitfield
   */
  get bits(): bigint {
    return this.bitfield;
  }

  /**
   * Convert to array of permission names
   */
  toArray(): string[] {
    const result: string[] = [];
    for (const [name, bit] of Object.entries(PermissionFlags)) {
      if ((this.bitfield & bit) === bit) {
        result.push(name);
      }
    }
    return result;
  }
}

/**
 * Represents a guild member
 */
export class GuildMember {
  /** Reference to the client */
  public readonly client: Client;
  
  /** Reference to the guild */
  public readonly guild: Guild;
  
  /** The user this member represents */
  public readonly user: User;
  
  /** Member's nickname */
  public nickname?: string;
  
  /** Member's guild avatar */
  public avatar?: string;
  
  /** Role IDs */
  public roles: string[];
  
  /** Join timestamp */
  public readonly joinedTimestamp: number;
  
  /** Voice state */
  public voice: {
    channelId?: string;
    selfMute: boolean;
    selfDeaf: boolean;
  };
  
  /** Member permissions */
  public permissions: Permissions;

  constructor(client: Client, guild: Guild, data: APIGuildMember) {
    this.client = client;
    this.guild = guild;
    this.user = data.user ? new User(data.user) : new User({ id: '0', username: 'Unknown' });
    this.nickname = data.nick;
    this.avatar = data.avatar;
    this.roles = data.roles;
    this.joinedTimestamp = new Date(data.joined_at).getTime();
    this.voice = {
      channelId: data.voice?.channel_id,
      selfMute: data.voice?.self_mute ?? false,
      selfDeaf: data.voice?.self_deaf ?? false
    };
    
    // Check if user is guild owner
    const isOwner = guild.ownerId === this.user.id;
    
    // Parse permissions from interaction data
    this.permissions = new Permissions(data.permissions || '0', isOwner);
  }

  /**
   * Get the member's ID
   */
  get id(): string {
    return this.user.id;
  }

  /**
   * Get the display name (nickname or username)
   */
  get displayName(): string {
    return this.nickname || this.user.displayName || this.user.username;
  }

  /**
   * Get the join date
   */
  get joinedAt(): Date {
    return new Date(this.joinedTimestamp);
  }

  /**
   * Check if member is in a voice channel
   */
  get inVoiceChannel(): boolean {
    return !!this.voice.channelId;
  }

  /**
   * Get the member's avatar URL
   */
  avatarURL(): string | null {
    return this.avatar || null;
  }

  /**
   * Get the display avatar URL (member avatar or user avatar)
   */
  displayAvatarURL(): string {
    return this.avatar || this.user.displayAvatarURL();
  }

  /**
   * Convert to string (mention format)
   */
  toString(): string {
    return `<@${this.id}>`;
  }

  /**
   * Update member data
   */
  _patch(data: Partial<APIGuildMember>): void {
    if (data.nick !== undefined) this.nickname = data.nick;
    if (data.avatar !== undefined) this.avatar = data.avatar;
    if (data.roles !== undefined) this.roles = data.roles;
    if (data.voice !== undefined) {
      this.voice = {
        channelId: data.voice.channel_id,
        selfMute: data.voice.self_mute ?? false,
        selfDeaf: data.voice.self_deaf ?? false
      };
    }
  }
}
