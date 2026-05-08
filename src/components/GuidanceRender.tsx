/**
 * Tiny renderer for guidance bodies. Recognizes:
 *   - Lines starting with "## " as section headings (e.g., "## Description").
 *   - Blank lines as paragraph breaks.
 *
 * No third-party markdown dep. Authors writing the bind prompt should aim for
 * the two-section shape: "## Description" + (optional) "## Example".
 */
export function GuidanceRender({ body, className = "" }: { body: string; className?: string }) {
  const blocks = parseBlocks(body);
  return (
    <div className={`space-y-3 leading-relaxed ${className}`}>
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <p
              key={i}
              className="text-[10px] uppercase tracking-wider text-ey-yellow font-medium"
            >
              {block.text}
            </p>
          );
        }
        return (
          <p
            key={i}
            className="text-sm text-ey-light-gray whitespace-pre-wrap"
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

type Block = { kind: "heading" | "para"; text: string };

function parseBlocks(body: string): Block[] {
  const lines = body.split(/\r?\n/);
  const blocks: Block[] = [];
  let para: string[] = [];
  function flush() {
    if (para.length === 0) return;
    const text = para.join("\n").trim();
    if (text) blocks.push({ kind: "para", text });
    para = [];
  }
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flush();
      blocks.push({ kind: "heading", text: line.slice(3).trim() });
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}
