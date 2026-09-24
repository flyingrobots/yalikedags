import { escapeXml } from "../adapters/output/SvgRendererAdapter.ts";

/**
 * The viewer page: inline CSS, the server-rendered SVG, the snapshot JSON
 * in a data block, and one inline script for pan, zoom, selection, and
 * ancestor/descendant highlighting. Nothing is fetched. The token never
 * reaches this page; the local process talks to Linear.
 */
export function viewerPage(svg: string, snapshotJson: string, title: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeXml(title)}</title>
<style>
html,body{margin:0;height:100%;font:13px Helvetica,Arial,sans-serif;color:#111;background:#fafafa}
#wrap{display:grid;grid-template-columns:1fr 340px;height:100%}
#graph{overflow:hidden;cursor:grab;background:#fff}
#graph svg{width:100%;height:100%}
#side{border-left:1px solid #ddd;padding:12px;overflow:auto;background:#f6f6f6}
#side h1{font-size:15px;margin:0 0 8px}#side dt{font-weight:bold;margin-top:8px}#side dd{margin:0}
.node{cursor:pointer}.node.dim,.edge.dim{opacity:.18}.node.selected rect{stroke:#06c;stroke-width:3}
.legend span{display:inline-block;padding:1px 6px;margin:2px;border:1px solid #333;border-radius:4px}
.legend .ready{background:#d1ecf1}.legend .blocked{background:#f8d7da}.legend .in-progress{background:#fff3cd}.legend .done{background:#d4edda}
kbd{border:1px solid #999;border-radius:3px;padding:0 4px;background:#eee}
</style></head><body>
<div id="wrap"><div id="graph">${svg}</div>
<aside id="side"><h1>${escapeXml(title)}</h1>
<div class="legend"><span class="ready">ready</span><span class="blocked">blocked</span><span class="in-progress">in progress</span><span class="done">done</span> thick border: critical path; dashed: gatekeeper</div>
<p>Click a node. Drag to pan, wheel to zoom, <kbd>Esc</kbd> to clear.</p>
<div id="detail"><p>Nothing selected.</p></div>
<h2 style="font-size:13px">Frontier</h2><ol id="frontier"></ol>
<h2 style="font-size:13px">Findings</h2><ul id="findings"></ul>
</aside></div>
<script id="snapshot" type="application/json">${snapshotJson.replace(/</g, "\\u003c")}</script>
<script>
(function(){
  var snap = JSON.parse(document.getElementById('snapshot').textContent);
  var byId = {}; snap.tasks.forEach(function(t){ byId[t.id] = t; });
  var up = {}, down = {};
  snap.edges.forEach(function(e){ (up[e.to] = up[e.to] || []).push(e.from); (down[e.from] = down[e.from] || []).push(e.to); });
  function closure(id, m){ var out = {}, st = [id]; while (st.length) { var c = st.pop(); (m[c] || []).forEach(function(n){ if (!out[n]) { out[n] = 1; st.push(n); } }); } return out; }
  var svg = document.querySelector('#graph svg'); var vb = svg.getAttribute('viewBox').split(' ').map(Number);
  function setVB(){ svg.setAttribute('viewBox', vb.join(' ')); }
  var drag = null;
  svg.addEventListener('mousedown', function(e){ drag = {x:e.clientX, y:e.clientY}; });
  window.addEventListener('mouseup', function(){ drag = null; });
  window.addEventListener('mousemove', function(e){ if (!drag) return; var k = vb[2] / svg.clientWidth; vb[0] -= (e.clientX - drag.x) * k; vb[1] -= (e.clientY - drag.y) * k; drag = {x:e.clientX, y:e.clientY}; setVB(); });
  svg.addEventListener('wheel', function(e){ e.preventDefault(); var f = e.deltaY > 0 ? 1.1 : 0.9; var r = svg.getBoundingClientRect(); var px = vb[0] + (e.clientX - r.left) / r.width * vb[2]; var py = vb[1] + (e.clientY - r.top) / r.height * vb[3]; vb[2] *= f; vb[3] *= f; vb[0] = px - (e.clientX - r.left) / r.width * vb[2]; vb[1] = py - (e.clientY - r.top) / r.height * vb[3]; setVB(); }, {passive:false});
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function clear(){ document.querySelectorAll('.node,.edge').forEach(function(n){ n.classList.remove('dim'); n.classList.remove('selected'); }); document.getElementById('detail').innerHTML = '<p>Nothing selected.</p>'; }
  function select(id){
    var t = byId[id]; if (!t) return; var anc = closure(id, up), desc = closure(id, down);
    document.querySelectorAll('.node').forEach(function(n){ var nid = n.getAttribute('data-id'); n.classList.toggle('dim', !(nid === id || anc[nid] || desc[nid])); n.classList.toggle('selected', nid === id); });
    document.querySelectorAll('.edge').forEach(function(p){ var f = p.getAttribute('data-from'), to = p.getAttribute('data-to'); var keep = (f === id || anc[f]) && (to === id || anc[to]) || (f === id || desc[f]) && (to === id || desc[to]); p.classList.toggle('dim', !keep); });
    var rows = [['key', t.key], ['state', t.state], ['status', t.status], ['priority', t.priority], ['effort', t.effort], ['assignee', t.assignee], ['milestone', t.milestone], ['workstream', t.workstream], ['due', t.due], ['blocked by', (t.blockedBy||[]).map(function(b){ return byId[b] ? byId[b].key : b; }).join(', ')], ['blocks', (down[id]||[]).map(function(b){ return byId[b].key; }).join(', ')], ['labels', (t.labels||[]).join(', ')]];
    var html = '<h2 style="font-size:14px">' + esc(t.key) + ' ' + esc(t.title) + '</h2><dl>' + rows.filter(function(r){ return r[1] !== undefined && r[1] !== null && r[1] !== ''; }).map(function(r){ return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>';
    if (t.url) { html += '<p><a href="' + esc(t.url) + '" target="_blank" rel="noopener">Open in Linear</a></p>'; }
    if (t.description) { html += '<pre style="white-space:pre-wrap;font:12px monospace">' + esc(t.description) + '</pre>'; }
    document.getElementById('detail').innerHTML = html;
  }
  document.querySelectorAll('.node').forEach(function(n){ n.addEventListener('click', function(e){ e.stopPropagation(); select(n.getAttribute('data-id')); }); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') clear(); });
  document.getElementById('frontier').innerHTML = snap.frontier.map(function(f){ var t = byId[f.task]; return '<li><a href="#" data-id="' + esc(f.task) + '">' + esc(t.key) + '</a> ' + esc(t.title) + ' <small>unlocks ' + f.unlocks + (f.conflicts.length ? ' CONFLICT ' + esc(f.conflicts.join('; ')) : '') + '</small></li>'; }).join('');
  document.getElementById('findings').innerHTML = snap.findings.map(function(f){ var t = byId[f.task]; return '<li><b>' + esc(f.kind) + '</b> ' + (t ? '<a href="#" data-id="' + esc(f.task) + '">' + esc(t.key) + '</a> ' : '') + esc(f.detail) + '</li>'; }).join('');
  document.getElementById('side').addEventListener('click', function(e){ var a = e.target.closest('a[data-id]'); if (a) { e.preventDefault(); select(a.getAttribute('data-id')); } });
})();
</script></body></html>
`;
}
