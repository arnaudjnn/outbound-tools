import { z } from "zod";
declare const ConfigSchema: z.ZodObject<{
    API_KEY: z.ZodString;
    MAILPOOL_API_KEY: z.ZodString;
    ANTHROPIC_API_KEY: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    API_KEY: string;
    MAILPOOL_API_KEY: string;
    ANTHROPIC_API_KEY?: string | undefined;
}, {
    API_KEY: string;
    MAILPOOL_API_KEY: string;
    ANTHROPIC_API_KEY?: string | undefined;
}>;
export type Config = z.infer<typeof ConfigSchema>;
export declare function loadConfig(): Config;
export {};
//# sourceMappingURL=config.d.ts.map