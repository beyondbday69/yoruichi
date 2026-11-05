import fs from 'node:fs/promises';
import { YORUICHI_PERSONALITY } from '../shared/conversation';
await fs.writeFile('android/app/src/main/assets/personality.txt', YORUICHI_PERSONALITY);
