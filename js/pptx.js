/* PowerPoint (.pptx) and Word (.docx) reader: slide titles, text, tables and speaker notes.
   No library needed: a .pptx is a zip of XML files; DecompressionStream inflates them. */
(function (root) {
  const td = new TextDecoder();

  async function inflate(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
  }

  /* Minimal zip reader (central directory) → { name: async () => Uint8Array } */
  function unzip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Not a zip file');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = {};
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const name = td.decode(u8.subarray(p + 46, p + 46 + nlen));
      files[name] = async () => {
        const ln = dv.getUint16(off + 26, true), lx = dv.getUint16(off + 28, true);
        const data = u8.subarray(off + 30 + ln + lx, off + 30 + ln + lx + csize);
        return method === 0 ? data : inflate(data);
      };
      p += 46 + nlen + xlen + clen;
    }
    return files;
  }

  const ent = s => s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (m, e) =>
    e === 'lt' ? '<' : e === 'gt' ? '>' : e === 'quot' ? '"' : e === 'apos' ? "'" : e === 'amp' ? '&'
      : e[1] === 'x' || e[1] === 'X' ? String.fromCodePoint(parseInt(e.slice(2), 16)) : String.fromCodePoint(+e.slice(1)));
  const runs = xml => (xml.match(/<a:t>[^<]*<\/a:t>|<a:t [^>]*>[^<]*<\/a:t>|<a:br\/>/g) || []).map(t => t === '<a:br/>' ? '\n' : ent(t.replace(/<[^>]+>/g, ''))).join('');
  const paras = xml => (xml.match(/<a:p>[\s\S]*?<\/a:p>|<a:p [\s\S]*?<\/a:p>/g) || []).map(runs).map(s => s.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);

  function tablesOf(xml) {
    return (xml.match(/<a:tbl>[\s\S]*?<\/a:tbl>/g) || []).map(t =>
      (t.match(/<a:tr[\s>][\s\S]*?<\/a:tr>/g) || []).map(tr => (tr.match(/<a:tc[\s>][\s\S]*?<\/a:tc>/g) || []).map(tc => paras(tc).join(' '))));
  }

  function slideOf(xml) {
    const tables = tablesOf(xml);
    const noTables = xml.replace(/<a:tbl>[\s\S]*?<\/a:tbl>/g, '');
    const shapes = (noTables.match(/<p:sp>[\s\S]*?<\/p:sp>|<p:sp [\s\S]*?<\/p:sp>/g) || []);
    let title = '';
    const body = [];
    for (const sp of shapes) {
      const ps = paras(sp);
      if (!ps.length) continue;
      if (!title && /<p:ph[^>]*type="(title|ctrTitle)"/.test(sp)) { title = ps.join(' '); continue; }
      body.push(...ps);
    }
    // No title placeholder: first short line that isn't a slide number or an ALL-CAPS kicker ("QUICK QUESTION")
    if (!title) {
      title = body.slice(0, 6).find(s => !/^\d{1,3}$/.test(s) && s.length > 3 && s.length <= 90 && s !== s.toUpperCase()) || '';
      if (title) body.splice(body.indexOf(title), 1);
    }
    return { title, body: body.filter(s => !/^\d{1,3}$/.test(s)), tables };
  }

  async function readPptx(buf) {
    const z = unzip(buf);
    const txt = async n => z[n] ? td.decode(await z[n]()) : '';
    // Slide order from presentation.xml (falls back to slide number)
    let order = Object.keys(z).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/\d+/g).pop() - +b.match(/\d+/g).pop());
    try {
      const pres = await txt('ppt/presentation.xml'), rels = await txt('ppt/_rels/presentation.xml.rels');
      const map = Object.fromEntries([...rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map(m => [m[1], 'ppt/' + m[2].replace(/^\/?ppt\//, '')]));
      const ids = [...pres.matchAll(/<p:sldId [^>]*r:id="([^"]+)"/g)].map(m => map[m[1]]).filter(n => z[n]);
      if (ids.length) order = ids;
    } catch { /* keep numeric order */ }
    const slides = [];
    for (const [i, n] of order.entries()) {
      const s = slideOf(await txt(n));
      const relXml = await txt(n.replace('slides/', 'slides/_rels/') + '.rels');
      const notesTarget = relXml.match(/Target="\.\.\/notesSlides\/([^"]+)"/);
      if (notesTarget) {
        const nx = await txt('ppt/notesSlides/' + notesTarget[1]);
        s.notes = paras(nx.replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*type="sldNum"[\s\S]*?<\/p:sp>/g, '')).filter(p => !/^\d{1,3}$/.test(p)).join('\n');
      }
      s.n = i + 1;
      slides.push(s);
    }
    return { slides };
  }

  async function readDocx(buf) {
    const z = unzip(buf);
    const xml = z['word/document.xml'] ? td.decode(await z['word/document.xml']()) : '';
    const out = [];
    for (const p of xml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || []) {
      const text = (p.match(/<w:t[^>]*>[^<]*<\/w:t>|<w:tab\/>/g) || []).map(t => t === '<w:tab/>' ? '\t' : ent(t.replace(/<[^>]+>/g, ''))).join('').trim();
      if (!text) continue;
      const h = p.match(/<w:pStyle w:val="(Heading|Title)(\d?)"/i);
      out.push(h ? `${'#'.repeat(Math.min(3, +(h[2] || 1)))} ${text}` : text);
    }
    return { text: out.join('\n\n') };
  }

  /* Slides → Markdown note */
  function toMarkdown(deck, title) {
    const md = [`# ${title}`, ''];
    for (const s of deck.slides) {
      md.push(`## ${s.n}. ${s.title || 'Slide ' + s.n}`);
      for (const b of s.body) md.push(`- ${b.replace(/\n/g, ' ')}`);
      for (const t of s.tables) {
        if (!t.length) continue;
        md.push('', '| ' + t[0].join(' | ') + ' |', '|' + t[0].map(() => '---').join('|') + '|', ...t.slice(1).map(r => '| ' + r.join(' | ') + ' |'));
      }
      if (s.notes) md.push('', `> Notes: ${s.notes.replace(/\n/g, ' ')}`);
      md.push('');
    }
    return md.join('\n');
  }

  const api = { unzip, readPptx, readDocx, toMarkdown };
  root.PPTX = api;
  if (root.App) root.App.pptx = api;
})(typeof window !== 'undefined' ? window : globalThis);
