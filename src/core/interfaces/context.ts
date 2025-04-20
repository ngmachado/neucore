import { ContextItem } from '../types';

export interface IContextProvider {
    getContext(query: string, options?: any): Promise<ContextItem[]>;
    addContext(item: ContextItem): Promise<void>;
    removeContext(id: string): Promise<void>;
} 