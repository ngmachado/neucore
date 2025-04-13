export class Intent {
    constructor(
        public action: string,
        public parameters: Record<string, any> = {},
        public metadata: Record<string, any> = {}
    ) { }
} 