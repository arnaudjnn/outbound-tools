import type { Command } from 'commander';
/**
 * Parse a ToolResult's content text into a JS object.
 */
export declare function parseResult(result: {
    content: {
        type: string;
        text: string;
    }[];
}): unknown;
/**
 * Output data — raw JSON when --json flag is set, otherwise pretty-printed.
 */
export declare function output(program: Command, data: unknown): void;
//# sourceMappingURL=output.d.ts.map