'use strict';

const fs = require('fs');
const path = require('path');
const ts = require(path.resolve(__dirname, '../packages/contracts/node_modules/typescript/lib/typescript.js'));

if (process.argv.length !== 3) {
  process.stderr.write('usage: node source-boundary-check.js <manifest.json>\n');
  process.exit(2);
}

const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const knownSpecifiers = manifest.knownSpecifiers || {};
const contexts = manifest.contexts || {};
const knownSchemas = new Set(manifest.knownSchemas || []);
const results = [];

function evaluateConstantString(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return evaluateConstantString(node.expression);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = evaluateConstantString(node.left);
    const right = evaluateConstantString(node.right);
    return left === null || right === null ? null : left + right;
  }
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text;
    for (const span of node.templateSpans) {
      const expression = evaluateConstantString(span.expression);
      if (expression === null) return null;
      value += expression + span.literal.text;
    }
    return value;
  }
  return null;
}

function collectModuleSpecifiers(sourceFile) {
  const values = [];
  let unresolvedDynamic = 0;
  function add(node, mustResolve = false) {
    const value = evaluateConstantString(node);
    if (value !== null) values.push(value);
    else if (mustResolve) unresolvedDynamic += 1;
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) add(node.moduleReference.expression);
    if (ts.isCallExpression(node) && node.arguments.length === 1) {
      const expression = node.expression;
      if (expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(expression) && expression.text === 'require')) add(node.arguments[0], true);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return { values, unresolvedDynamic };
}

function collectSqlStrings(sourceFile) {
  const values = [];
  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) values.push(node.text);
    if (ts.isTemplateExpression(node)) {
      values.push(node.head.text + node.templateSpans.map((span) => span.literal.text).join(''));
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return values;
}

for (const item of manifest.items || []) {
  const findings = [];
  const sourceContext = item.sourceContext;
  const context = contexts[sourceContext];
  if (!context) {
    findings.push('source_context_unresolved');
    results.push({ id: item.id, findings });
    continue;
  }
  const sourceFile = ts.createSourceFile(item.id, item.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (/\.(?:ts|tsx|js|jsx|mjs|cjs)$/i.test(item.id) && sourceFile.parseDiagnostics.length > 0) findings.push('source_parse_error');
  const collectedImports = collectModuleSpecifiers(sourceFile);
  if (collectedImports.unresolvedDynamic > 0) findings.push('dynamic_module_specifier_non_constant');
  for (const specifier of collectedImports.values) {
    if (!specifier.startsWith('@nexus/')) continue;
    const target = knownSpecifiers[specifier];
    if (!target) findings.push(`unknown_import:${specifier}`);
    else if (!(context.allowedImports || []).includes(target)) findings.push(`forbidden_import:${sourceContext}->${target}`);
  }
  const sqlCandidates = item.id.toLowerCase().endsWith('.sql') ? [item.text] : collectSqlStrings(sourceFile);
  for (const sql of sqlCandidates) {
    const regex = /\b(?:from|join|update|into|delete\s+from)\s+["']?([a-z][a-z0-9_]*)["']?\./gi;
    let match;
    while ((match = regex.exec(sql)) !== null) {
      const targetSchema = match[1].toLowerCase();
      if (knownSchemas.has(targetSchema) && targetSchema !== sourceContext) findings.push(`direct_foreign_table:${sourceContext}->${targetSchema}`);
    }
  }
  results.push({ id: item.id, findings: [...new Set(findings)].sort() });
}

process.stdout.write(JSON.stringify({ schema_version: 1, results }));
