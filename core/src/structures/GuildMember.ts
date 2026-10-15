import { APIGuildMember } from '../types';
import { User } from './User';
import { Guild } from './Guild';
import type { Client } from '../Client';
import { PermissionsBitField } from '../utils/PermissionsBitField';

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
  public permissions: PermissionsBitField;

  constructor(client: Client, guild: Guild, data: APIGuildMember) {
    this.client = client;
    this.guild = guild;
    this.user = data.user ? new User(data.user, client) : new User({ id: '0', username: 'Unknown' }, client);
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
    const permBits = data.permissions ? BigInt(data.permissions) : 0n;
    this.permissions = new PermissionsBitField(permBits, isOwner);
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
