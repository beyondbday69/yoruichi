export type MobileAction = 
  | { action: 'open_app'; app: string } 
  | { action: 'search_youtube' | 'search_web'; query: string } 
  | { action: 'whatsapp_message'; recipient: string; message: string };

export const MOBILE_TOOL = {
  name: 'mobile_action',
  description: 'Perform an Android action requested by the user: open an installed app, search YouTube, search the web in Chrome/browser, or open a WhatsApp message draft for a saved contact or international number. WhatsApp drafts are NOT sent; the user taps Send in WhatsApp. Never invent recipients, numbers or successful actions.',
  parameters: { 
    type: 'OBJECT', 
    properties: {
      action: { type: 'STRING', enum: ['open_app', 'search_youtube', 'search_web', 'whatsapp_message'] },
      app: { type: 'STRING', description: 'App name, such as WhatsApp (WP), YouTube, Chrome, Settings, Camera, Spotify, etc. Only for open_app.' },
      query: { type: 'STRING', description: 'The exact search requested by the user. Required for search actions.' },
      recipient: { type: 'STRING', description: 'Saved contact name as spoken, or a full international phone number with country code. Contacts are resolved locally.' },
      message: { type: 'STRING', description: 'Complete message the user requested. Ask for it if missing.' },
    }, 
    required: ['action'] 
  },
};

/** Exact local typed commands; Live voice uses structured Gemini function calls. */
export function parseMobileAction(input: string): MobileAction | null {
  const text = input.trim()
    .replace(/^(?:hey\s+|hi\s+|hello\s+|oye\s+|sun\s+)?(?:yoruichi|yoru|myraa|myra|योरुइची|मायरा)[,\s:]+/iu, '')
    .replace(/^(?:please|can you|could you|kripya|zara)\s+/i, '')
    .trim();

  // YouTube search
  let match = /^(?:open\s+)?(?:youtube|you tube)(?:\s+and|\s+pe)?\s+search(?:\s+for|\s+karo)?\s+(.+)$/i.exec(text) 
    || /^search(?:\s+for)?\s+(.+?)\s+(?:on|in|pe)\s+youtube$/i.exec(text)
    || /^youtube\s+(?:pe\s+)?(.+?)\s+(?:search\s+karo|play\s+karo|bajao|chalao)$/i.exec(text);
  if (match) return { action: 'search_youtube', query: match[1].trim() };

  // Web / Chrome search
  match = /^(?:open\s+)?(?:chrome|google chrome|google|browser)(?:\s+and|\s+pe)?\s+search(?:\s+for|\s+karo)?\s+(.+)$/i.exec(text) 
    || /^search(?:\s+for)?\s+(.+?)\s+(?:on|in|pe)\s+(?:chrome|google|browser)$/i.exec(text)
    || /^(?:google|chrome)\s+(?:pe\s+)?(.+?)\s+search(?:\s+karo)?$/i.exec(text);
  if (match) return { action: 'search_web', query: match[1].trim() };

  // WhatsApp message
  match = /^(?:message|msg|text)\s+(.+?)\s+(?:on|using|pe)\s+(?:whatsapp|wp|wa)\s*:\s*(.+)$/is.exec(text) 
    || /^(?:whatsapp|wp|wa)\s+(?:message|msg)(?:\s+to|\s+pe)?\s+(.+?)\s*:\s*(.+)$/is.exec(text)
    || /^(?:whatsapp\s+pe\s+)?(.+?)\s+ko\s+message\s+(?:bhejo|karo)\s*:\s*(.+)$/is.exec(text);
  if (match) return { action: 'whatsapp_message', recipient: match[1].trim(), message: match[2].trim() };

  // App opening
  const openText = text.replace(/[.!?।]+$/u, '');
  match = /^(?:open|launch|kholo)\s+([\p{L}\p{N}][\p{L}\p{N} ._-]{0,79})$/iu.exec(openText) 
    || /^([\p{L}\p{N}][\p{L}\p{N} ._-]{0,79})\s+(?:kholo|khol do|open karo|launch karo)$/iu.exec(openText);
  if (match && !/\band\b/i.test(match[1])) return { action: 'open_app', app: match[1].trim() };

  return null;
}
