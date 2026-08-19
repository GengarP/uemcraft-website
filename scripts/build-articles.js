#!/usr/bin/env node
/* ============================================================
   build-articles.js — 扫描 articles/*.md，生成：
   - articles/index.json   （全部文章元数据列表，按日期降序）
   - articles-json/{slug}.json （每篇文章完整数据含 markdown）
   零外部依赖，仅用 Node.js 内置模块。
   ============================================================ */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'articles');
const OUTPUT_DIR = path.join(ROOT, 'articles-json');

// ---- 解析 YAML front matter ----
function parseFrontMatter(src) {
  const match = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: src };

  const yaml = match[1];
  const body = match[2];
  const meta = {};

  // 简单 YAML 解析：支持 key: value、key: | 多行列表、嵌套列表
  const lines = yaml.split(/\r?\n/);
  let currentKey = null;
  let inList = false;

  for (const line of lines) {
    // 列表项 - 续行
    const listMatch = line.match(/^\s+-\s+(.+)$/);
    if (listMatch && inList && currentKey) {
      meta[currentKey].push(listMatch[1].trim());
      continue;
    }

    // key: value
    const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      let val = kvMatch[2].trim();

      // 列表起始（空值后跟列表项）
      if (val === '' || val === '[]') {
        meta[currentKey] = [];
        inList = val === '';
        continue;
      }

      // 去引号
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }

      meta[currentKey] = val;
      inList = false;
    }
  }

  return { meta, body: body.trim() };
}

// ---- 主流程 ----
function main() {
  // 确保输出目录存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 扫描 .md 文件
  const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.log('No .md files found in articles/');
    process.exit(0);
  }

  const index = [];

  for (const file of files) {
    const filePath = path.join(ARTICLES_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { meta, body } = parseFrontMatter(raw);

    const slug = meta.slug || file.replace(/\.md$/, '');
    const tags = Array.isArray(meta.tags) ? meta.tags : [];

    const article = {
      slug,
      title: meta.title || slug,
      excerpt: meta.excerpt || '',
      date: meta.date || '',
      author: meta.author || '',
      tags,
      markdown: body
    };

    // 可选字段
    if (meta.cover) article.cover = meta.cover;
    if (meta.coverCaption) article.coverCaption = meta.coverCaption;

    // 写入独立 JSON
    const outPath = path.join(OUTPUT_DIR, slug + '.json');
    fs.writeFileSync(outPath, JSON.stringify(article, null, 2), 'utf-8');
    console.log('  ✓ ' + slug + '.json');

    // 收集到 index（不含 markdown）
    const { markdown, ...metaOnly } = article;
    index.push(metaOnly);
  }

  // 按日期降序排序
  index.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  // 写入 index.json
  const indexPath = path.join(ARTICLES_DIR, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  console.log('\n  ✓ articles/index.json (' + index.length + ' articles)');
  console.log('Build complete.');
}

main();
