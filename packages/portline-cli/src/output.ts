import chalk from 'chalk';
import type {ProfileCliOptions} from './types.js';

export function formatOutput(
    data: any,
    options: ProfileCliOptions,
    tableData?: {columns: string[]; rows: (string | number | boolean | undefined)[][]},
) {
    if (options.json) {
        console.log(JSON.stringify(data, null, 2));
    } else if (options.table && tableData) {
        const colWidths = tableData.columns.map((col, i) =>
            Math.max(col.length, ...tableData.rows.map(row => String(row[i] ?? '').length)),
        );

        const borderChars = {
            top: {start: '┌', mid: '┬', end: '┐'},
            middle: {start: '├', mid: '┼', end: '┤'},
            bottom: {start: '└', mid: '┴', end: '┘'},
            side: {start: '│', mid: '│', end: '│'},
        };

        const colored = Object.fromEntries(
            Object.entries(borderChars).map(([type, chars]) => [
                type,
                Object.fromEntries(Object.entries(chars).map(([k, v]) => [k, chalk.cyan(v)])),
            ]),
        ) as typeof borderChars;

        const buildBorder = (widths: number[], type: keyof typeof borderChars) => {
            const c = colored[type];

            return c.start + widths.map(w => chalk.cyan('─'.repeat(w + 2))).join(c.mid) + c.end;
        };

        const side = colored.side.mid;
        const buildRow = (cells: (string | number | boolean | undefined)[], widths: number[]) =>
            side + ' ' + cells.map((cell, i) => String(cell ?? '').padEnd(widths[i])).join(' ' + side + ' ') + ' ' + side;

        console.log(buildBorder(colWidths, 'top'));
        console.log(side + ' ' + tableData.columns.map((col, i) => chalk.bold.white(col.padEnd(colWidths[i]))).join(' ' + side + ' ') + ' ' + side);
        console.log(buildBorder(colWidths, 'middle'));
        tableData.rows.forEach(row => console.log(buildRow(row, colWidths)));
        console.log(buildBorder(colWidths, 'bottom'));
    } else {
        if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
            console.log(data);
        } else if (Array.isArray(data)) {
            data.forEach(item => console.log(chalk.green('• ') + item));
        } else {
            Object.entries(data).forEach(([key, value]) => {
                let displayValue = String(value);

                if (key === 'password' && !options.showPassword && value) {
                    displayValue = chalk.gray('(hidden)');
                }

                console.log(`${chalk.yellow(key.padEnd(26))}: ${displayValue}`);
            });
        }
    }
}
