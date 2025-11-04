import { createContext } from '@lit/context';
import { TickManager } from '../../lib/tickManager';
export const tickManagerContext = createContext<TickManager>('tickManager');
