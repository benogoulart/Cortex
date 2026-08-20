import { execSync } from "node:child_process";
import type {
  ProjectIndex,
  ReviewResult,
  ReviewFinding,
  ReviewSeverity,
  ReviewCategory,
  DiffHunk,
  DiffSummary,
  FileEntry,
} from "../types/index.js";

export function getDiff(root: string, target?: string): string {
  const ref = target ?? "HEAD";
  try {
    return execSync(`git diff ${ref}`, {
      cwd: root,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

export function getStagedDiff(root: string): string {
  try {
    return execSync("git diff --cached", {
      cwd: root,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

export function parseDiff(diffOutput: string): { summary: DiffSummary; hunks: DiffHunk[] } {
  const files: DiffSummary["files"] = [];
  const hunks: DiffHunk[] = [];

  const fileBlocks = diffOutput.split(/^diff --git /m).filter((b) => b.trim());

  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const block of fileBlocks) {
    const headerMatch = block.match(/^a\/(.+?)\s+b\/(.+)/m);
    if (!headerMatch) continue;

    const filePath = headerMatch[2];
    const additions = (block.match(/^\+[^+]/gm) || []).length;
    const deletions = (block.match(/^-[^-]/gm) || []).length;

    totalAdditions += additions;
    totalDeletions += deletions;

    let status: "added" | "modified" | "deleted" | "renamed" = "modified";
    if (block.match(/^new file/m)) status = "added";
    else if (block.match(/^deleted file/m)) status = "deleted";
    else if (block.match(/^rename from/m)) status = "renamed";

    files.push({ file: filePath, additions, deletions, status });

    const hunkLines: DiffHunk["lines"] = [];
    const lines = block.split("\n");
    let lineNum = 0;

    for (const line of lines) {
      if (line.startsWith("@@")) {
        const rangeMatch = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
        if (rangeMatch) lineNum = parseInt(rangeMatch[1], 10);
        continue;
      }

      if (line.startsWith("+") && !line.startsWith("+++")) {
        hunkLines.push({ type: "add", content: line.slice(1), lineNum });
        lineNum++;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        hunkLines.push({ type: "remove", content: line.slice(1), lineNum });
      } else if (line.startsWith(" ")) {
        hunkLines.push({ type: "context", content: line.slice(1), lineNum });
        lineNum++;
      }
    }

    if (hunkLines.length > 0) {
      hunks.push({ file: filePath, additions, deletions, lines: hunkLines });
    }
  }

  return {
    summary: { files, totalAdditions, totalDeletions },
    hunks,
  };
}

export function reviewDiff(
  index: ProjectIndex | null,
  diffOutput: string
): ReviewResult {
  const { summary, hunks } = parseDiff(diffOutput);
  const findings: ReviewFinding[] = [];

  checkArchitecture(findings, hunks, index);
  checkSecurity(findings, hunks);
  checkTesting(findings, hunks, index);
  checkComplexity(findings, hunks, index);
  checkQuality(findings, hunks);

  const critical = findings.filter((f) => f.severity === "critical").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const info = findings.filter((f) => f.severity === "info").length;

  const score = computeReviewScore(findings, summary);

  return {
    summary,
    findings,
    score,
    stats: {
      filesChanged: summary.files.length,
      totalFindings: findings.length,
      critical,
      warnings,
      info,
    },
  };
}

function checkArchitecture(
  findings: ReviewFinding[],
  hunks: DiffHunk[],
  index: ProjectIndex | null
): void {
  for (const hunk of hunks) {
    const addedLines = hunk.lines.filter((l) => l.type === "add");

    for (const line of addedLines) {
      const content = line.content.trim();

      if (isControllerFile(hunk.file)) {
        if (matchesPattern(content, /import.*Repository/i)) {
          findings.push({
            id: generateFindingId(),
            severity: "critical",
            category: "architecture",
            file: hunk.file,
            line: line.lineNum,
            message: "Controller imports a Repository directly",
            suggestion: "Use a Service layer between Controller and Repository",
          });
        }

        if (matchesPattern(content, /import.*(?:knex|prisma|sequelize|typeorm|mongoose)/i)) {
          findings.push({
            id: generateFindingId(),
            severity: "critical",
            category: "architecture",
            file: hunk.file,
            line: line.lineNum,
            message: "Controller imports database client directly",
            suggestion: "Abstract database access behind a Repository or Service",
          });
        }
      }

      if (isTestFile(hunk.file)) return;

      if (matchesPattern(content, /require\s*\(\s*['"]child_process['"]\)/) ||
          matchesPattern(content, /from\s+['"]child_process['"]/)) {
        findings.push({
          id: generateFindingId(),
          severity: "warning",
          category: "architecture",
          file: hunk.file,
          line: line.lineNum,
          message: "Direct use of child_process detected",
          suggestion: "Consider using a safer alternative or validating inputs",
        });
      }

      if (matchesPattern(content, /eval\s*\(/)) {
        findings.push({
          id: generateFindingId(),
          severity: "critical",
          category: "architecture",
          file: hunk.file,
          line: line.lineNum,
          message: "Use of eval() detected",
          suggestion: "Avoid eval() — use safer alternatives like Function constructor or JSON.parse",
        });
      }
    }
  }
}

function checkSecurity(findings: ReviewFinding[], hunks: DiffHunk[]): void {
  const secretPatterns = [
    { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/i, message: "Hardcoded password detected" },
    { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]+['"]/i, message: "Hardcoded API key detected" },
    { pattern: /(?:secret|token)\s*[:=]\s*['"][^'"]+['"]/i, message: "Hardcoded secret/token detected" },
    { pattern: /(?:AWS_ACCESS_KEY|AWS_SECRET)\s*[:=]\s*['"][^'"]+['"]/i, message: "AWS credential detected" },
    { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, message: "Private key detected in code" },
  ];

  const dangerousPatterns = [
    { pattern: /innerHTML\s*=/, message: "Direct innerHTML assignment (XSS risk)" },
    { pattern: /dangerouslySetInnerHTML/, message: "dangerouslySetInnerHTML usage (XSS risk)" },
    { pattern: /document\.write\s*\(/, message: "document.write() usage (XSS risk)" },
    { pattern: /\$\{.*\}.*(?:query|exec|execute)/i, message: "Potential SQL injection — string interpolation in query" },
    { pattern: /(?:exec|execSync|spawn)\s*\(\s*[^)]*\$\{/i, message: "Command injection risk — template literal in exec" },
  ];

  for (const hunk of hunks) {
    const addedLines = hunk.lines.filter((l) => l.type === "add");

    for (const line of addedLines) {
      const content = line.content.trim();

      for (const { pattern, message } of secretPatterns) {
        if (pattern.test(content)) {
          findings.push({
            id: generateFindingId(),
            severity: "critical",
            category: "security",
            file: hunk.file,
            line: line.lineNum,
            message,
            suggestion: "Use environment variables or a secrets manager",
          });
        }
      }

      for (const { pattern, message } of dangerousPatterns) {
        if (pattern.test(content)) {
          findings.push({
            id: generateFindingId(),
            severity: "warning",
            category: "security",
            file: hunk.file,
            line: line.lineNum,
            message,
          });
        }
      }
    }
  }
}

function checkTesting(
  findings: ReviewFinding[],
  hunks: DiffHunk[],
  index: ProjectIndex | null
): void {
  const sourceFiles = hunks.filter(
    (h) => !isTestFile(h.file) && isSourceFile(h.file)
  );

  const testFiles = hunks.filter((h) => isTestFile(h.file));

  const newFunctions: { file: string; name: string; line: number }[] = [];

  for (const hunk of sourceFiles) {
    const addedLines = hunk.lines.filter((l) => l.type === "add");

    for (const line of addedLines) {
      const content = line.content.trim();

      const fnMatch = content.match(
        /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/
      );
      if (fnMatch) {
        newFunctions.push({
          file: hunk.file,
          name: fnMatch[1],
          line: line.lineNum,
        });
      }

      const constFnMatch = content.match(
        /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?(?:\(|function)/
      );
      if (constFnMatch) {
        newFunctions.push({
          file: hunk.file,
          name: constFnMatch[1],
          line: line.lineNum,
        });
      }

      const classMatch = content.match(
        /^(?:export\s+)?class\s+(\w+)/
      );
      if (classMatch) {
        newFunctions.push({
          file: hunk.file,
          name: classMatch[1],
          line: line.lineNum,
        });
      }
    }
  }

  if (newFunctions.length > 0 && testFiles.length === 0) {
    for (const fn of newFunctions) {
      findings.push({
        id: generateFindingId(),
        severity: "warning",
        category: "testing",
        file: fn.file,
        line: fn.line,
        message: `New ${fn.name}() has no corresponding test`,
        suggestion: `Add tests for ${fn.name} in a test file`,
      });
    }
  }

  const modifiedFunctions = new Set<string>();
  for (const hunk of sourceFiles) {
    const addedLines = hunk.lines.filter((l) => l.type === "add");
    for (const line of addedLines) {
      const match = line.content.trim().match(
        /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/
      );
      if (match) modifiedFunctions.add(match[1]);
    }
  }

  const testContent = testFiles
    .flatMap((h) => h.lines.filter((l) => l.type === "add"))
    .map((l) => l.content)
    .join("\n");

  for (const fn of modifiedFunctions) {
    if (!testContent.includes(fn)) {
      const srcFile = sourceFiles.find((h) =>
        h.lines.some(
          (l) =>
            l.type === "add" &&
            l.content.includes(`function ${fn}`)
        )
      );
      if (srcFile) {
        findings.push({
          id: generateFindingId(),
          severity: "info",
          category: "testing",
          file: srcFile.file,
          message: `Modified function ${fn} may need updated tests`,
        });
      }
    }
  }
}

function checkComplexity(
  findings: ReviewFinding[],
  hunks: DiffHunk[],
  index: ProjectIndex | null
): void {
  for (const hunk of hunks) {
    const addedLines = hunk.lines.filter((l) => l.type === "add");
    if (addedLines.length < 20) continue;

    findings.push({
      id: generateFindingId(),
      severity: addedLines.length > 50 ? "warning" : "info",
      category: "complexity",
      file: hunk.file,
      message: `Large addition: ${addedLines.length} lines added in one hunk`,
      suggestion: "Consider breaking into smaller functions or components",
    });

    const depthIndicators = addedLines.filter((l) => {
      const content = l.content;
      const indent = content.length - content.trimStart().length;
      return indent >= 16;
    });

    if (depthIndicators.length > 3) {
      findings.push({
        id: generateFindingId(),
        severity: "warning",
        category: "complexity",
        file: hunk.file,
        message: `Deep nesting detected (${depthIndicators.length} deeply indented lines)`,
        suggestion: "Extract nested logic into separate functions",
      });
    }
  }
}

function checkQuality(findings: ReviewFinding[], hunks: DiffHunk[]): void {
  for (const hunk of hunks) {
    const addedLines = hunk.lines.filter((l) => l.type === "add");

    for (const line of addedLines) {
      const content = line.content;

      if (content.length > 120) {
        findings.push({
          id: generateFindingId(),
          severity: "info",
          category: "quality",
          file: hunk.file,
          line: line.lineNum,
          message: `Line exceeds 120 characters (${content.length})`,
        });
      }

      if (matchesPattern(content, /console\.(log|debug|info)\s*\(/)) {
        if (!isTestFile(hunk.file)) {
          findings.push({
            id: generateFindingId(),
            severity: "info",
            category: "quality",
            file: hunk.file,
            line: line.lineNum,
            message: "Console statement in production code",
            suggestion: "Use a proper logging library instead",
          });
        }
      }

      if (matchesPattern(content, /(?:TODO|FIXME|HACK|XXX)\b/)) {
        findings.push({
          id: generateFindingId(),
          severity: "info",
          category: "quality",
          file: hunk.file,
          line: line.lineNum,
          message: "TODO/FIXME comment found in new code",
        });
      }

      if (matchesPattern(content, /any(?:\s|;|,|\))/ ) && !matchesPattern(content, /\/\/.*any/)) {
        if (matchesPattern(content, /:\s*any\b/) || matchesPattern(content, /as\s+any\b/)) {
          findings.push({
            id: generateFindingId(),
            severity: "info",
            category: "quality",
            file: hunk.file,
            line: line.lineNum,
            message: "TypeScript `any` type usage",
            suggestion: "Replace with a more specific type",
          });
        }
      }
    }
  }
}

function computeReviewScore(
  findings: ReviewFinding[],
  summary: DiffSummary
): number {
  let score = 100;

  for (const f of findings) {
    switch (f.severity) {
      case "critical": score -= 15; break;
      case "warning": score -= 5; break;
      case "info": score -= 1; break;
    }
  }

  const churn = summary.totalAdditions + summary.totalDeletions;
  if (churn > 500) score -= 10;
  else if (churn > 200) score -= 5;

  return Math.max(0, Math.min(100, score));
}

function isControllerFile(file: string): boolean {
  return /(?:controller|route|handler|endpoint)/i.test(file);
}

function isTestFile(file: string): boolean {
  return /(?:test|spec|__tests__|\.test\.|\.spec\.)/i.test(file);
}

function isSourceFile(file: string): boolean {
  return /\.(?:ts|tsx|js|jsx)$/.test(file) && !isTestFile(file);
}

function matchesPattern(str: string, pattern: RegExp): boolean {
  return pattern.test(str);
}

function generateFindingId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "find_";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
