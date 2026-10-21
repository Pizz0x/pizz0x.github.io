// Draws a repository tree two ways: a dendrogram (lines grow from the root) for wide screens and a
// nested list for phones. Positions are percentages across and pixels down, so the drawing keeps
// its proportions at any width while the labels keep their size.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function treeLayout(tree) {
  const LH = 42; const TOP = 56;
  let leaf = 0; let maxDepth = 0;
  const nodes = [];
  const place = (n, d) => {
    maxDepth = Math.max(maxDepth, d);
    const node = { ...n, depth: d };
    if (n.children && n.children.length) {
      node.kids = n.children.map((c) => place(c, d + 1));
      node.y = (node.kids[0].y + node.kids[node.kids.length - 1].y) / 2;
    } else { node.y = TOP + leaf * LH; leaf++; }
    nodes.push(node);
    return node;
  };
  const root = place(tree, 0);
  const height = TOP + Math.max(leaf, 1) * LH + 8;
  // columns: the last one keeps room for its labels
  const usable = 74; const step = maxDepth ? Math.min(24, usable / maxDepth) : 0;
  for (const n of nodes) n.x = 3 + n.depth * step;
  return { root, nodes, height, maxDepth };
}

export function treeSvg(tree, { href, t }) {
  const { root, nodes, height } = treeLayout(tree);
  const paths = [];
  const edge = (p) => {
    for (const c of p.kids || []) {
      const xm = p.x + (c.x - p.x) * (p.depth === 0 ? 0.8 : 0.5);
      paths.push(`<path d="M${(p.x * 10).toFixed(1)} ${p.y}H${(xm * 10).toFixed(1)}V${c.y}H${(c.x * 10).toFixed(1)}"/>`);
      edge(c);
    }
  };
  edge(root);
  const label = (n) => {
    const folder = n.kind === 'dir';
    const files = folder ? fmtFiles(t, n.files) : '';
    const name = folder && n.depth > 0 ? `${n.name}/` : n.name;
    const cls = ['node', `node--${n.kind}`, n.depth === 0 ? 'node--root' : '', folder && n.kids ? 'node--open' : ''].join(' ').trim();
    const inner = `<span class="node__dot" aria-hidden="true"></span><span class="node__label"><code>${esc(name)}</code>${folder && !n.kids && n.depth > 0 ? ` <span class="node__count">${esc(files)}</span>` : ''}</span>`;
    const style = `style="left:${n.x.toFixed(2)}%;top:${n.y}px;--d:${n.depth}"`;
    if (n.kind === 'more') return `<span class="${cls}" ${style}>${inner}</span>`;
    const title = folder ? ` title="${esc(files)}"` : '';
    return `<a class="${cls}" ${style} href="${esc(href(n))}" target="_blank" rel="noopener"${title}>${inner}</a>`;
  };
  return `<div class="dendro" style="height:${height}px" data-ui>
  <svg class="dendro__lines" viewBox="0 0 1000 ${height}" preserveAspectRatio="none" aria-hidden="true">${paths.join('')}</svg>
  ${nodes.sort((a, b) => a.depth - b.depth).map(label).join('\n  ')}
</div>`;
}

function fmtFiles(t, n) { return (t['project.folderFiles'] || '{n} files').replace('{n}', n); }

export function treeList(tree, { href, t }) {
  const item = (n, d) => {
    const folder = n.kind === 'dir';
    const name = folder && d > 0 ? `${n.name}/` : n.name;
    if (n.kind === 'more') return `<li class="tl__more">${esc(n.name)}</li>`;
    const link = `<a href="${esc(href(n))}" target="_blank" rel="noopener"><code>${esc(name)}</code></a>`;
    if (folder && n.children) return `<li class="tl__dir"><details${d < 2 ? ' open' : ''}><summary><code>${esc(name)}</code> <span class="tl__count">${esc(fmtFiles(t, n.files))}</span></summary><ul>${n.children.map((c) => item(c, d + 1)).join('')}</ul></details></li>`;
    if (folder) return `<li class="tl__dir tl__closed">${link} <span class="tl__count">${esc(fmtFiles(t, n.files))}</span></li>`;
    return `<li>${link}</li>`;
  };
  return `<ul class="tl" data-ui>${item(tree, 0)}</ul>`;
}
