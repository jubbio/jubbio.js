# Jubbio Core SDK - Coding Conventions

This document outlines the naming patterns and coding conventions used in the Jubbio Core SDK.

## Naming Conventions

### Case Styles

| Context | Style | Example |
|---------|-------|---------|
| API response fields | `snake_case` | `member_count`, `joined_at`, `avatar_url` |
| TypeScript code | `camelCase` | `getMember`, `channelId`, `guildName` |
| Types/Interfaces | `PascalCase` with `API` prefix | `APIUser`, `APIGuildData`, `APIMemberData` |
| Classes | `PascalCase` | `Client`, `EmbedBuilder`, `Collection` |
| Constants | `SCREAMING_SNAKE_CASE` | `SENSITIVE_FIELDS`, `USER_CACHE_TTL` |
| Enums | `PascalCase` | `GatewayIntentBits`, `ChannelType`, `InteractionType` |

### Type Guards

Type guard functions use the `isX()` pattern:

```typescript
// Good
function isTextChannel(channel: APIChannel): channel is TextChannel {
  return channel.type === ChannelType.GuildText;
}

function isGuildMember(data: unknown): data is APIMemberData {
  return typeof data === 'object' && data !== null && 'user' in data;
}

// Avoid
function checkTextChannel(...) // Use 'is' prefix instead
```

## API Data Handling

### Snake Case Preservation

Fields from the API use `snake_case` and are **preserved as-is** for compatibility with the backend. Do not convert them to `camelCase` when serializing:

```typescript
// API Response (snake_case - keep as-is)
interface APIMemberData {
  user: APIUser;
  nick: string | null;
  roles: string[];
  joined_at: string;        // Keep snake_case
  premium_since?: string;   // Keep snake_case
  communication_disabled_until?: string;  // Keep snake_case
}

// Request body (also snake_case for backend)
await rest.editMember(guildId, userId, {
  nick: 'New Nick',
  communication_disabled_until: isoTimestamp  // snake_case in request
});
```

### Builder Pattern (camelCase)

Builder classes use `camelCase` for method names and provide a fluent API:

```typescript
// Builder methods use camelCase
const embed = new EmbedBuilder()
  .setTitle('Hello')           // camelCase
  .setDescription('World')     // camelCase
  .setColor(0x00ff00)          // camelCase
  .setTimestamp()              // camelCase
  .toJSON();                   // Serializes to API format (snake_case where needed)
```

## Documentation

### JSDoc Requirements

All public methods should have JSDoc with:
- `@param` - Parameter descriptions with types
- `@returns` - Return type description
- `@throws` - Error conditions (optional but recommended)
- `@example` - Code example (at least one per method where helpful)

```typescript
/**
 * Get a guild member by their user ID.
 *
 * @param guildId - The ID of the guild
 * @param userId - The ID of the user to fetch
 * @returns The member data including roles, nickname, and join date
 * @throws {RESTError} If the member is not found (404) or the bot lacks permissions
 *
 * @example
 * ```ts
 * const member = await rest.getMember('123456789', '987654321');
 * console.log(`${member.user.username} joined at ${member.joined_at}`);
 * ```
 */
async getMember(guildId: string, userId: string): Promise<APIMemberData> {
  return this.request<APIMemberData>('GET', `/bot/guilds/${guildId}/members/${userId}`);
}
```

## File Organization

### Directory Structure

```
src/
├── rest/           # REST API client and error classes
├── builders/       # Builder classes (EmbedBuilder, ActionRowBuilder, etc.)
├── structures/     # Data structure classes (User, Message, Channel, Guild)
├── utils/          # Utility classes (Collection, BitField, Formatters)
├── managers/       # Manager classes (ApplicationCommandManager)
├── sharding/       # Sharding support (ShardingManager, Shard)
├── types.ts        # Type definitions
├── enums.ts        # Enum definitions
└── Client.ts       # Main client class
```

### Import Order

1. External dependencies
2. Internal types
3. Internal utilities
4. Internal classes

```typescript
// External
import { EventEmitter } from 'events';

// Types
import { APIMessage, APIEmbed, APIUser } from '../types';

// Utilities
import { serializeComponents, normalizeEmbed } from '../utils/serialize';

// Classes
import { RESTError, RateLimitError } from './errors';
```

## Error Handling

### Custom Errors

Use custom error classes that extend `Error`:

```typescript
// REST errors include status, method, and path
throw new RESTError(response.status, method, path, errorMessage);

// Rate limit errors include retry timing
throw new RateLimitError(retryAfter, method, path);
```

### Error Messages

Error messages should be:
- Clear and actionable
- Include relevant context (IDs, paths)
- Translated where user-facing (Turkish comments in code are acceptable)

## Debugging

Use `process.env.DEBUG_REST` for conditional debug logging:

```typescript
if (process.env.DEBUG_REST) {
  console.log(`[REST] ${method} ${url}`, safeBody);
}
```

Never log sensitive data (tokens, passwords). Use the `redactSensitiveData()` method.
