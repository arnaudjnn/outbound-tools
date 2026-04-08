import { z } from "zod";
const ConfigSchema = z.object({
    API_KEY: z.string().min(1, "API_KEY is required"),
    MAILPOOL_API_KEY: z.string().min(1, "MAILPOOL_API_KEY is required"),
    ANTHROPIC_API_KEY: z.string().optional(),
});
export function loadConfig() {
    return ConfigSchema.parse({
        API_KEY: process.env.API_KEY,
        MAILPOOL_API_KEY: process.env.MAILPOOL_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    });
}
