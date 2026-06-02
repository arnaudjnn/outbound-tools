import type { Command } from 'commander';

/**
 * Normalize a tool result into a JS object.
 *
 * `functionMap` handlers return raw objects, but some callers wrap results in
 * the MCP ToolResult shape (`{ content: [{ type, text }] }`). Handle both.
 */
export function parseResult(result: unknown): unknown {
  if (
    result &&
    typeof result === 'object' &&
    'content' in result &&
    Array.isArray((result as { content: unknown }).content)
  ) {
    const text = (result as { content: { text?: string }[] }).content[0]?.text;
    if (text == null) return result;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return result;
}

/**
 * Output data — raw JSON when --json flag is set, otherwise pretty-printed.
 */
export function output(program: Command, data: unknown): void {
  const opts = program.opts();
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    prettyPrint(data);
  }
}

function prettyPrint(data: unknown, indent = 0): void {
  const pad = '  '.repeat(indent);
  if (data === null || data === undefined) {
    console.log(`${pad}(empty)`);
    return;
  }
  if (typeof data === 'string') {
    console.log(`${pad}${data}`);
    return;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log(`${pad}(none)`);
      return;
    }
    for (const item of data) {
      if (typeof item === 'object' && item !== null) {
        prettyPrintRow(item as Record<string, unknown>, indent);
        console.log();
      } else {
        console.log(`${pad}- ${String(item)}`);
      }
    }
    return;
  }
  if (typeof data === 'object') {
    prettyPrintRow(data as Record<string, unknown>, indent);
    return;
  }
  console.log(`${pad}${String(data)}`);
}

function prettyPrintRow(obj: Record<string, unknown>, indent: number): void {
  const pad = '  '.repeat(indent);
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      console.log(`${pad}${key}:`);
      prettyPrintRow(value as Record<string, unknown>, indent + 1);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        console.log(`${pad}${key}: (none)`);
      } else if (typeof value[0] === 'object') {
        console.log(`${pad}${key}:`);
        prettyPrint(value, indent + 1);
      } else {
        console.log(`${pad}${key}: ${value.join(', ')}`);
      }
    } else {
      console.log(`${pad}${key}: ${String(value)}`);
    }
  }
}
