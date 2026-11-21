// solve.js — a fast drop-in for csv-reader 1.0.0 (make.fun's reference CSV reader).
//
// Same answers for every input {text, header} -> {columns, rows, errors}; faster by
// scanning with indexOf / slice / split instead of one character at a time.
//
// Design:
//  - Most records are one physical line with no quotes and no stray CRs: they are
//    taken as a whole line and split(',') in one C++ pass (fast path).
//  - Records that hold a quote or a stray CR go through a field scanner that jumps
//    from one special character to the next with a regex (/[,\r\n]/ and /["\r\n]/)
//    and slices fields, so no character is ever appended one at a time.
//  - Error semantics follow the reference exactly: stray_cr for a CR outside quotes
//    not followed by LF; quote_junk for text after a closing quote; unterminated_quote
//    for a quote that never closes (re-read as unquoted from just after the quote);
//    short_row / long_row with fields/extra counts; line = 1-based line the record
//    starts on (every LF, CRLF and lone CR inside quotes counted); row = the record's
//    index in rows (null for the header); errors in the order met.

const UNQ = /[,\r\n]/g; // next field terminator in an unquoted field
const QUO = /["\r\n]/g; // next interesting character inside a quoted field

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input, computed faster. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = 0;
  let line = 1;
  if (len > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  let recordLine = 1;
  let recordRow = null;

  const pushError = (code) => errors.push({ code, line: recordLine, row: recordRow });

  // Reads an unquoted field starting at pos, appending onto `value`.
  // Returns {value, ended, added} where added counts the characters kept.
  function readUnquoted(value) {
    let added = 0;
    let start = pos;
    while (pos < len) {
      UNQ.lastIndex = pos;
      const m = UNQ.exec(text);
      if (m === null) {
        const seg = text.slice(start, len);
        added += seg.length;
        value += seg;
        pos = len;
        return { value, ended: END, added };
      }
      const idx = m.index;
      const ch = m[0];
      if (ch === ',') {
        const seg = text.slice(start, idx);
        added += seg.length;
        value += seg;
        pos = idx + 1;
        return { value, ended: COMMA, added };
      }
      if (ch === '\n') {
        const seg = text.slice(start, idx);
        added += seg.length;
        value += seg;
        pos = idx + 1;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      // ch === '\r'
      if (text.charCodeAt(idx + 1) === 10) {
        const seg = text.slice(start, idx);
        added += seg.length;
        value += seg;
        pos = idx + 2;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      pushError('stray_cr');
      const seg = text.slice(start, idx);
      added += seg.length;
      value += seg;
      pos = idx + 1;
      start = pos;
    }
    return { value, ended: END, added };
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    pos += 1;
    let start = pos;
    while (pos < len) {
      QUO.lastIndex = pos;
      const m = QUO.exec(text);
      if (m === null) break; // no closing quote anywhere ahead
      const idx = m.index;
      const ch = m[0];
      if (ch === '"') {
        if (text.charCodeAt(idx + 1) === 34) {
          // Doubled quote: one quote in the value, keep scanning.
          value += text.slice(start, idx) + '"';
          pos = idx + 2;
          start = pos;
          continue;
        }
        // Closing quote.
        value += text.slice(start, idx);
        pos = idx + 1;
        if (pos >= len) return { value, ended: END };
        const c = text.charCodeAt(pos);
        if (c === 44) {
          pos += 1;
          return { value, ended: COMMA };
        }
        if (c === 10) {
          pos += 1;
          line += 1;
          return { value, ended: LINE_BREAK };
        }
        if (c === 13 && text.charCodeAt(pos + 1) === 10) {
          pos += 2;
          line += 1;
          return { value, ended: LINE_BREAK };
        }
        // Text after the closing quote is appended as it stands.
        const junk = readUnquoted(value);
        if (junk.added > 0) pushError('quote_junk');
        return junk;
      }
      if (ch === '\r') {
        // CRLF and a lone CR inside quotes are each one LF.
        value += text.slice(start, idx) + '\n';
        line += 1;
        pos = idx + (text.charCodeAt(idx + 1) === 10 ? 2 : 1);
        start = pos;
        continue;
      }
      // ch === '\n'
      value += text.slice(start, idx) + '\n';
      line += 1;
      pos = idx + 1;
      start = pos;
    }
    // The quote never closes: it is a literal character, and the text after it
    // is read again as unquoted.
    pos = open + 1;
    line = openLine;
    pushError('unterminated_quote');
    return readUnquoted('"');
  }

  // Closes one record: ragged rows are recorded and fixed to the first width.
  function finishRecord(fields, quoted) {
    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !quoted) return;
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      return;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // Fast path: one physical line with no quotes and no stray CRs. The line is
    // split(',') in one pass; a trailing CR is the CRLF's, not a stray one.
    const lineEnd0 = text.indexOf('\n', pos);
    const lineEnd = lineEnd0 === -1 ? len : lineEnd0;
    let contentEnd = lineEnd;
    if (lineEnd < len && lineEnd > pos && text.charCodeAt(lineEnd - 1) === 13) contentEnd = lineEnd - 1;
    const seg = text.slice(pos, contentEnd);
    if (seg.indexOf('"') === -1 && seg.indexOf('\r') === -1) {
      const fields = seg.split(',');
      if (lineEnd < len) {
        line += 1;
        pos = lineEnd + 1;
      } else {
        pos = len;
      }
      finishRecord(fields, false);
      continue;
    }

    // Slow path: the record holds a quote or a stray CR; read it field by field.
    const fields = [];
    let field;
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === 34;
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === COMMA);
    finishRecord(fields, quoted);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
