/**
 * 어드민 평문 안내 → PDP/미리보기용 안전 HTML (커스텀 파서, 외부 마크다운 라이브러리 없음).
 *
 * 규칙:
 * 1. `**...**` → <strong>
 * 2. `- ` 로 시작(선행 공백 제외) → 목록 <li>, 연속 항목은 하나의 <ul>
 * 3. 공백 2칸당 depth 1, `  - ` 형태 → 중첩 <ul class="policy-nested-ul ml-4 mt-1">
 * 4. 일반 줄 → 이스케이프 + 줄 끝 <br />, 목록 블록과 섞일 때 불필요한 br 없음
 * 5. 빈 줄 → 문단 간격 <div class="policy-para-gap"></div>
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 작성용 첫 줄(예: "📋 1. [상품 고시] 입력 내용") 제거 */
export function stripLeadingPolicyScaffold(raw: string): string {
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines.length === 0) return normalized;
  const first = lines[0].trim();
  const looksLikeDraftLabel =
    /\d+\./.test(first) && /\[[^\]]+\]/.test(first) && /입력\s*내용/.test(first);
  if (!looksLikeDraftLabel) return normalized;
  return lines.slice(1).join("\n").trimStart();
}

export function looksLikePolicyHtml(s: string): boolean {
  return /<[a-z][\s\S]*>/i.test(s);
}

/** 규칙 1: `**단어**` → <strong> */
export function formatBold(raw: string): string {
  const parts = raw.split(/\*\*/);
  return parts
    .map((p, i) => (i % 2 === 1 ? `<strong>${escapeHtml(p)}</strong>` : escapeHtml(p)))
    .join("");
}

function countLeadingWs(line: string): { n: number; rest: string } {
  let i = 0;
  let n = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === " ") {
      n += 1;
      i += 1;
    } else if (ch === "\t") {
      n += 2;
      i += 1;
    } else break;
  }
  return { n, rest: line.slice(i) };
}

/** 규칙 2·3: `- ` 목록 줄이면 depth·본문, 아니면 null */
function tryParseListLine(line: string): { depth: number; body: string } | null {
  const { n, rest } = countLeadingWs(line);
  const m = rest.match(/^-\s+(.*)$/);
  if (!m) return null;
  const depth = Math.min(24, Math.floor(n / 2));
  return { depth, body: m[1] };
}

interface ListItemRendered {
  depth: number;
  html: string;
}

function clampListDepths(items: ListItemRendered[]): void {
  if (items.length === 0) return;
  const minD = Math.min(...items.map((x) => x.depth));
  for (const it of items) it.depth -= minD;
  for (let k = 1; k < items.length; k++) {
    if (items[k].depth > items[k - 1].depth + 1) {
      items[k].depth = items[k - 1].depth + 1;
    }
  }
}

/**
 * 규칙 2·3: 중첩 ul — depth 증가 시 직전 li 안에 하위 ul
 * 최상위: policy-plain-ul, 하위: policy-nested-ul ml-4 mt-1 (Tailwind — lib을 content에 포함 필요)
 */
function renderListTree(items: ListItemRendered[]): string {
  if (items.length === 0) return "";
  clampListDepths(items);

  function walk(start: number, level: number): [string, number] {
    const ulOpen =
      level === 0
        ? '<ul class="policy-plain-ul">'
        : '<ul class="policy-nested-ul ml-4 mt-1">';
    let html = ulOpen;
    let i = start;
    while (i < items.length && items[i].depth >= level) {
      const it = items[i];
      if (it.depth !== level) break;
      html += "<li>";
      html += it.html;
      i += 1;
      if (i < items.length && items[i].depth > level) {
        const [inner, ni] = walk(i, level + 1);
        html += inner;
        i = ni;
      }
      html += "</li>";
    }
    html += "</ul>";
    return [html, i];
  }

  const [out] = walk(0, 0);
  return out;
}

function flushCallout(noteLines: string[]): string {
  const inner = noteLines.map((l) => formatBold(l)).join("<br />");
  return `<div class="policy-callout highlight-box text-[14px] leading-relaxed text-gray-800 italic">${inner}</div>`;
}

/**
 * 평문 → 안전 HTML (스크립트·임의 태그 삽입 없음 — 출력 태그만 사용)
 */
export function policyPlainTextToSafeHtml(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");
  const stripped = stripLeadingPolicyScaffold(normalized).trimEnd();
  if (!stripped) return "";

  const lines = stripped.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      while (i < lines.length && lines[i].trim() === "") i += 1;
      if (out.length > 0 && i < lines.length) {
        out.push('<div class="policy-para-gap h-4" aria-hidden="true"></div>');
      }
      continue;
    }

    if (trimmed.startsWith("※")) {
      const noteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("※")) {
        noteLines.push(lines[i].trim());
        i += 1;
      }
      out.push(flushCallout(noteLines));
      continue;
    }

    const firstLi = tryParseListLine(line);
    if (firstLi) {
      const items: ListItemRendered[] = [];
      while (i < lines.length) {
        const li = tryParseListLine(lines[i]);
        if (!li) break;
        items.push({ depth: li.depth, html: formatBold(li.body) });
        i += 1;
      }
      if (items.length > 0) {
        out.push(renderListTree(items));
      }
      continue;
    }

    out.push(formatBold(line) + "<br />");
    i += 1;
  }

  return out.join("");
}
