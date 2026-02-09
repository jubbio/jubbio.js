import { PermissionFlagsBits } from '../enums';

/**
 * Permission names type
 */
export type PermissionString = keyof typeof PermissionFlagsBits;

/**
 * Resolvable permission type
 */
export type PermissionResolvable = 
  | bigint 
  | bigint[] 
  | PermissionString 
  | PermissionString[] 
  | PermissionsBitField;

/**
 * Bit field for permissions
 * API compatible with Discord.js PermissionsBitField
 */
export class PermissionsBitField {
  /** The raw bits */
  public bitfield: bigint;

  /** All permission flags */
  static Flags = PermissionFlagsBits;

  /** All permissions combined */
  static All = Object.values(PermissionFlagsBits).reduce((acc, val) => acc | val, 0n);

  /** Default permissions */
  static Default = BigInt(0);

  constructor(bits: PermissionResolvable = 0n) {
    this.bitfield = PermissionsBitField.resolve(bits);
  }

  /**
   * Check if this bitfield has a permission
   */
  has(permission: PermissionResolvable, checkAdmin = true): boolean {
    // Admin has all permissions
    if (checkAdmin && this.bitfield & PermissionFlagsBits.Administrator) {
      return true;
    }

    const bit = PermissionsBitField.resolve(permission);
    return (this.bitfield & bit) === bit;
  }

  /**
   * Check if this bitfield has any of the permissions
   */
  any(permissions: PermissionResolvable, checkAdmin = true): boolean {
    // Admin has all permissions
    if (checkAdmin && this.bitfield & PermissionFlagsBits.Administrator) {
      return true;
    }

    const bit = PermissionsBitField.resolve(permissions);
    return (this.bitfield & bit) !== 0n;
  }

  /**
   * Check if this bitfield is missing any permissions
   */
  missing(permissions: PermissionResolvable, checkAdmin = true): PermissionString[] {
    const missing: PermissionString[] = [];
    
    for (const [name, bit] of Object.entries(PermissionFlagsBits)) {
      const resolved = PermissionsBitField.resolve(permissions);
      if ((resolved & bit) && !this.has(bit, checkAdmin)) {
        missing.push(name as PermissionString);
      }
    }
    
    return missing;
  }

  /**
   * Add permissions to this bitfield
   */
  add(...permissions: PermissionResolvable[]): this {
    for (const permission of permissions) {
      this.bitfield |= PermissionsBitField.resolve(permission);
    }
    return this;
  }

  /**
   * Remove permissions from this bitfield
   */
  remove(...permissions: PermissionResolvable[]): this {
    for (const permission of permissions) {
      this.bitfield &= ~PermissionsBitField.resolve(permission);
    }
    return this;
  }

  /**
   * Serialize this bitfield to an array of permission names
   */
  toArray(): PermissionString[] {
    const result: PermissionString[] = [];
    
    for (const [name, bit] of Object.entries(PermissionFlagsBits)) {
      if (this.bitfield & bit) {
        result.push(name as PermissionString);
      }
    }
    
    return result;
  }

  /**
   * Serialize this bitfield to a JSON-compatible value
   */
  toJSON(): string {
    return this.bitfield.toString();
  }

  /**
   * Get the string representation
   */
  toString(): string {
    return this.bitfield.toString();
  }

  /**
   * Freeze this bitfield
   */
  freeze(): Readonly<this> {
    return Object.freeze(this);
  }

  /**
   * Check equality with another bitfield
   */
  equals(other: PermissionResolvable): boolean {
    return this.bitfield === PermissionsBitField.resolve(other);
  }

  /**
   * Create a new bitfield with the same bits
   */
  clone(): PermissionsBitField {
    return new PermissionsBitField(this.bitfield);
  }

  /**
   * Resolve a permission to a bigint
   */
  static resolve(permission: PermissionResolvable): bigint {
    if (typeof permission === 'bigint') {
      return permission;
    }

    if (permission instanceof PermissionsBitField) {
      return permission.bitfield;
    }

    if (typeof permission === 'string') {
      const bit = PermissionFlagsBits[permission as PermissionString];
      if (bit === undefined) {
        throw new Error(`Unknown permission: ${permission}`);
      }
      return bit;
    }

    if (Array.isArray(permission)) {
      let result = 0n;
      for (const p of permission) {
        result |= PermissionsBitField.resolve(p);
      }
      return result;
    }

    throw new Error(`Invalid permission: ${permission}`);
  }
}

export default PermissionsBitField;
