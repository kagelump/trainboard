import { createContext } from '@lit/context';
import { TickManager } from '../tickManager';
export const tickManagerContext = createContext<TickManager>('tickManager');
