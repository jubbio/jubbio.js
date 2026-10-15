import { APIEmbed } from '../types';

/**
 * Serialize components array (ActionRowBuilder/ButtonBuilder instances) to plain JSON.
 * Handles nested structures: ActionRow → components[] → Button/SelectMenu
 * 
 * @param components - Array of components (may include builder instances)
 * @returns Serialized components as plain JSON objects
 */
export function serializeComponents(components: any[] | undefined): any[] | undefined {
  if (!components) return undefined;
  return components.map(row => {
    // If it has a toJSON method (ActionRowBuilder), call it
    const rowData = typeof row?.toJSON === 'function' ? row.toJSON() : row;
    // Also serialize nested components (buttons, select menus inside action rows)
    if (rowData?.components && Array.isArray(rowData.components)) {
      rowData.components = rowData.components.map((comp: any) =>
        typeof comp?.toJSON === 'function' ? comp.toJSON() : comp
      );
    }
    return rowData;
  });
}

/**
 * Normalize an embed for outgoing API requests.
 * Handles:
 * - EmbedBuilder instances (calls toJSON())
 * - color: hex string → number
 * - timestamp: Date/number → ISO string
 * - footer.iconURL → footer.icon_url
 * - author.iconURL → author.icon_url
 * - thumbnail: string → { url: string }
 * - image: string → { url: string }
 * 
 * @param embed - Raw embed (may be EmbedBuilder or plain object)
 * @returns Normalized APIEmbed ready for the API
 */
export function normalizeEmbed(embed: any): APIEmbed {
  // Support EmbedBuilder instances - extract raw data via toJSON()
  const rawEmbed = typeof embed?.toJSON === 'function' ? embed.toJSON() : embed;
  const processed: any = { ...rawEmbed };

  // Normalize thumbnail: string → { url: string }
  if (typeof processed.thumbnail === 'string') {
    processed.thumbnail = { url: processed.thumbnail };
  }

  // Normalize image: string → { url: string }
  if (typeof processed.image === 'string') {
    processed.image = { url: processed.image };
  }

  // Normalize color: hex string → number
  if (typeof processed.color === 'string') {
    processed.color = parseInt(processed.color.replace('#', ''), 16);
  }

  // Normalize timestamp: Date → ISO string
  if (processed.timestamp instanceof Date) {
    processed.timestamp = processed.timestamp.toISOString();
  } else if (typeof processed.timestamp === 'number') {
    processed.timestamp = new Date(processed.timestamp).toISOString();
  }

  // Normalize footer.iconURL → footer.icon_url
  if (processed.footer) {
    if (processed.footer.iconURL && !processed.footer.icon_url) {
      processed.footer = { ...processed.footer, icon_url: processed.footer.iconURL };
      delete processed.footer.iconURL;
    }
  }

  // Normalize author.iconURL → author.icon_url
  if (processed.author) {
    if (processed.author.iconURL && !processed.author.icon_url) {
      processed.author = { ...processed.author, icon_url: processed.author.iconURL };
      delete processed.author.iconURL;
    }
  }

  return processed;
}

/**
 * Normalize an array of embeds for outgoing API requests.
 * 
 * @param embeds - Array of embeds (may include EmbedBuilder instances)
 * @returns Array of normalized APIEmbed objects
 */
export function normalizeEmbeds(embeds: any[] | undefined): APIEmbed[] | undefined {
  if (!embeds || embeds.length === 0) return undefined;
  return embeds.map(normalizeEmbed);
}
