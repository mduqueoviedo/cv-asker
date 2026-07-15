import { deflateSync } from 'node:zlib';
import type { CandidateResume } from '../../types/resume.js';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const SIDEBAR_WIDTH = 178;
const CONTENT_LEFT = 204;
const CONTENT_WIDTH = PAGE_WIDTH - CONTENT_LEFT - 36;

interface PortraitImage {
  width: number;
  height: number;
  data: Buffer;
}

function rgb(color: [number, number, number]): string {
  return color.map((channel) => (channel / 255).toFixed(3)).join(' ');
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function pageY(offsetFromTop: number): number {
  return PAGE_HEIGHT - offsetFromTop;
}

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const estimatedCharsPerLine = Math.max(12, Math.floor(maxWidth / (fontSize * 0.54)));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length <= estimatedCharsPerLine) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function pushTextLine(
  commands: string[],
  text: string,
  x: number,
  offsetFromTop: number,
  font: 'F1' | 'F2' | 'F3',
  fontSize: number,
  color: [number, number, number]
) {
  commands.push(`${rgb(color)} rg`);
  commands.push(
    `BT /${font} ${fontSize} Tf 1 0 0 1 ${x} ${pageY(offsetFromTop)} Tm (${escapePdfText(text)}) Tj ET`
  );
}

function pushWrappedText(
  commands: string[],
  text: string,
  options: {
    x: number;
    offsetFromTop: number;
    maxWidth: number;
    font: 'F1' | 'F2' | 'F3';
    fontSize: number;
    color: [number, number, number];
    lineHeight: number;
    maxLines?: number;
  }
): number {
  const wrappedLines = wrapText(text, options.maxWidth, options.fontSize);
  const linesToRender =
    typeof options.maxLines === 'number'
      ? wrappedLines.slice(0, options.maxLines)
      : wrappedLines;

  linesToRender.forEach((line, index) => {
    const isLastVisibleLine =
      typeof options.maxLines === 'number' &&
      index === linesToRender.length - 1 &&
      wrappedLines.length > linesToRender.length;

    pushTextLine(
      commands,
      isLastVisibleLine ? `${line}...` : line,
      options.x,
      options.offsetFromTop + index * options.lineHeight,
      options.font,
      options.fontSize,
      options.color
    );
  });

  return options.offsetFromTop + linesToRender.length * options.lineHeight;
}

function drawRect(
  commands: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  color: [number, number, number]
) {
  commands.push(`${rgb(color)} rg`);
  commands.push(`${x} ${y} ${width} ${height} re f`);
}

function createPortraitImage(candidate: CandidateResume): PortraitImage {
  const width = 160;
  const height = 200;
  const bytes = Buffer.alloc(width * height * 3);

  const setPixel = (x: number, y: number, color: [number, number, number]) => {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }

    const offset = (y * width + x) * 3;
    bytes[offset] = color[0];
    bytes[offset + 1] = color[1];
    bytes[offset + 2] = color[2];
  };

  const blend = (
    start: [number, number, number],
    end: [number, number, number],
    ratio: number
  ): [number, number, number] => {
    const clampRatio = Math.min(1, Math.max(0, ratio));
    return [
      Math.round(start[0] + (end[0] - start[0]) * clampRatio),
      Math.round(start[1] + (end[1] - start[1]) * clampRatio),
      Math.round(start[2] + (end[2] - start[2]) * clampRatio),
    ];
  };

  const fillCircle = (cx: number, cy: number, radius: number, color: [number, number, number]) => {
    const radiusSquared = radius * radius;

    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
        const dx = x - cx;
        const dy = y - cy;

        if (dx * dx + dy * dy <= radiusSquared) {
          setPixel(x, y, color);
        }
      }
    }
  };

  const fillEllipse = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: [number, number, number]
  ) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;

        if (dx * dx + dy * dy <= 1) {
          setPixel(x, y, color);
        }
      }
    }
  };

  const fillRectPx = (
    left: number,
    top: number,
    rectWidth: number,
    rectHeight: number,
    color: [number, number, number]
  ) => {
    for (let y = top; y < top + rectHeight; y += 1) {
      for (let x = left; x < left + rectWidth; x += 1) {
        setPixel(x, y, color);
      }
    }
  };

  for (let y = 0; y < height; y += 1) {
    const rowColor = blend(candidate.photoPalette.background, candidate.photoPalette.accent, y / height);
    for (let x = 0; x < width; x += 1) {
      setPixel(x, y, rowColor);
    }
  }

  fillCircle(80, 72, 38, blend(candidate.photoPalette.skin, [255, 255, 255], 0.08));
  fillEllipse(80, 54, 42, 28, candidate.photoPalette.hair);
  fillEllipse(80, 63, 35, 17, candidate.photoPalette.hair);
  fillRectPx(58, 98, 44, 18, candidate.photoPalette.skin);
  fillEllipse(80, 158, 64, 56, candidate.photoPalette.jacket);
  fillEllipse(80, 132, 78, 36, candidate.photoPalette.jacket);
  fillRectPx(68, 102, 24, 52, candidate.photoPalette.shirt);
  fillEllipse(80, 145, 14, 28, candidate.photoPalette.accent);

  fillEllipse(66, 75, 4, 3, [52, 45, 45]);
  fillEllipse(94, 75, 4, 3, [52, 45, 45]);
  fillEllipse(80, 90, 15, 4, blend(candidate.photoPalette.hair, [140, 60, 60], 0.55));

  const shoulderGlow = blend(candidate.photoPalette.background, [255, 255, 255], 0.25);
  fillEllipse(34, 173, 26, 16, shoulderGlow);
  fillEllipse(126, 173, 26, 16, shoulderGlow);

  return {
    width,
    height,
    data: bytes,
  };
}

function createStreamObject(dictionary: string, data: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(`${dictionary}\nstream\n`, 'binary'),
    data,
    Buffer.from('\nendstream', 'binary'),
  ]);
}

function createPdfDocument(objects: Array<string | Buffer>): Buffer {
  const header = Buffer.from('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n', 'binary');
  const serializedObjects: Buffer[] = [];
  const offsets: number[] = [0];
  let offset = header.length;

  objects.forEach((objectBody, index) => {
    const bodyBuffer = typeof objectBody === 'string' ? Buffer.from(objectBody, 'binary') : objectBody;
    const serializedObject = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`, 'binary'),
      bodyBuffer,
      Buffer.from('\nendobj\n', 'binary'),
    ]);

    offsets.push(offset);
    serializedObjects.push(serializedObject);
    offset += serializedObject.length;
  });

  const xrefOffset = offset;
  const xrefLines = [
    `xref`,
    `0 ${objects.length + 1}`,
    `0000000000 65535 f `,
    ...offsets.slice(1).map((entryOffset) => `${entryOffset.toString().padStart(10, '0')} 00000 n `),
  ];

  const trailer = [
    `trailer`,
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    `startxref`,
    `${xrefOffset}`,
    `%%EOF`,
  ].join('\n');

  return Buffer.concat([
    header,
    ...serializedObjects,
    Buffer.from(`${xrefLines.join('\n')}\n${trailer}`, 'binary'),
  ]);
}

export function renderResumePdf(candidate: CandidateResume): Buffer {
  const commands: string[] = [];
  const portrait = createPortraitImage(candidate);
  const compressedPortrait = deflateSync(portrait.data);
  const sidebarColor: [number, number, number] = [24, 36, 58];
  const softTextColor: [number, number, number] = [235, 239, 245];
  const bodyTextColor: [number, number, number] = [45, 52, 63];
  const mutedTextColor: [number, number, number] = [98, 107, 122];

  drawRect(commands, 0, 0, SIDEBAR_WIDTH, PAGE_HEIGHT, sidebarColor);
  drawRect(commands, SIDEBAR_WIDTH, PAGE_HEIGHT - 134, PAGE_WIDTH - SIDEBAR_WIDTH, 134, [247, 248, 250]);
  drawRect(commands, CONTENT_LEFT, PAGE_HEIGHT - 172, CONTENT_WIDTH, 2, candidate.photoPalette.accent);

  commands.push('q');
  commands.push(`138 0 0 172 20 ${PAGE_HEIGHT - 190} cm`);
  commands.push('/Im1 Do');
  commands.push('Q');

  let sidebarCursor = 216;
  pushTextLine(commands, 'CONTACT', 20, sidebarCursor, 'F2', 12, candidate.photoPalette.accent);
  sidebarCursor += 22;
  sidebarCursor = pushWrappedText(commands, candidate.email, {
    x: 20,
    offsetFromTop: sidebarCursor,
    maxWidth: 136,
    font: 'F1',
    fontSize: 9,
    color: softTextColor,
    lineHeight: 13,
  });
  sidebarCursor += 6;
  sidebarCursor = pushWrappedText(commands, candidate.phone, {
    x: 20,
    offsetFromTop: sidebarCursor,
    maxWidth: 136,
    font: 'F1',
    fontSize: 9,
    color: softTextColor,
    lineHeight: 13,
  });
  sidebarCursor += 6;
  sidebarCursor = pushWrappedText(commands, candidate.location, {
    x: 20,
    offsetFromTop: sidebarCursor,
    maxWidth: 136,
    font: 'F1',
    fontSize: 9,
    color: softTextColor,
    lineHeight: 13,
  });
  sidebarCursor += 6;
  sidebarCursor = pushWrappedText(commands, candidate.linkedinUrl, {
    x: 20,
    offsetFromTop: sidebarCursor,
    maxWidth: 136,
    font: 'F1',
    fontSize: 9,
    color: softTextColor,
    lineHeight: 13,
    maxLines: 2,
  });

  if (candidate.portfolioUrl) {
    sidebarCursor += 6;
    sidebarCursor = pushWrappedText(commands, candidate.portfolioUrl, {
      x: 20,
      offsetFromTop: sidebarCursor,
      maxWidth: 136,
      font: 'F1',
      fontSize: 9,
      color: softTextColor,
      lineHeight: 13,
      maxLines: 2,
    });
  }

  sidebarCursor += 18;
  pushTextLine(commands, 'PROFILE', 20, sidebarCursor, 'F2', 12, candidate.photoPalette.accent);
  sidebarCursor += 22;
  pushTextLine(commands, `Age: ${candidate.age}`, 20, sidebarCursor, 'F1', 9, softTextColor);
  sidebarCursor += 16;
  pushTextLine(
    commands,
    `Experience: ${candidate.totalExperienceYears} years`,
    20,
    sidebarCursor,
    'F1',
    9,
    softTextColor
  );

  sidebarCursor += 24;
  pushTextLine(commands, 'HIGHLIGHTS', 20, sidebarCursor, 'F2', 12, candidate.photoPalette.accent);
  sidebarCursor += 20;
  candidate.highlights.slice(0, 3).forEach((highlight) => {
    sidebarCursor = pushWrappedText(commands, `- ${highlight}`, {
      x: 20,
      offsetFromTop: sidebarCursor,
      maxWidth: 136,
      font: 'F1',
      fontSize: 9,
      color: softTextColor,
      lineHeight: 13,
      maxLines: 3,
    });
    sidebarCursor += 6;
  });

  sidebarCursor += 10;
  pushTextLine(commands, 'CERTIFICATIONS', 20, sidebarCursor, 'F2', 12, candidate.photoPalette.accent);
  sidebarCursor += 20;
  candidate.certifications.slice(0, 2).forEach((certification) => {
    sidebarCursor = pushWrappedText(commands, `- ${certification}`, {
      x: 20,
      offsetFromTop: sidebarCursor,
      maxWidth: 136,
      font: 'F1',
      fontSize: 9,
      color: softTextColor,
      lineHeight: 13,
      maxLines: 2,
    });
    sidebarCursor += 6;
  });

  pushTextLine(commands, candidate.fullName, CONTENT_LEFT, 58, 'F2', 24, [26, 33, 43]);
  pushTextLine(commands, candidate.primaryRole, CONTENT_LEFT, 89, 'F1', 13, candidate.photoPalette.accent);

  let contentCursor = 140;
  pushTextLine(commands, 'PROFESSIONAL SUMMARY', CONTENT_LEFT, contentCursor, 'F2', 12, [34, 44, 57]);
  contentCursor += 20;
  contentCursor = pushWrappedText(commands, candidate.summary, {
    x: CONTENT_LEFT,
    offsetFromTop: contentCursor,
    maxWidth: CONTENT_WIDTH,
    font: 'F1',
    fontSize: 10,
    color: bodyTextColor,
    lineHeight: 15,
    maxLines: 4,
  });

  contentCursor += 18;
  pushTextLine(commands, 'WORK EXPERIENCE', CONTENT_LEFT, contentCursor, 'F2', 12, [34, 44, 57]);
  contentCursor += 22;

  candidate.experience.slice(0, 3).forEach((entry) => {
    pushTextLine(commands, `${entry.title} | ${entry.company}`, CONTENT_LEFT, contentCursor, 'F2', 10, bodyTextColor);
    contentCursor += 14;
    pushTextLine(
      commands,
      `${entry.startDate} - ${entry.endDate}`,
      CONTENT_LEFT,
      contentCursor,
      'F3',
      9,
      mutedTextColor
    );
    contentCursor += 15;

    entry.achievements.slice(0, 2).forEach((achievement) => {
      contentCursor = pushWrappedText(commands, `- ${achievement}`, {
        x: CONTENT_LEFT + 6,
        offsetFromTop: contentCursor,
        maxWidth: CONTENT_WIDTH - 6,
        font: 'F1',
        fontSize: 9,
        color: bodyTextColor,
        lineHeight: 13,
        maxLines: 2,
      });
      contentCursor += 4;
    });

    contentCursor += 8;
  });

  pushTextLine(commands, 'CORE TECHNOLOGIES', CONTENT_LEFT, contentCursor, 'F2', 12, [34, 44, 57]);
  contentCursor += 20;
  contentCursor = pushWrappedText(commands, candidate.coreTechnologies.join(' | '), {
    x: CONTENT_LEFT,
    offsetFromTop: contentCursor,
    maxWidth: CONTENT_WIDTH,
    font: 'F1',
    fontSize: 9,
    color: bodyTextColor,
    lineHeight: 13,
    maxLines: 4,
  });

  contentCursor += 18;
  pushTextLine(commands, 'EDUCATION', CONTENT_LEFT, contentCursor, 'F2', 12, [34, 44, 57]);
  contentCursor += 22;
  candidate.education.slice(0, 2).forEach((entry) => {
    pushTextLine(
      commands,
      `${entry.degree} | ${entry.institution}`,
      CONTENT_LEFT,
      contentCursor,
      'F2',
      10,
      bodyTextColor
    );
    contentCursor += 14;
    pushTextLine(
      commands,
      `${entry.location} | ${entry.startYear} - ${entry.endYear}`,
      CONTENT_LEFT,
      contentCursor,
      'F1',
      9,
      mutedTextColor
    );
    contentCursor += 20;
  });

  pushTextLine(commands, 'LANGUAGES', CONTENT_LEFT, contentCursor, 'F2', 12, [34, 44, 57]);
  contentCursor += 20;
  pushWrappedText(
    commands,
    candidate.spokenLanguages.map((language) => `${language.name} (${language.level})`).join(' | '),
    {
      x: CONTENT_LEFT,
      offsetFromTop: contentCursor,
      maxWidth: CONTENT_WIDTH,
      font: 'F1',
      fontSize: 9,
      color: bodyTextColor,
      lineHeight: 13,
      maxLines: 2,
    }
  );

  pushTextLine(
    commands,
    `Candidate ID: ${candidate.id}`,
    CONTENT_LEFT,
    804,
    'F1',
    8,
    mutedTextColor
  );

  const contentStream = Buffer.from(commands.join('\n'), 'binary');
  const compressedContent = deflateSync(contentStream);

  const objects: Array<string | Buffer> = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> /XObject << /Im1 7 0 R >> >> /Contents 8 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>',
    createStreamObject(
      `<< /Type /XObject /Subtype /Image /Width ${portrait.width} /Height ${portrait.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressedPortrait.length} >>`,
      compressedPortrait
    ),
    createStreamObject(
      `<< /Length ${compressedContent.length} /Filter /FlateDecode >>`,
      compressedContent
    ),
  ];

  return createPdfDocument(objects);
}
