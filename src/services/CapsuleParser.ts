// Service to parse capsule markdown content
//
// Règle code couleur (annotations / rendu) :
// - Bleu : supprimer (doublon ou élément à retirer) — appliqué en tête d'explication si = bonne réponse
// - Jaune : grand rectangle à bordure orange (►! en markdown) — juste milieu : visible mais pas criard (ex. border-[#d4a574])
// - Rouge : grand rectangle à bordure grise (► en markdown)
// - Vert : petit badge inline gris ([[...]] en markdown)
// - Rose : saut de ligne (ligne vide entre les phrases dans le markdown)
// - Marron : grand rectangle à bordure verte (►# en markdown)
// - Bleu : grand rectangle à bordure bleue (►@ en markdown) — noms de plateformes

export interface Block {
  number: number;
  title: string;
  content: string;
}

export interface Question {
  number: number;
  total: number;
  question: string;
  options: Array<{ letter: string; text: string }>;
}

export interface Explanation {
  correctAnswer: string;
  correctLetter: string;
  explanation: string;
  whyOthersWrong: string[];
  additionalInfo: string[];
  toRemember: string;
}

// Parse markdown to extract blocks
export const parseCapsule = (markdownText: string): Block[] => {
  const blocks: Block[] = [];
  // Strip BOM and normalize line endings: remove \r (Windows line endings) and split by \n
  const normalizedText = markdownText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split('\n');
  let currentBlock: { number: number; title: string } | null = null;
  let currentContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    // Remove trailing \r and whitespace, but keep leading spaces (for content indentation)
    const rawLine = lines[i];
    const line = rawLine.replace(/\r$/, '').trimEnd();
    
    // Check if line is a block header (## Bloc X - ...)
    // Pattern must match:
    // - "## Bloc 1 -🎯 Objectif" (no space after dash)
    // - "## Bloc 1 - 🎯 Objectif" (space after dash)
    // - "## Bloc 3 - 📘 Qu'est-ce" (space after dash)
    // The \s* after dash allows zero or more spaces
    // Allow optional leading whitespace before ##
    // Use .* instead of .+ to allow empty titles; accept hyphen, en-dash (U+2013), em-dash (U+2014)
    const blockMatch = line.match(/^\s*##\s*Bloc\s+(\d+)\s*[-\u2013\u2014]\s*(.*)/);
    
    // Debug: log lines that contain "## Bloc" but don't match
    if (line.includes('## Bloc') && !blockMatch && i < 20) {
      console.log(`Line ${i + 1} contains "## Bloc" but doesn't match:`, JSON.stringify(line));
      console.log(`Line length: ${line.length}, First 50 chars:`, line.substring(0, 50));
    }
    
    if (blockMatch) {
      const blockNumber = parseInt(blockMatch[1]);
      const blockTitle = blockMatch[2].trim();
      
      // Validate that we have a valid block number and title
      if (isNaN(blockNumber) || !blockTitle) {
        console.warn(`Invalid block header at line ${i + 1}: ${line}`);
        // Continue to next line
        if (currentBlock !== null) {
          currentContent.push(rawLine);
        }
        continue;
      }
      
      // Save previous block if exists
      if (currentBlock !== null) {
        blocks.push({
          ...currentBlock,
          content: currentContent.join('\n').trim()
        });
      }
      
      // Start new block
      currentBlock = {
        number: blockNumber,
        title: blockTitle
      };
      currentContent = [];
    } else if (currentBlock !== null) {
      // Add line to current block content (preserve original line, not trimmed)
      currentContent.push(lines[i]);
    }
  }
  
  // Save last block
  if (currentBlock !== null) {
    blocks.push({
      ...currentBlock,
      content: currentContent.join('\n').trim()
    });
  }
  
  console.log(`parseCapsule: parsed ${blocks.length} blocks from ${lines.length} lines`);
  if (blocks.length === 0 && lines.length > 0) {
    console.warn('No blocks found! First few lines:', lines.slice(0, 10).map(l => JSON.stringify(l)));
    console.warn('Looking for pattern: ## Bloc X -');
    // Try to find any line that looks like a block header
    const potentialHeaders = lines.filter(l => l.includes('## Bloc'));
    if (potentialHeaders.length > 0) {
      console.warn('Found potential block headers:', potentialHeaders.slice(0, 5).map(l => JSON.stringify(l)));
    }
  }
  
  return blocks;
};

// Parse question from block content
export const parseQuestion = (text: string): Question | null => {
  const lines = text.split('\n').filter(l => l.trim());
  const questionText = lines.find(l => l.includes('Question') && l.includes('sur'));
  const questionMatch = questionText ? questionText.match(/Question\s+(\d+)\s+sur\s+(\d+)/) : null;
  
  // Find the actual question (line after "Question X sur Y")
  let questionStartIndex = 0;
  if (questionMatch) {
    questionStartIndex = lines.findIndex(l => l.includes('Question')) + 1;
  }
  
  const question = lines[questionStartIndex] || '';
  const options: Array<{ letter: string; text: string }> = [];
  
  // Find options (lines starting with a), b), c))
  for (let i = questionStartIndex + 1; i < lines.length; i++) {
    const optionMatch = lines[i].match(/^([a-d])\)\s*(.+)$/);
    if (optionMatch) {
      options.push({ letter: optionMatch[1], text: optionMatch[2] });
    }
  }
  
  if (!question || options.length === 0) {
    return null;
  }
  
  return {
    number: questionMatch ? parseInt(questionMatch[1]) : 1,
    total: questionMatch ? parseInt(questionMatch[2]) : 3,
    question: question,
    options: options
  };
};

// Parse explanation from block content
export const parseExplanation = (text: string): Explanation => {
  const lines = text.split('\n');
  const explanation: Explanation = {
    correctAnswer: '',
    correctLetter: '',
    explanation: '',
    whyOthersWrong: [],
    additionalInfo: [],
    toRemember: ''
  };

  // Si le contenu n'a ni "Réponse correcte" ni "Explication :", tout le texte est l'explication (ex. leçon 8 après simplification du markdown)
  const trimmed = text.trim();
  if (trimmed && !trimmed.includes('Réponse correcte') && !trimmed.includes('Bonne réponse') && !trimmed.includes('Explication :')) {
    explanation.explanation = trimmed;
    return explanation;
  }
  
  let currentSection: 'correctAnswer' | 'explanation' | 'skipWhyOthersWrong' | 'additionalInfo' | 'toRemember' = 'correctAnswer';
  let currentContent: string[] = [];
  
  lines.forEach(line => {
    const trimmedLine = line.trim();
    
    // Detect correct answer ("Réponse correcte" or "Bonne réponse" for capsule 5)
    if (trimmedLine.includes('Réponse correcte') || trimmedLine.includes('Bonne réponse')) {
      const match = trimmedLine.match(/(?:Réponse correcte|Bonne réponse)\s*:\s*([a-d])\)\s*(.+)/);
      if (match) {
        explanation.correctLetter = match[1];
        // Extract only the answer text, not the explanation
        let answerText = match[2];
        const explIndex = answerText.search(/\s*Explication\s*:/i);
        if (explIndex !== -1) {
          answerText = answerText.substring(0, explIndex).trim();
        }
        explanation.correctAnswer = answerText.trim();
        currentSection = 'explanation';
        currentContent = [];
        // Ne pousser que le texte après "Explication :" si présent sur la même ligne (jamais la réponse seule)
        if (explIndex !== -1) {
          const afterExpl = match[2].substring(explIndex).replace(/\s*Explication\s*:\s*/i, '').trim();
          if (afterExpl) {
            currentContent.push(afterExpl);
          }
        }
        return;
      }
    }
    
    // Detect "Explication :" - but only if we're not already in explanation section. Capture text after colon.
    if (trimmedLine.includes('Explication :') && currentSection !== 'explanation') {
      currentSection = 'explanation';
      currentContent = [];
      const afterExpl = trimmedLine.replace(/^.*Explication\s*:\s*/i, '').trim();
      if (afterExpl) currentContent.push(afterExpl);
      return;
    }
    
    // Detect "Pourquoi les autres réponses sont fausses" uniquement - flush et skip. Avec "incorrectes" on garde tout dans l'explication (une seule carte).
    if (trimmedLine.includes('Pourquoi les autres réponses sont fausses')) {
      if (currentSection === 'explanation' && currentContent.length > 0) {
        explanation.explanation = currentContent.join('\n').trim();
      }
      currentSection = 'skipWhyOthersWrong';
      currentContent = [];
      return;
    }
    
    // Detect "À retenir" - must be checked before skip mode
    if (trimmedLine.includes('À retenir')) {
      if (currentSection === 'explanation' && currentContent.length > 0) {
        explanation.explanation = currentContent.join('\n').trim();
      } else if (currentSection === 'additionalInfo' && currentContent.length > 0) {
        explanation.additionalInfo.push(currentContent.join('\n').trim());
      } else if (currentSection === 'skipWhyOthersWrong') {
        // Exit skip mode and go to toRemember
        currentSection = 'toRemember';
        currentContent = [trimmedLine];
        return;
      }
      currentSection = 'toRemember';
      currentContent = [];
      return;
    }
    
    // Skip mode: ignore lines that are answers (a), b), c)) or empty lines
    // But keep examples that come after
    if (currentSection === 'skipWhyOthersWrong') {
      // Check if this is an answer line (a), b), c)) - skip it
      if (trimmedLine.match(/^([a-d])\)\s*/)) {
        return;
      }
      
      // Check if this is an example or additional info
      if (trimmedLine.match(/^(Exemple concret|Exemple|Point important|Note|Remarque)/i)) {
        // Found example/info - switch to additionalInfo section
        currentSection = 'additionalInfo';
        currentContent = [trimmedLine];
        return;
      }
      
      // If line is not empty and not an answer, it's additional info
      if (trimmedLine && !trimmedLine.match(/^([a-d])\)/)) {
        currentSection = 'additionalInfo';
        currentContent = [trimmedLine];
        return;
      }
      
      // Skip empty lines
      return;
    }
    
    // Detect "Exemple concret" or similar additional info
    if (trimmedLine.match(/^(Exemple concret|Exemple|Point important|Note|Remarque)/i)) {
      if (currentSection === 'explanation' && currentContent.length > 0) {
        explanation.explanation = currentContent.join('\n').trim();
      }
      currentSection = 'additionalInfo';
      currentContent = [trimmedLine];
      return;
    }
    
    // Skip empty lines at section boundaries
    if (!trimmedLine) {
      return;
    }
    
    // Ne pas inclure une ligne qui répète "Réponse correcte" / "Bonne réponse" avec la même réponse (éviter doublon affiché)
    if (currentSection === 'explanation' && (trimmedLine.includes('Réponse correcte') || trimmedLine.includes('Bonne réponse'))) {
      const afterPrefix = trimmedLine.replace(/^[^\:]*(?:Réponse correcte|Bonne réponse)\s*:\s*([a-d]\)\s*)?/i, '').trim();
      if (afterPrefix === explanation.correctAnswer.trim()) {
        return;
      }
    }
    
    // Regular content
    if (trimmedLine) {
      currentContent.push(line);
    }
  });
  
  // Save remaining content
  if (currentSection === 'explanation' && currentContent.length > 0) {
    let explText = currentContent.join('\n').trim();
    const correctTrimmed = explanation.correctAnswer.trim();
    if (correctTrimmed) {
      const lines = explText.split('\n');
      const rest: string[] = [];
      for (const line of lines) {
        const t = line.trim();
        // Supprimer toute ligne qui répète la bonne réponse seule, ou "Réponse correcte" / "Bonne réponse" (éviter doublon)
        if (t === correctTrimmed) continue;
        if (t.includes('Réponse correcte') || t.includes('Bonne réponse')) {
          const afterPrefix = t.replace(/^[^\:]*(?:Réponse correcte|Bonne réponse)\s*:\s*([a-d]\)\s*)?/i, '').trim();
          if (afterPrefix === correctTrimmed) continue;
        }
        rest.push(line);
      }
      explText = rest.join('\n').trim();
    }
    explanation.explanation = explText;
  } else if (currentSection === 'whyOthersWrong' && currentContent.length > 0) {
    explanation.whyOthersWrong.push(currentContent.join('\n').trim());
  } else if (currentSection === 'additionalInfo' && currentContent.length > 0) {
    explanation.additionalInfo.push(currentContent.join('\n').trim());
  } else if (currentSection === 'toRemember' && currentContent.length > 0) {
    explanation.toRemember = currentContent.join('\n').trim();
  }
  
  return explanation;
};

// Segment for rendering: text, image (markdown ![](url)), or pill (inner capsule, line starting with ► or ►! for orange)
export type ContentSegment =
  | { type: 'text'; value: string }
  | { type: 'image'; alt: string; src: string }
  | { type: 'pill'; value: string; variant?: 'gray' | 'orange' | 'green' | 'blue' };

const IMAGE_MARKDOWN_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
// U+25BA = ► (black right-pointing pointer) — utiliser le code pour éviter soucis d'encodage dans les explications
const TRI = '\u25BA';
// Ligne qui commence par ►# = sous-capsule verte (marron en annotation)
const GREEN_PILL_LINE_RE = new RegExp(`^\\s*${TRI}#\\s*(.+)$`);
// Ligne qui commence par ►! = sous-capsule orange (attention / avertissement)
const ORANGE_PILL_LINE_RE = new RegExp(`^\\s*${TRI}!\\s*(.+)$`);
// Ligne qui commence par ► = sous-capsule grise (pas ►! ni ►# ni ►@)
const PILL_LINE_RE = new RegExp(`^\\s*${TRI}(?!#|!|@)\\s*(.+)$`);
// Ligne qui commence par ►@ = sous-capsule bleue (noms de plateformes)
const BLUE_PILL_LINE_RE = new RegExp(`^\\s*${TRI}@\\s*(.+)$`);

// Gray pills (►) can be multi-line: following lines that don't start with ►/►!/►#/►@ are part of the pill until a blank line or next pill.
function splitTextWithPills(text: string): Array<{ type: 'text' | 'pill'; value: string; variant?: 'gray' | 'orange' | 'green' | 'blue' }> {
  const out: Array<{ type: 'text' | 'pill'; value: string; variant?: 'gray' | 'orange' | 'green' | 'blue' }> = [];
  const lines = text.split('\n');
  let textBuf: string[] = [];
  const flushText = () => {
    if (textBuf.length) {
      const joined = textBuf.join('\n').trim();
      if (joined) out.push({ type: 'text', value: joined });
      textBuf = [];
    }
  };
  const isNewPillLine = (s: string) => new RegExp(`^\\s*${TRI}#\\s`).test(s) || new RegExp(`^\\s*${TRI}!\\s`).test(s) || new RegExp(`^\\s*${TRI}@\\s`).test(s) || new RegExp(`^\\s*${TRI}\\s`).test(s);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const normalizedLine = line.replace(/\r/g, '').trim();
    const greenMatch = normalizedLine.match(GREEN_PILL_LINE_RE);
    const orangeMatch = normalizedLine.match(ORANGE_PILL_LINE_RE);
    const blueMatch = normalizedLine.match(BLUE_PILL_LINE_RE);
    const pillMatch = normalizedLine.match(PILL_LINE_RE);
    if (greenMatch) {
      flushText();
      out.push({ type: 'pill', value: greenMatch[1].replace(/\r/g, '').trim(), variant: 'green' });
    } else if (orangeMatch) {
      flushText();
      out.push({ type: 'pill', value: orangeMatch[1].replace(/\r/g, '').trim(), variant: 'orange' });
    } else if (blueMatch) {
      flushText();
      out.push({ type: 'pill', value: blueMatch[1].replace(/\r/g, '').trim(), variant: 'blue' });
    } else if (pillMatch) {
      flushText();
      const pillLines: string[] = [pillMatch[1].replace(/\r/g, '').trim()];
      while (i + 1 < lines.length) {
        const next = lines[i + 1].replace(/\r/g, '').trim();
        if (next === '' || isNewPillLine(lines[i + 1])) break;
        // Ne pas inclure dans la pill les lignes qui commencent un nouveau paragraphe (ex. bloc 15 leçon 3)
        if (next.match(/^(Ton |Pour )/)) break;
        pillLines.push(next);
        i++;
      }
      out.push({ type: 'pill', value: pillLines.join('\n\n'), variant: 'gray' });
    } else {
      textBuf.push(normalizedLine);
    }
  }
  flushText();
  return out;
}

/** Splits content into text, image, and pill segments. Pills are lines starting with ► in the markdown. */
export const parseContentWithImages = (text: string): ContentSegment[] => {
  if (!text?.trim()) return [];
  const rawSegments: ContentSegment[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  IMAGE_MARKDOWN_RE.lastIndex = 0;
  while ((m = IMAGE_MARKDOWN_RE.exec(text)) !== null) {
    if (m.index > lastIndex) {
      const raw = text.slice(lastIndex, m.index).trim();
      if (raw) rawSegments.push({ type: 'text', value: raw });
    }
    let src = m[2].trim();
    if (src.startsWith('../')) src = '/assets/' + src.replace(/^\.\.\/images\//, '').replace(/^\.\.\/assets\//, '');
    else if (src.startsWith('images/')) src = '/assets/' + src.slice(7);
    rawSegments.push({ type: 'image', alt: (m[1] || '').trim(), src });
    lastIndex = IMAGE_MARKDOWN_RE.lastIndex;
  }
  if (lastIndex < text.length) {
    const raw = text.slice(lastIndex).trim();
    if (raw) rawSegments.push({ type: 'text', value: raw });
  }
  const segments = rawSegments.length ? rawSegments : [{ type: 'text' as const, value: text }];

  // Expand text segments into text + pill where lines start with ►
  const result: ContentSegment[] = [];
  for (const seg of segments) {
    if (seg.type !== 'text') {
      result.push(seg);
      continue;
    }
    const expanded = splitTextWithPills(seg.value);
    for (const e of expanded) result.push(e);
  }
  return result.length ? result : [{ type: 'text', value: text }];
};

// Format content - single box per block with each phrase on separate line
export const formatContent = (text: string): string[] => {
  if (!text) return [];
  const lines = text.split('\n');
  const phrases: string[] = [];
  const seenLines = new Set<string>(); // Track seen lines to avoid duplicates

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      return;
    }

    // Remove list markers and indentation
    let cleanLine = trimmedLine;
    // Remove list markers
    cleanLine = cleanLine.replace(/^[-•]\s+/, '');
    cleanLine = cleanLine.replace(/^\d+\.\s+/, '');
    // Remove indentation (4 spaces = list item)
    cleanLine = cleanLine.replace(/^\s{4,}/, '');
    
    // Skip if empty after cleaning
    if (!cleanLine) {
      return;
    }

    // Check for checkboxes (✅) - keep them
    if (cleanLine.includes('✅')) {
      const content = cleanLine.replace(/✅\s*/, '').trim();
      if (content && !seenLines.has(content)) {
        seenLines.add(content);
        phrases.push(`✅ ${content}`);
      }
      return;
    }

    // If line ends with comma, remove it (it's part of a list)
    if (cleanLine.endsWith(',')) {
      cleanLine = cleanLine.replace(/,$/, '').trim();
    }

    // Add phrase if not duplicate
    if (cleanLine && !seenLines.has(cleanLine)) {
      seenLines.add(cleanLine);
      phrases.push(cleanLine);
    }
  });

  return phrases;
};

// Load capsule from markdown file
export const loadCapsule = async (capsuleId: number): Promise<Block[]> => {
  try {
    // In Vite, files in public/ are served from root
    const url = `/capsules/capsule${capsuleId}.md`;
    console.log(`Attempting to load capsule ${capsuleId} from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to load capsule ${capsuleId}: ${response.status} ${response.statusText}`);
      console.error(`URL attempted: ${url}`);
      throw new Error(`Failed to load capsule ${capsuleId}: ${response.status}`);
    }
    const markdownText = await response.text();
    console.log(`Fetched capsule ${capsuleId}, text length: ${markdownText.length}`);
    
    if (!markdownText || markdownText.trim().length === 0) {
      console.error(`Capsule ${capsuleId} is empty`);
      return [];
    }
    
    const blocks = parseCapsule(markdownText);
    console.log(`Parsed capsule ${capsuleId} with ${blocks.length} blocks`);
    
    if (blocks.length === 0) {
      console.error(`No blocks parsed from capsule ${capsuleId}`);
      console.log(`First 500 chars of markdown:`, markdownText.substring(0, 500));
    }
    
    return blocks;
  } catch (error) {
    console.error(`Error loading capsule ${capsuleId}:`, error);
    if (error instanceof Error) {
      console.error(`Error message: ${error.message}`);
    }
    return [];
  }
};

