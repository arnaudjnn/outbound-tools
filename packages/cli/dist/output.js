/**
 * Parse a ToolResult's content text into a JS object.
 */
export function parseResult(result) {
    const text = result.content[0]?.text;
    if (!text)
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
/**
 * Output data — raw JSON when --json flag is set, otherwise pretty-printed.
 */
export function output(program, data) {
    const opts = program.opts();
    if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
    }
    else {
        prettyPrint(data);
    }
}
function prettyPrint(data, indent = 0) {
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
                prettyPrintRow(item, indent);
                console.log();
            }
            else {
                console.log(`${pad}- ${String(item)}`);
            }
        }
        return;
    }
    if (typeof data === 'object') {
        prettyPrintRow(data, indent);
        return;
    }
    console.log(`${pad}${String(data)}`);
}
function prettyPrintRow(obj, indent) {
    const pad = '  '.repeat(indent);
    for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined)
            continue;
        if (typeof value === 'object' && !Array.isArray(value)) {
            console.log(`${pad}${key}:`);
            prettyPrintRow(value, indent + 1);
        }
        else if (Array.isArray(value)) {
            if (value.length === 0) {
                console.log(`${pad}${key}: (none)`);
            }
            else if (typeof value[0] === 'object') {
                console.log(`${pad}${key}:`);
                prettyPrint(value, indent + 1);
            }
            else {
                console.log(`${pad}${key}: ${value.join(', ')}`);
            }
        }
        else {
            console.log(`${pad}${key}: ${String(value)}`);
        }
    }
}
