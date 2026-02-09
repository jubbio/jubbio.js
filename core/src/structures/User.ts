import { APIUser } from '../types';

/**
 * Represents a user
 */
export class User {
  /** User ID */
  public readonly id: string;
  
  /** Username */
  public username: string;
  
  /** Display name */
  public displayName?: string;
  
  /** Avatar URL */
  public avatarURL?: string;
  
  /** Whether this is a bot */
  public bot: boolean;

  constructor(data: APIUser) {
    // Handle both string and number IDs (snowflake precision issue)
    this.id = String(data.id);
    this.username = data.username || `User_${this.id}`;
    this.displayName = data.display_name;
    this.avatarURL = data.avatar_url;
    this.bot = data.bot ?? false;
  }

  /**
   * Get the user's tag (username)
   */
  get tag(): string {
    return this.username;
  }

  /**
   * Get the default avatar URL
   */
  get defaultAvatarURL(): string {
    return `https://cdn.jubbio.com/embed/avatars/${parseInt(this.id) % 5}.png`;
  }

  /**
   * Get the display avatar URL
   */
  displayAvatarURL(): string {
    return this.avatarURL || this.defaultAvatarURL;
  }

  /**
   * Convert to string (mention format)
   */
  toString(): string {
    return `<@${this.id}>`;
  }

  /**
   * Update user data
   */
  _patch(data: Partial<APIUser>): void {
    if (data.username !== undefined) this.username = data.username;
    if (data.display_name !== undefined) this.displayName = data.display_name;
    if (data.avatar_url !== undefined) this.avatarURL = data.avatar_url;
    if (data.bot !== undefined) this.bot = data.bot;
  }
}
