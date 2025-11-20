const fs = require('fs');
const path = require('path');

// Buscar archivo de coverage en varias ubicaciones posibles
const coveragePaths = [
  path.join(process.cwd(), 'coverage', 'coverage-summary.json'),
  path.join(process.cwd(), 'coverage', 'coverage-final.json'),
];

function findCoverageFile() {
  for (const p of coveragePaths) {
    if (fs.existsSync(p)) {
      console.log(`✓ Coverage file found: ${p}`);
      return p;
    }
  }
  throw new Error('❌ No coverage JSON found. Run "pnpm test:coverage" first.');
}

function percent(value) {
  if (typeof value === 'number') {
    return value.toFixed(2) + '%';
  }
  return 'N/A';
}

function getCoverageMetrics(data) {
  // Estructura puede variar según el provider (v8 vs c8)
  if (data.total) return data.total;
  if (data.totals) return data.totals;
  
  // Buscar primera entrada que no sea un archivo
  const keys = Object.keys(data);
  for (const key of keys) {
    if (key === 'total' || !key.includes('/') && !key.includes('\\')) {
      return data[key];
    }
  }
  
  return null;
}

function getFileMetrics(fileData) {
  return {
    lines: fileData.lines || fileData.l || { pct: 0 },
    statements: fileData.statements || fileData.s || { pct: 0 },
    branches: fileData.branches || fileData.b || { pct: 0 },
    functions: fileData.functions || fileData.f || { pct: 0 },
  };
}

function generateMarkdownReport() {
  try {
    const covPath = findCoverageFile();
    const raw = fs.readFileSync(covPath, 'utf8');
    const data = JSON.parse(raw);

    const totals = getCoverageMetrics(data);
    const files = Object.keys(data).filter(k => 
      k !== 'total' && 
      k !== 'totals' && 
      (k.includes('/') || k.includes('\\'))
    );

    let md = `# 📊 Coverage Report\n\n`;
    md += `**Generated:** ${new Date().toLocaleString('es-ES', { 
      dateStyle: 'full', 
      timeStyle: 'short' 
    })}\n\n`;
    md += `**Test Framework:** Vitest v4.0.11\n`;
    md += `**Coverage Provider:** V8\n`;
    md += `**Total Files Analyzed:** ${files.length}\n\n`;

    md += `---\n\n`;

    // Summary metrics
    md += `## 🎯 Overall Summary\n\n`;
    md += `| Metric | Coverage | Covered | Total |\n`;
    md += `|--------|----------|---------|-------|\n`;
    
    if (totals) {
      if (totals.lines) {
        md += `| **Lines** | ${percent(totals.lines.pct)} | ${totals.lines.covered || 'N/A'} | ${totals.lines.total || 'N/A'} |\n`;
      }
      if (totals.statements) {
        md += `| **Statements** | ${percent(totals.statements.pct)} | ${totals.statements.covered || 'N/A'} | ${totals.statements.total || 'N/A'} |\n`;
      }
      if (totals.branches) {
        md += `| **Branches** | ${percent(totals.branches.pct)} | ${totals.branches.covered || 'N/A'} | ${totals.branches.total || 'N/A'} |\n`;
      }
      if (totals.functions) {
        md += `| **Functions** | ${percent(totals.functions.pct)} | ${totals.functions.covered || 'N/A'} | ${totals.functions.total || 'N/A'} |\n`;
      }
    }

    md += `\n---\n\n`;

    // Per-file detailed coverage
    md += `## 📁 File-by-File Coverage\n\n`;
    md += `| File | Lines | Statements | Branches | Functions |\n`;
    md += `|------|------:|----------:|---------:|----------:|\n`;

    const fileStats = [];
    files.forEach((filePath) => {
      const metrics = getFileMetrics(data[filePath]);
      const relativePath = filePath.replace(process.cwd(), '').replace(/\\/g, '/').replace(/^\//, '');
      
      // Calcular promedio para ordenar
      const avg = [
        metrics.lines.pct || 0,
        metrics.statements.pct || 0,
        metrics.branches.pct || 0,
        metrics.functions.pct || 0
      ].reduce((a, b) => a + b, 0) / 4;

      fileStats.push({
        path: relativePath,
        metrics,
        average: avg
      });
    });

    // Ordenar por cobertura (menor a mayor)
    fileStats.sort((a, b) => a.average - b.average);

    fileStats.forEach(({ path: filePath, metrics }) => {
      const linesCov = percent(metrics.lines.pct);
      const stmtsCov = percent(metrics.statements.pct);
      const branchCov = percent(metrics.branches.pct);
      const funcCov = percent(metrics.functions.pct);

      // Emoji según cobertura de líneas
      let emoji = '🔴';
      const linesPct = metrics.lines.pct || 0;
      if (linesPct >= 80) emoji = '🟢';
      else if (linesPct >= 50) emoji = '🟡';

      md += `| ${emoji} \`${filePath}\` | ${linesCov} | ${stmtsCov} | ${branchCov} | ${funcCov} |\n`;
    });

    md += `\n---\n\n`;

    // Files below threshold
    const threshold = parseFloat(process.env.COVERAGE_THRESHOLD || '80');
    const lowCoverageFiles = fileStats.filter(f => (f.metrics.lines.pct || 0) < threshold);
    
    md += `## ⚠️ Files Below ${threshold}% Threshold\n\n`;
    
    if (lowCoverageFiles.length > 0) {
      md += `Found **${lowCoverageFiles.length}** file(s) that need attention:\n\n`;
      lowCoverageFiles.forEach(({ path: filePath, metrics }) => {
        md += `### 🔴 \`${filePath}\` (${percent(metrics.lines.pct)})\n\n`;
        md += `- **Lines:** ${metrics.lines.covered || 0}/${metrics.lines.total || 0} (${percent(metrics.lines.pct)})\n`;
        md += `- **Statements:** ${metrics.statements.covered || 0}/${metrics.statements.total || 0} (${percent(metrics.statements.pct)})\n`;
        md += `- **Branches:** ${metrics.branches.covered || 0}/${metrics.branches.total || 0} (${percent(metrics.branches.pct)})\n`;
        md += `- **Functions:** ${metrics.functions.covered || 0}/${metrics.functions.total || 0} (${percent(metrics.functions.pct)})\n\n`;
      });
    } else {
      md += `✅ **All files meet or exceed the ${threshold}% coverage threshold!**\n\n`;
    }

    md += `---\n\n`;

    // Coverage distribution
    md += `## 📈 Coverage Distribution\n\n`;
    const ranges = {
      '90-100%': 0,
      '80-89%': 0,
      '70-79%': 0,
      '50-69%': 0,
      '0-49%': 0
    };

    fileStats.forEach(({ metrics }) => {
      const pct = metrics.lines.pct || 0;
      if (pct >= 90) ranges['90-100%']++;
      else if (pct >= 80) ranges['80-89%']++;
      else if (pct >= 70) ranges['70-79%']++;
      else if (pct >= 50) ranges['50-69%']++;
      else ranges['0-49%']++;
    });

    md += `| Range | Files | Percentage |\n`;
    md += `|-------|------:|-----------:|\n`;
    Object.entries(ranges).forEach(([range, count]) => {
      const pct = ((count / fileStats.length) * 100).toFixed(1);
      const bar = '█'.repeat(Math.round(count / fileStats.length * 20));
      md += `| ${range} | ${count} | ${pct}% ${bar} |\n`;
    });

    md += `\n---\n\n`;

    // Best and worst files
    md += `## 🏆 Best & Worst Covered Files\n\n`;
    
    md += `### 🥇 Top 5 Best Covered\n\n`;
    fileStats.slice(-5).reverse().forEach(({ path: filePath, metrics }, idx) => {
      md += `${idx + 1}. \`${filePath}\` - ${percent(metrics.lines.pct)}\n`;
    });

    md += `\n### 🔻 Top 5 Need Improvement\n\n`;
    fileStats.slice(0, 5).forEach(({ path: filePath, metrics }, idx) => {
      md += `${idx + 1}. \`${filePath}\` - ${percent(metrics.lines.pct)}\n`;
    });

    md += `\n---\n\n`;
    md += `## 💡 Recommendations\n\n`;
    
    const avgCoverage = totals && totals.lines ? totals.lines.pct : 0;
    if (avgCoverage >= 80) {
      md += `✅ **Excellent!** Your codebase has strong test coverage (${percent(avgCoverage)}).\n\n`;
      md += `- Continue maintaining this level\n`;
      md += `- Focus on files below 80%\n`;
      md += `- Consider increasing threshold to 85%\n`;
    } else if (avgCoverage >= 60) {
      md += `⚠️ **Good start**, but there's room for improvement (${percent(avgCoverage)}).\n\n`;
      md += `- Prioritize files with 0% coverage\n`;
      md += `- Add tests for critical business logic\n`;
      md += `- Aim for 80% overall coverage\n`;
    } else {
      md += `🔴 **Critical!** Coverage is below recommended levels (${percent(avgCoverage)}).\n\n`;
      md += `- Add tests for all critical paths\n`;
      md += `- Focus on high-risk areas first\n`;
      md += `- Set up CI/CD coverage checks\n`;
    }

    md += `\n---\n\n`;
    md += `*Generated with ❤️ by Vitest Coverage Reporter*\n`;

    const outPath = path.join(process.cwd(), 'coverage', 'coverage-report.md');
    fs.writeFileSync(outPath, md, 'utf8');
    console.log(`\n✅ Markdown report generated: coverage/coverage-report.md`);
    console.log(`   Files analyzed: ${fileStats.length}`);
    console.log(`   Average coverage: ${percent(avgCoverage)}\n`);

    return outPath;
  } catch (err) {
    console.error('❌ Error generating coverage report:', err.message);
    process.exit(1);
  }
}

// Ejecutar
generateMarkdownReport();
