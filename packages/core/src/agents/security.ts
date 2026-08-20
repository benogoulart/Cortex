import type { AgentContext, Agent } from "./types.js";
import type {
  AgentFinding,
  SecurityReport,
  SecurityFinding,
  OwaspGroup,
  EndpointInfo,
  FileEntry,
} from "../types/index.js";
import { readFileSync } from "node:fs";

let findingCounter = 0;
function fid(): string {
  return `sec_${++findingCounter}`;
}

const SECRET_PATTERNS: { pattern: RegExp; type: string; owasp: string }[] = [
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/i, type: "hardcoded-password", owasp: "A07:2021" },
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]+['"]/i, type: "hardcoded-api-key", owasp: "A07:2021" },
  { pattern: /(?:secret|token)\s*[:=]\s*['"][^'"]+['"]/i, type: "hardcoded-secret", owasp: "A07:2021" },
  { pattern: /(?:AWS_ACCESS_KEY|AWS_SECRET)\s*[:=]\s*['"][^'"]+['"]/i, type: "aws-credential", owasp: "A07:2021" },
  { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, type: "private-key", owasp: "A07:2021" },
  { pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]+:[^\s'"]+@/i, type: "connection-string", owasp: "A07:2021" },
  { pattern: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/, type: "jwt-token", owasp: "A07:2021" },
];

const DANGEROUS_PATTERNS: { pattern: RegExp; type: string; owasp: string }[] = [
  { pattern: /innerHTML\s*=/, type: "xss-innerhtml", owasp: "A03:2021" },
  { pattern: /dangerouslySetInnerHTML/, type: "xss-dangerous-html", owasp: "A03:2021" },
  { pattern: /document\.write\s*\(/, type: "xss-document-write", owasp: "A03:2021" },
  { pattern: /eval\s*\(/, type: "code-injection-eval", owasp: "A03:2021" },
  { pattern: /\$\{[^}]+\}.*(?:query|exec|execute)/i, type: "sql-injection", owasp: "A03:2021" },
  { pattern: /(?:exec|execSync|spawn)\s*\(\s*[^)]*\$\{/i, type: "command-injection", owasp: "A03:2021" },
  { pattern: /readFile(?:Sync)?\s*\(\s*(?:req\.|input|user|param|query)/i, type: "path-traversal", owasp: "A01:2021" },
  { pattern: /(?:Math\.random|Date\.now)\s*(?:\/|%|[*])\s*(?:token|key|secret|session)/i, type: "weak-random", owasp: "A02:2021" },
  { pattern: /(?:md5|sha1)\s*\(/i, type: "weak-hash", owasp: "A02:2021" },
  { pattern: /new\s+RegExp\s*\(\s*(?:req\.|input|user|param)/i, type: "regex-injection", owasp: "A03:2021" },
];

const CRYPTO_WEAK: { pattern: RegExp; type: string }[] = [
  { pattern: /(?:md5|sha1)\s*\(/i, type: "weak-crypto" },
  { pattern: /Math\.random\s*\(\)/, type: "insecure-random" },
  { pattern: /new\s+Buffer\s*\(/, type: "deprecated-buffer" },
];

const AUTH_PATTERNS = [
  /auth/i,
  /middleware/i,
  /session/i,
  /token/i,
  /jwt/i,
  /passport/i,
  /bcrypt/i,
];

function computeEntropy(str: string): number {
  if (!str) return 0;
  const freq: Record<string, number> = {};
  for (const ch of str) {
    freq[ch] = (freq[ch] || 0) + 1;
  }
  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function detectEndpoints(
  files: FileEntry[],
  root: string
): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];

  for (const file of files) {
    if (
      !/(?:route|controller|handler|endpoint|api)/i.test(file.path) &&
      !/(?:router|app)\.(?:get|post|put|delete|patch)\s*\(/i.test(file.path)
    )
      continue;

    const content = readFileSync(`${root}/${file.relativePath}`, "utf-8");
    const routeMatches = content.match(
      /(?:app|router)\.(?:get|post|put|delete|patch)\s*\(\s*['"`]([^'"]+)['"`]/gi
    );
    if (!routeMatches) continue;

    for (const match of routeMatches) {
      const pathMatch = match.match(/['"`](\/[^'"]+)['"`]/);
      if (!pathMatch) continue;
      const path = pathMatch[1];

      const hasAuth = AUTH_PATTERNS.some((p) => p.test(content));
      let sensitivity: EndpointInfo["sensitivity"] = "public";
      if (/admin|manage|internal/i.test(path)) sensitivity = "admin";
      else if (hasAuth) sensitivity = "internal";

      endpoints.push({ path, hasAuth, sensitivity });
    }
  }

  return endpoints;
}

function scanFile(
  file: FileEntry,
  root: string
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const content = readFileSync(`${root}/${file.relativePath}`, "utf-8");
  const lines = content.split("\n");

  for (const line of lines) {
    const lineNum = lines.indexOf(line) + 1;

    for (const { pattern, type, owasp } of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        const match = line.match(/['"]([^'"]{8,})['"]/);
        const entropy = match ? computeEntropy(match[1]) : 0;
        findings.push({
          id: fid(),
          severity: "critical",
          category: "secret",
          file: file.relativePath,
          line: lineNum,
          message: `${type} detected`,
          owaspCategory: owasp,
          entropy,
          suggestion: "Use environment variables or a secrets manager",
        });
      }
    }

    for (const { pattern, type, owasp } of DANGEROUS_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          id: fid(),
          severity: "warning",
          category: "injection",
          file: file.relativePath,
          line: lineNum,
          message: `${type} vulnerability`,
          owaspCategory: owasp,
        });
      }
    }

    for (const { pattern, type } of CRYPTO_WEAK) {
      if (pattern.test(line)) {
        findings.push({
          id: fid(),
          severity: "warning",
          category: "crypto",
          file: file.relativePath,
          line: lineNum,
          message: `${type} detected`,
          owaspCategory: "A02:2021",
        });
      }
    }
  }

  return findings;
}

function groupByOwasp(findings: SecurityFinding[]): OwaspGroup[] {
  const groups: Record<string, SecurityFinding[]> = {};
  for (const f of findings) {
    const cat = f.owaspCategory ?? "other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(f);
  }

  return Object.entries(groups).map(([category, categoryFindings]) => {
    const hasCritical = categoryFindings.some((f) => f.severity === "critical");
    const hasWarning = categoryFindings.some((f) => f.severity === "warning");
    return {
      category,
      findings: categoryFindings,
      risk: hasCritical ? "critical" : hasWarning ? "high" : "medium",
    };
  });
}

export function analyzeSecurity(ctx: AgentContext): SecurityReport {
  const { index, root } = ctx;
  const findings: SecurityFinding[] = [];

  if (root) {
    for (const file of index.files) {
      if (file.language === "json") continue;
      const fileFindings = scanFile(file, root);
      findings.push(...fileFindings);
    }
  }

  const endpoints = root ? detectEndpoints(index.files, root) : [];

  const unauthedAdmin = endpoints.filter(
    (e) => e.sensitivity === "admin" && !e.hasAuth
  );
  for (const ep of unauthedAdmin) {
    findings.push({
      id: fid(),
      severity: "critical",
      category: "auth",
      message: `Admin endpoint ${ep.path} has no auth middleware`,
      suggestion: "Add authentication middleware",
    });
  }

  const owaspGroups = groupByOwasp(findings);
  const critical = findings.filter((f) => f.severity === "critical").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const riskScore = Math.min(critical * 15 + warnings * 5, 100);
  const score = Math.max(0, 100 - riskScore);

  return {
    agent: "security",
    summary: `Scanned ${index.files.length} files. Found ${findings.length} security issues (risk: ${riskScore}/100). ${endpoints.length} endpoints detected.`,
    findings,
    score,
    owaspCategories: owaspGroups,
    exposedEndpoints: endpoints,
    riskScore,
  };
}

export const securityAgent: Agent = {
  name: "security",
  analyze: analyzeSecurity,
};
