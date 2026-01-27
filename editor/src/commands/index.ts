/**
 * Command registry and deserialization
 */

import type { Command, SerializedCommand, DeserializationContext } from './Command';
import { SetRowColorCommand } from './SetRowColorCommand';
import { SetRowCommentCommand } from './SetRowCommentCommand';

/**
 * Deserialize a command from storage
 */
export function deserializeCommand(
  serialized: SerializedCommand,
  context: DeserializationContext
): Command | null {
  try {
    switch (serialized.type) {
      case 'SetRowColorCommand':
        return SetRowColorCommand.fromJSON(serialized.payload, context);
      case 'SetRowCommentCommand':
        return SetRowCommentCommand.fromJSON(serialized.payload, context);
      default:
        console.warn(`Unknown command type: ${serialized.type}`);
        return null;
    }
  } catch (error) {
    console.error('Failed to deserialize command:', error);
    return null;
  }
}

// Export all commands
export * from './Command';
export { SetRowColorCommand } from './SetRowColorCommand';
export { SetRowCommentCommand } from './SetRowCommentCommand';
