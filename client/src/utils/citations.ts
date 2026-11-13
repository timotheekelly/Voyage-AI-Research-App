/**
 * Turns `[n]` markers into `[n](#cite-n)` links so the renderer can make them clickable.
 * Only markers that map to a real citation (1..count) are converted, and code is left alone.
 */
export function linkifyCitations(markdown: string, count: number): string {
  if (count <= 0) return markdown;
  // Split out fenced code blocks and inline code so they are never touched.
  const parts = markdown.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return parts
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(/\[(\d{1,3})\](?!\()/g, (match, n: string) => {
            const num = Number(n);
            return num >= 1 && num <= count ? `[[${num}]](#cite-${num})` : match;
          }),
    )
    .join("");
}

export function parseCitationHref(href: string | undefined): number | null {
  const m = href?.match(/^#cite-(\d+)$/);
  return m ? Number(m[1]) : null;
}
