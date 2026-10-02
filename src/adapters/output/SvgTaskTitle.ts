/** Bound visible labels to two readable lines; the SVG title keeps the complete task name. */
export class SvgTaskTitle {
  lines(title: string): string[] {
    const lines: string[] = [];
    let remaining = title;
    for (let i = 0; i < 2 && remaining.length > 0; i += 1) {
      if (remaining.length <= 34) { lines.push(remaining); break; }
      if (i === 1) { lines.push(`${remaining.slice(0, 33)}…`); break; }
      const space = remaining.lastIndexOf(" ", 34);
      const end = space > 12 ? space : 34;
      lines.push(remaining.slice(0, end)); remaining = remaining.slice(end).trimStart();
    }
    return lines;
  }
}
