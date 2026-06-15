# 智能冰箱食谱工具 - 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个基于现有食材的 AI 食谱推荐工具，PWA 可添加到手机桌面

**Architecture:** Cloudflare Pages + Pages Functions + D1 数据库 + DeepSeek API。纯前端 SPA，所有 API 请求经 Functions 代理。

**Tech Stack:** Cloudflare Pages, Pages Functions, D1 (SQLite), DeepSeek API, 原生 HTML/CSS/JS, PWA

---

### Task 1: 项目脚手架

**Files:**
- Create: `wrangler.toml`
- Create: `package.json`
- Create: `.gitignore`
- Create: `public/index.html`
- Create: `public/manifest.json`
- Create: `public/sw.js`
- Create: `migrations/0001_initial.sql`

- [ ] **Step 1: 创建 wrangler.toml**

```toml
name = "recipe-fridge"
compatibility_date = "2026-06-15"
pages_build_output_dir = "public"

[[d1_databases]]
binding = "DB"
database_name = "recipe-fridge-db"
database_id = ""

[env.production]
vars = { DEEPSEEK_API_KEY = "" }
```

- [ ] **Step 2: 创建 package.json**

```json
{
  "name": "recipe-fridge",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler pages dev public --d1 DB"
  }
}
```

- [ ] **Step 3: 创建 .gitignore**

```
node_modules/
.wrangler/
.dev-vm/
dist/
*.local.json
```

- [ ] **Step 4: 创建 public/manifest.json**

```json
{
  "name": "智能冰箱",
  "short_name": "冰箱",
  "description": "基于食材的 AI 食谱推荐工具",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f5f6fa",
  "theme_color": "#16a34a",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 5: 创建 migrations/0001_initial.sql**

```sql
DROP TABLE IF EXISTS cook_logs;
DROP TABLE IF EXISTS recipe_ingredients;
DROP TABLE IF EXISTS recipes;
DROP TABLE IF EXISTS ingredients;

CREATE TABLE ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '其他',
  quantity REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '个',
  expiry_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  image TEXT,
  steps TEXT NOT NULL DEFAULT '[]',
  difficulty TEXT NOT NULL DEFAULT '简单',
  cook_time INTEGER DEFAULT 15,
  tips TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  cook_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE recipe_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL,
  ingredient_name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  optional INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE cook_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL,
  cooked_at TEXT NOT NULL DEFAULT (datetime('now')),
  rating INTEGER,
  note TEXT,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);
```

- [ ] **Step 6: 创建 public/sw.js（Service Worker）**

```javascript
const CACHE = 'recipe-fridge-v1';
const STATIC = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/fridge.js',
  '/js/recipes.js',
  '/js/recommend.js',
  '/js/cook-logs.js',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
```

- [ ] **Step 7: 初始化 git**

```bash
cd /c/Users/le241/Desktop/Claude项目/recipe-fridge
git init
git add .
git commit -m "feat: project scaffold with D1 schema and PWA"
```

---

### Task 2: D1 数据库初始化

**Files:**
- Execute: `migrations/0001_initial.sql` against D1

- [ ] **Step 1: 创建 D1 数据库**

```bash
cd /c/Users/le241/Desktop/Claude项目/recipe-fridge
npx wrangler d1 create recipe-fridge-db
```

然后将返回的 `database_id` 填入 `wrangler.toml` 的 `[[d1_databases]]` 中。

- [ ] **Step 2: 执行迁移**

```bash
npx wrangler d1 execute recipe-fridge-db --file=./migrations/0001_initial.sql
```

- [ ] **Step 3: 验证表已创建**

```bash
npx wrangler d1 execute recipe-fridge-db --command=".tables"
```

Expected: `ingredients`, `recipes`, `recipe_ingredients`, `cook_logs`

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "feat: initialize D1 database schema"
```

---

### Task 3: Cloudflare Pages Function（API 层）

**Files:**
- Create: `functions/api/ingredients.js`
- Create: `functions/api/recipes.js`
- Create: `functions/api/cook-logs.js`
- Create: `functions/api/ai.js`
- Create: `functions/api/_db.js`

- [ ] **Step 1: 创建数据库连接模块 `functions/api/_db.js`**

```javascript
export function getDb(context) {
  return context.env.DB;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

export function error(msg, status = 400) {
  return json({ code: status, data: null, message: msg }, status);
}

export function success(data) {
  return json({ code: 200, data, message: 'ok' });
}
```

- [ ] **Step 2: 创建食材 API `functions/api/ingredients.js`**

```javascript
import { getDb, json, success, error } from './_db.js';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const method = request.method;

  // 从 URL 中提取 ID（如 /api/ingredients/123）
  const parts = url.pathname.split('/');
  const id = parts[3] && !isNaN(parts[3]) ? parseInt(parts[3]) : null;
  const action = parts[3] && isNaN(parts[3]) ? parts[3] : null;

  const db = getDb(context);

  try {
    if (method === 'GET' && !id) {
      // 列表
      let sql = 'SELECT * FROM ingredients';
      const params = [];
      if (url.searchParams.get('expiring')) {
        sql += ` WHERE expiry_date IS NOT NULL AND expiry_date <= date('now', '+3 days') AND expiry_date >= date('now')`;
      }
      sql += ' ORDER BY category, name';
      const result = await db.prepare(sql).all();
      return success(result.results);
    }

    if (method === 'GET' && id) {
      const result = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();
      if (!result) return error('食材不存在', 404);
      return success(result);
    }

    if (method === 'POST' && !id) {
      const body = await request.json();
      if (!body.name || body.quantity === undefined) {
        return error('缺少必填字段: name, quantity');
      }
      const result = await db.prepare(
        `INSERT INTO ingredients (name, category, quantity, unit, expiry_date)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        body.name, body.category || '其他', body.quantity,
        body.unit || '个', body.expiry_date || null
      ).run();
      return success({ id: result.meta.last_row_id }, 201);
    }

    if (method === 'PUT' && id) {
      const body = await request.json();
      const sets = [];
      const params = [];
      for (const key of ['name', 'category', 'quantity', 'unit', 'expiry_date']) {
        if (body[key] !== undefined) {
          sets.push(`${key} = ?`);
          params.push(body[key]);
        }
      }
      if (sets.length === 0) return error('没有要更新的字段');
      sets.push("updated_at = datetime('now')");
      params.push(id);
      await db.prepare(`UPDATE ingredients SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run();
      return success({ id });
    }

    if (method === 'DELETE' && id) {
      await db.prepare('DELETE FROM ingredients WHERE id = ?').bind(id).run();
      return success({ id });
    }

    // POST /api/ingredients/consume
    if (method === 'POST' && action === 'consume') {
      const body = await request.json();
      if (!body.id || !body.quantity) return error('缺少必填字段');
      const ing = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(body.id).first();
      if (!ing) return error('食材不存在', 404);
      const newQty = Math.max(0, ing.quantity - body.quantity);
      await db.prepare("UPDATE ingredients SET quantity = ?, updated_at = datetime('now') WHERE id = ?").bind(newQty, body.id).run();
      return success({ id: body.id, remaining: newQty });
    }

    return error('Method not allowed', 405);
  } catch (e) {
    return error(e.message, 500);
  }
}
```

- [ ] **Step 3: 创建菜谱 API `functions/api/recipes.js`**

```javascript
import { getDb, success, error } from './_db.js';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const method = request.method;
  const parts = url.pathname.split('/');
  const id = parts[3] && !isNaN(parts[3]) ? parseInt(parts[3]) : null;

  const db = getDb(context);

  try {
    if (method === 'GET' && !id) {
      const q = url.searchParams.get('q');
      const ingredient = url.searchParams.get('ingredient');
      let sql = 'SELECT r.* FROM recipes r';
      const params = [];

      if (ingredient) {
        sql = `SELECT DISTINCT r.* FROM recipes r
               JOIN recipe_ingredients ri ON r.id = ri.recipe_id
               WHERE ri.ingredient_name = ?`;
        params.push(ingredient);
      } else if (q) {
        sql = 'SELECT r.* FROM recipes r WHERE r.name LIKE ?';
        params.push(`%${q}%`);
      }
      sql += ' ORDER BY r.cook_count DESC';
      const result = await db.prepare(sql).bind(...params).all();
      return success(result.results.map(r => ({ ...r, steps: JSON.parse(r.steps) })));
    }

    if (method === 'GET' && id) {
      const recipe = await db.prepare('SELECT * FROM recipes WHERE id = ?').bind(id).first();
      if (!recipe) return error('菜谱不存在', 404);
      recipe.steps = JSON.parse(recipe.steps);
      const ingredients = await db.prepare(
        'SELECT * FROM recipe_ingredients WHERE recipe_id = ?'
      ).bind(id).all();
      recipe.ingredients = ingredients.results;
      return success(recipe);
    }

    if (method === 'POST' && !id) {
      const body = await request.json();
      if (!body.name) return error('缺少必填字段: name');
      const steps = JSON.stringify(body.steps || []);
      const result = await db.prepare(
        `INSERT INTO recipes (name, image, steps, difficulty, cook_time, tips, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        body.name, body.image || null, steps,
        body.difficulty || '简单', body.cook_time || 15,
        body.tips || null, body.source || 'manual'
      ).run();

      const recipeId = result.meta.last_row_id;

      // 添加关联食材
      if (body.ingredients && body.ingredients.length > 0) {
        const stmt = db.prepare(
          `INSERT INTO recipe_ingredients (recipe_id, ingredient_name, quantity, unit, optional)
           VALUES (?, ?, ?, ?, ?)`
        );
        for (const ing of body.ingredients) {
          await stmt.bind(recipeId, ing.name, ing.quantity || 0, ing.unit || '', ing.optional ? 1 : 0).run();
        }
      }

      return success({ id: recipeId }, 201);
    }

    if (method === 'DELETE' && id) {
      await db.prepare('DELETE FROM recipes WHERE id = ?').bind(id).run();
      return success({ id });
    }

    return error('Method not allowed', 405);
  } catch (e) {
    return error(e.message, 500);
  }
}
```

- [ ] **Step 4: 创建做菜记录 API `functions/api/cook-logs.js`**

```javascript
import { getDb, success, error } from './_db.js';

export async function onRequest(context) {
  const { request } = context;
  const method = request.method;
  const db = getDb(context);

  try {
    if (method === 'GET') {
      const { searchParams } = new URL(request.url);
      let sql = `SELECT cl.*, r.name as recipe_name FROM cook_logs cl
                 JOIN recipes r ON cl.recipe_id = r.id`;
      const params = [];

      if (searchParams.get('recipe_id')) {
        sql += ' WHERE cl.recipe_id = ?';
        params.push(parseInt(searchParams.get('recipe_id')));
      }
      sql += ' ORDER BY cl.cooked_at DESC';
      const result = await db.prepare(sql).bind(...params).all();
      return success(result.results);
    }

    if (method === 'POST') {
      const body = await request.json();
      if (!body.recipe_id) return error('缺少必填字段: recipe_id');

      const result = await db.prepare(
        `INSERT INTO cook_logs (recipe_id, rating, note) VALUES (?, ?, ?)`
      ).bind(body.recipe_id, body.rating || null, body.note || null).run();

      // 更新菜谱做菜次数
      await db.prepare(
        'UPDATE recipes SET cook_count = cook_count + 1 WHERE id = ?'
      ).bind(body.recipe_id).run();

      return success({ id: result.meta.last_row_id }, 201);
    }

    return error('Method not allowed', 405);
  } catch (e) {
    return error(e.message, 500);
  }
}
```

- [ ] **Step 5: 创建 DeepSeek AI API `functions/api/ai.js`**

```javascript
import { getDb, success, error } from './_db.js';

async function callDeepSeek(apiKey, messages) {
  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens: 2048
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`DeepSeek API 错误: ${err}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const db = getDb(context);

  if (method !== 'POST') return error('Method not allowed', 405);

  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) return error('未配置 DeepSeek API Key', 500);

  try {
    const body = await request.json();

    // POST /api/ai/recommend — 根据库存推荐
    if (url.pathname.endsWith('/recommend')) {
      const ingredients = body.ingredients || [];
      if (ingredients.length === 0) return error('请提供食材列表');

      // 先从已有的菜谱中匹配
      let matchedRecipes = [];
      if (ingredients.length > 0) {
        const placeholders = ingredients.map(() => '?').join(',');
        const rows = await db.prepare(
          `SELECT r.*, GROUP_CONCAT(ri.ingredient_name) as need_ingredients
           FROM recipes r
           JOIN recipe_ingredients ri ON r.id = ri.recipe_id
           WHERE ri.ingredient_name IN (${placeholders})
           GROUP BY r.id`
        ).bind(...ingredients).all();
        matchedRecipes = rows.results;
      }

      // 用 AI 生成更多推荐
      const prompt = `我冰箱里有以下食材：${ingredients.join('、')}。
请推荐3道家常菜，要求：
1. 优先使用现有食材
2. 每道菜列出：菜名、所需食材（标注哪些已在冰箱、需补充什么）、做法步骤、烹饪时间、难度
3. 用 JSON 格式返回，格式为：
[
  {
    "name": "菜名",
    "ingredients": [{"name": "食材名", "quantity": "用量", "unit": "单位", "optional": false}],
    "steps": ["步骤1", "步骤2"],
    "cook_time": 15,
    "difficulty": "简单"
  }
]`;

      const aiText = await callDeepSeek(apiKey, [
        { role: 'system', content: '你是一个家常菜谱推荐助手。始终用中文回复。' },
        { role: 'user', content: prompt }
      ]);

      let aiRecipes = [];
      try {
        aiRecipes = JSON.parse(aiText.replace(/```json|```/g, '').trim());
      } catch {
        // 如果解析失败，返回原始文本
        return success({ matched: matchedRecipes, ai_raw: aiText });
      }

      return success({ matched: matchedRecipes, ai: aiRecipes });
    }

    // POST /api/ai/generate — 生成新菜谱并保存
    if (url.pathname.endsWith('/generate')) {
      const ingredients = body.ingredients || [];
      const preference = body.preference || '';

      const prompt = `用以下食材创作一道新菜：${ingredients.join('、')}${preference ? '，偏好：' + preference : ''}。
请用 JSON 格式返回：
{
  "name": "菜名",
  "ingredients": [{"name": "食材名", "quantity": "用量", "unit": "单位", "optional": false}],
  "steps": ["步骤1", "步骤2", "..."],
  "cook_time": 分钟数,
  "difficulty": "简单/中等/困难",
  "tips": "小贴士"
}`;

      const aiText = await callDeepSeek(apiKey, [
        { role: 'system', content: '你是一个创意菜谱生成助手。始终用中文回复。' },
        { role: 'user', content: prompt }
      ]);

      let recipe;
      try {
        recipe = JSON.parse(aiText.replace(/```json|```/g, '').trim());
      } catch {
        return success({ raw: aiText });
      }

      // 保存到数据库
      const result = await db.prepare(
        `INSERT INTO recipes (name, image, steps, difficulty, cook_time, tips, source)
         VALUES (?, ?, ?, ?, ?, ?, 'ai')`
      ).bind(recipe.name, null, JSON.stringify(recipe.steps), recipe.difficulty || '简单', recipe.cook_time || 15, recipe.tips || null).run();

      const recipeId = result.meta.last_row_id;
      if (recipe.ingredients) {
        const stmt = db.prepare(
          `INSERT INTO recipe_ingredients (recipe_id, ingredient_name, quantity, unit, optional)
           VALUES (?, ?, ?, ?, ?)`
        );
        for (const ing of recipe.ingredients) {
          await stmt.bind(recipeId, ing.name, ing.quantity || 0, ing.unit || '', ing.optional ? 1 : 0).run();
        }
      }

      return success({ id: recipeId, recipe }, 201);
    }

    return error('Unknown action', 404);
  } catch (e) {
    return error(e.message, 500);
  }
}
```

- [ ] **Step 6: OPTIONS 预检（CORS）`functions/api/_cors.js`**

```javascript
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
```

针对每个 API 目录的 OPTIONS 请求，路由到该文件。

- [ ] **Step 7: 提交**

```bash
git add .
git commit -m "feat: API layer with ingredients, recipes, cook-logs, and AI endpoints"
```

---

### Task 4: 静态资源入口

**Files:**
- Create: `public/index.html`
- Create: `public/css/style.css`

- [ ] **Step 1: 创建 `public/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#16a34a">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="description" content="智能冰箱 - 基于食材的 AI 食谱推荐工具">
<title>智能冰箱</title>
<link rel="manifest" href="/manifest.json">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🥘</text></svg>">
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<div id="app">
  <header id="header">
    <h1 id="page-title">智能冰箱</h1>
  </header>
  <main id="main-content"></main>
  <nav id="bottom-nav">
    <a href="#fridge" class="nav-item active" data-page="fridge">
      <span class="nav-icon">🧊</span>
      <span class="nav-label">冰箱</span>
    </a>
    <a href="#recipes" class="nav-item" data-page="recipes">
      <span class="nav-icon">📖</span>
      <span class="nav-label">菜谱</span>
    </a>
    <a href="#recommend" class="nav-item" data-page="recommend">
      <span class="nav-icon">🤖</span>
      <span class="nav-label">推荐</span>
    </a>
    <a href="#logs" class="nav-item" data-page="logs">
      <span class="nav-icon">📝</span>
      <span class="nav-label">记录</span>
    </a>
  </nav>
</div>
<script src="/js/app.js"></script>
<script src="/js/api.js"></script>
<script src="/js/fridge.js"></script>
<script src="/js/recipes.js"></script>
<script src="/js/recommend.js"></script>
<script src="/js/cook-logs.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 `public/css/style.css`**

主题色用绿色系（冰箱/食材的感觉），CSS 变量：

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --primary: #16a34a;
  --danger: #e74c3c;
  --warning: #ea580c;
  --bg: #f5f6fa;
  --card-bg: #fff;
  --text: #1a1a2e;
  --text-secondary: #666;
  --border: #eee;
  --shadow: 0 1px 3px rgba(0,0,0,0.08);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  max-width: 800px;
  margin: 0 auto;
  min-height: 100vh;
}

#app { padding-bottom: 70px; }

/* 顶部栏 */
#header {
  background: var(--card-bg);
  border-bottom: 1px solid var(--border);
  padding: 14px 16px;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: var(--shadow);
}

#page-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--primary);
}

/* 底部导航 */
#bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  max-width: 800px;
  width: 100%;
  background: var(--card-bg);
  border-top: 1px solid var(--border);
  display: flex;
  z-index: 100;
}

.nav-item {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 11px;
  transition: color 0.2s;
}

.nav-item.active {
  color: var(--primary);
}

.nav-icon {
  display: block;
  font-size: 20px;
  margin-bottom: 2px;
}

/* 主内容 */
#main-content { padding: 16px; }

/* 卡片 */
.card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 10px;
  box-shadow: var(--shadow);
}

/* 按钮 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:hover { opacity: 0.9; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-sm {
  font-size: 12px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--card-bg);
  cursor: pointer;
  color: var(--text-secondary);
}

.btn-sm:hover { border-color: var(--primary); color: var(--primary); }
.btn-sm.danger { color: var(--danger); }
.btn-sm.danger:hover { border-color: var(--danger); color: var(--danger); }

.btn-block { width: 100%; }

/* 输入框 */
.input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 15px;
  outline: none;
}

.input:focus { border-color: var(--primary); }

/* 标签 */
.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
}

.tag-green { background: #f0fdf4; color: var(--primary); }
.tag-orange { background: #fff7ed; color: var(--warning); }
.tag-red { background: #fef2f2; color: var(--danger); }
.tag-gray { background: #f5f5f5; color: var(--text-secondary); }

/* 状态 */
.loading-state, .error-state, .empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 20px;
  width: 100%;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 14px;
}

.form-group { margin-bottom: 12px; }

.form-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  display: block;
}

.form-row { display: flex; gap: 10px; }
.form-row .form-group { flex: 1; }

/* 冰箱页 */
.ingredient-group { margin-bottom: 16px; }

.ingredient-group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
  padding: 0 4px;
}

.ingredient-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 6px;
}

.ingredient-item.expiring { border-color: var(--danger); background: #fef2f2; }

.ingredient-name {
  font-weight: 500;
  font-size: 14px;
}

.ingredient-qty {
  font-size: 13px;
  color: var(--text-secondary);
}

.ingredient-actions { display: flex; gap: 4px; }

/* 菜谱卡片 */
.recipe-card {
  display: flex;
  gap: 12px;
  cursor: pointer;
}

.recipe-img {
  width: 72px;
  height: 72px;
  background: #f0f0f0;
  border-radius: 8px;
  flex-shrink: 0;
  overflow: hidden;
}

.recipe-img img { width: 100%; height: 100%; object-fit: cover; }

.recipe-info { flex: 1; min-width: 0; }

.recipe-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.recipe-meta {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  gap: 8px;
}

/* AI 推荐 */
.recommend-header {
  text-align: center;
  padding: 16px 0;
}

.recommend-ingredients {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin: 12px 0;
}

.recommend-ingredient {
  background: #f0fdf4;
  color: var(--primary);
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 13px;
}

.recommend-result { margin-top: 16px; }

.recipe-detail-ingredients {
  margin: 12px 0;
}

.recipe-detail-ingredient {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--border);
}

.recipe-detail-step {
  padding: 8px 0;
  font-size: 13px;
  line-height: 1.6;
  border-bottom: 1px solid var(--border);
}

.recipe-detail-step-num {
  display: inline-block;
  width: 20px;
  height: 20px;
  background: var(--primary);
  color: #fff;
  border-radius: 50%;
  text-align: center;
  font-size: 12px;
  line-height: 20px;
  margin-right: 8px;
}

/* 做菜记录 */
.log-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.log-recipe-name { font-weight: 500; font-size: 13px; }
.log-date { font-size: 11px; color: var(--text-secondary); }
.log-rating { color: #f59e0b; font-size: 13px; }
```

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: HTML entry point and CSS styles"
```

---

### Task 5: 前端 API 层和路由

**Files:**
- Create: `public/js/api.js`
- Create: `public/js/app.js`

- [ ] **Step 1: 创建 `public/js/api.js`** — API 请求封装

```javascript
const Api = {
  base: '',

  async request(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(this.base + path, opts);
    const data = await resp.json();
    if (data.code !== 200) throw new Error(data.message || '请求失败');
    return data.data;
  },

  // 食材
  getIngredients(expiring) {
    return this.request('GET', `/api/ingredients${expiring ? '?expiring=1' : ''}`);
  },
  addIngredient(data) { return this.request('POST', '/api/ingredients', data); },
  updateIngredient(id, data) { return this.request('PUT', `/api/ingredients/${id}`, data); },
  deleteIngredient(id) { return this.request('DELETE', `/api/ingredients/${id}`); },
  consumeIngredient(id, quantity) {
    return this.request('POST', '/api/ingredients/consume', { id, quantity });
  },

  // 菜谱
  getRecipes(q) {
    return this.request('GET', `/api/recipes${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  },
  getRecipe(id) { return this.request('GET', `/api/recipes/${id}`); },
  addRecipe(data) { return this.request('POST', '/api/recipes', data); },
  deleteRecipe(id) { return this.request('DELETE', `/api/recipes/${id}`); },

  // AI
  recommend(ingredients) {
    return this.request('POST', '/api/ai/recommend', { ingredients });
  },
  generate(ingredients, preference) {
    return this.request('POST', '/api/ai/generate', { ingredients, preference });
  },

  // 做菜记录
  getCookLogs(recipeId) {
    return this.request('GET', `/api/cook-logs${recipeId ? `?recipe_id=${recipeId}` : ''}`);
  },
  addCookLog(data) { return this.request('POST', '/api/cook-logs', data); }
};
```

- [ ] **Step 2: 创建 `public/js/app.js`** — 路由和应用 Shell

```javascript
const App = {
  currentPage: 'fridge',

  init() {
    window.addEventListener('hashchange', () => this.route());
    this.route();
  },

  route() {
    const hash = location.hash.slice(1) || 'fridge';
    this.currentPage = hash;
    const container = document.getElementById('main-content');
    const titleEl = document.getElementById('page-title');

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === hash);
    });

    switch (hash) {
      case 'fridge':
        titleEl.textContent = '🧊 我的冰箱';
        FridgePage.render(container);
        break;
      case 'recipes':
        titleEl.textContent = '📖 我的菜谱';
        RecipesPage.render(container);
        break;
      case 'recommend':
        titleEl.textContent = '🤖 AI 推荐';
        RecommendPage.render(container);
        break;
      case 'logs':
        titleEl.textContent = '📝 做菜记录';
        CookLogsPage.render(container);
        break;
      case 'recipe-detail':
        titleEl.textContent = '📖 菜谱详情';
        RecipesPage.renderDetail(container);
        break;
    }
  },

  showLoading(container) {
    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>加载中...</p></div>';
  },

  showError(container, msg) {
    container.innerHTML = `<div class="error-state"><p>${this.escapeHtml(msg)}</p></div>`;
  },

  escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },

  showModal(html) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal">${html}</div>`;
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
    return overlay;
  },

  closeModal() {
    document.querySelector('.modal-overlay')?.remove();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
```

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: API client and app router"
```

---

### Task 6: 冰箱页面（食材库存管理）

**Files:**
- Create: `public/js/fridge.js`

- [ ] **Step 1: 创建 `public/js/fridge.js`**

```javascript
const FridgePage = {
  ingredients: [],

  async render(container) {
    container.innerHTML = `
      <div style="margin-bottom:12px;">
        <button class="btn btn-block" id="add-ingredient-btn">+ 添加食材</button>
      </div>
      <div id="fridge-list"></div>
    `;

    document.getElementById('add-ingredient-btn').addEventListener('click', () => this.showForm());
    await this.loadList();
  },

  async loadList() {
    const listEl = document.getElementById('fridge-list');
    App.showLoading(listEl);
    try {
      this.ingredients = await Api.getIngredients();
      this.renderList(listEl);
    } catch (e) {
      App.showError(listEl, `加载失败: ${e.message}`);
    }
  },

  renderList(container) {
    if (!this.ingredients.length) {
      container.innerHTML = '<div class="empty-state"><p>冰箱里还没有食材，去添加一些吧</p></div>';
      return;
    }

    // 按分类分组
    const groups = {};
    const now = new Date();
    for (const ing of this.ingredients) {
      if (!groups[ing.category]) groups[ing.category] = [];
      // 检查是否即将过期
      let expiring = false;
      if (ing.expiry_date) {
        const expiry = new Date(ing.expiry_date);
        const diff = (expiry - now) / (1000 * 60 * 60 * 24);
        expiring = diff >= 0 && diff <= 3;
      }
      groups[ing.category].push({ ...ing, expiring });
    }

    container.innerHTML = Object.entries(groups).map(([category, items]) => `
      <div class="ingredient-group">
        <div class="ingredient-group-title">${category}</div>
        ${items.map(item => `
          <div class="ingredient-item ${item.expiring ? 'expiring' : ''}">
            <div>
              <div class="ingredient-name">${item.name}</div>
              <div class="ingredient-qty">${item.quantity} ${item.unit}${item.expiring ? ' ⚠️ 即将过期' : ''}${item.expiry_date ? ' (${item.expiry_date})' : ''}</div>
            </div>
            <div class="ingredient-actions">
              <button class="btn-sm" data-edit="${item.id}">编辑</button>
              <button class="btn-sm danger" data-del="${item.id}">删除</button>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');

    container.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => this.deleteItem(parseInt(btn.dataset.del)));
    });
    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => this.showForm(parseInt(btn.dataset.edit)));
    });
  },

  async deleteItem(id) {
    if (!confirm('确定删除这个食材？')) return;
    try {
      await Api.deleteIngredient(id);
      await this.loadList();
    } catch (e) {
      alert('删除失败: ' + e.message);
    }
  },

  showForm(id) {
    const item = id ? this.ingredients.find(i => i.id === id) : null;
    const overlay = App.showModal(`
      <div class="modal-title">${item ? '编辑食材' : '添加食材'}</div>
      <div class="form-group">
        <label class="form-label">名称</label>
        <input class="input" id="f-name" value="${item ? App.escapeHtml(item.name) : ''}" placeholder="食材名称">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">分类</label>
          <select class="input" id="f-category">
            ${['蔬菜', '肉类', '调料', '主食', '水果', '奶制品', '其他'].map(c =>
              `<option value="${c}" ${item && item.category === c ? 'selected' : ''}>${c}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">数量</label>
          <input class="input" id="f-qty" type="number" value="${item ? item.quantity : ''}" step="0.1" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">单位</label>
          <input class="input" id="f-unit" value="${item ? App.escapeHtml(item.unit) : '个'}" placeholder="个/克/根">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">过期日期（可选）</label>
        <input class="input" id="f-expiry" type="date" value="${item && item.expiry_date ? item.expiry_date : ''}">
      </div>
      <button class="btn btn-block" id="f-save">保存</button>
    `);

    document.getElementById('f-save').addEventListener('click', async () => {
      const data = {
        name: document.getElementById('f-name').value.trim(),
        category: document.getElementById('f-category').value,
        quantity: parseFloat(document.getElementById('f-qty').value) || 0,
        unit: document.getElementById('f-unit').value.trim() || '个',
        expiry_date: document.getElementById('f-expiry').value || null
      };
      if (!data.name) { alert('请输入食材名称'); return; }
      try {
        if (item) {
          await Api.updateIngredient(item.id, data);
        } else {
          await Api.addIngredient(data);
        }
        App.closeModal();
        await this.loadList();
      } catch (e) {
        alert('保存失败: ' + e.message);
      }
    });
  }
};
```

- [ ] **Step 2: 提交**

```bash
git add .
git commit -m "feat: fridge page with ingredient CRUD"
```

---

### Task 7: 菜谱页面

**Files:**
- Create: `public/js/recipes.js`

- [ ] **Step 1: 创建 `public/js/recipes.js`**

```javascript
const RecipesPage = {
  recipes: [],

  async render(container) {
    container.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input class="input" id="recipe-search" placeholder="搜索菜谱...">
        <button class="btn" id="search-btn">搜索</button>
      </div>
      <button class="btn btn-block" id="add-recipe-btn" style="margin-bottom:12px;">+ 添加菜谱</button>
      <div id="recipe-list"></div>
    `;

    document.getElementById('search-btn').addEventListener('click', () => this.search());
    document.getElementById('recipe-search').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.search();
    });
    document.getElementById('add-recipe-btn').addEventListener('click', () => this.showForm());
    await this.search();
  },

  async search() {
    const q = document.getElementById('recipe-search')?.value.trim() || '';
    const listEl = document.getElementById('recipe-list');
    App.showLoading(listEl);
    try {
      this.recipes = await Api.getRecipes(q) || [];
      this.renderList(listEl);
    } catch (e) {
      App.showError(listEl, `加载失败: ${e.message}`);
    }
  },

  renderList(container) {
    if (!this.recipes.length) {
      container.innerHTML = '<div class="empty-state"><p>还没有菜谱，点击上方添加</p></div>';
      return;
    }
    container.innerHTML = this.recipes.map(r => `
      <div class="card recipe-card" data-id="${r.id}">
        <div class="recipe-img">
          ${r.image ? `<img src="${r.image}" alt="${App.escapeHtml(r.name)}">` : ''}
        </div>
        <div class="recipe-info">
          <div class="recipe-name">${App.escapeHtml(r.name)}</div>
          <div class="recipe-meta">
            <span>⏱ ${r.cook_time}min</span>
            <span>${r.difficulty}</span>
            <span>${r.source === 'ai' ? '🤖 AI 生成' : '📝 手动'}</span>
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.recipe-card').forEach(card => {
      card.addEventListener('click', () => this.showDetail(parseInt(card.dataset.id)));
    });
  },

  async showDetail(id) {
    try {
      const recipe = await Api.getRecipe(id);
      RecipesPage.detail = recipe;
      window.location.hash = 'recipe-detail';
    } catch (e) {
      alert('加载失败: ' + e.message);
    }
  },

  async renderDetail(container) {
    const r = this.detail;
    if (!r) { window.location.hash = 'recipes'; return; }

    container.innerHTML = `
      <button class="btn-sm" id="back-btn" style="margin-bottom:12px;">← 返回</button>
      <div class="card">
        <h2 style="font-size:16px;margin-bottom:8px;">${App.escapeHtml(r.name)}</h2>
        <div style="font-size:12px;color:var(--text-secondary);display:flex;gap:12px;margin-bottom:12px;">
          <span>⏱ ${r.cook_time} 分钟</span>
          <span>${r.difficulty}</span>
          <span>做过 ${r.cook_count} 次</span>
        </div>

        <h3 style="font-size:13px;margin-bottom:6px;">🛒 食材</h3>
        <div class="recipe-detail-ingredients">
          ${(r.ingredients || []).map(i =>
            `<div class="recipe-detail-ingredient">
              <span>${App.escapeHtml(i.ingredient_name)} ${i.optional ? '(可选)' : ''}</span>
              <span>${i.quantity} ${i.unit}</span>
            </div>`
          ).join('')}
        </div>

        <h3 style="font-size:13px;margin:12px 0 6px;">👨‍🍳 做法</h3>
        ${(r.steps || []).map((step, i) =>
          `<div class="recipe-detail-step">
            <span class="recipe-detail-step-num">${i + 1}</span>
            ${App.escapeHtml(step)}
          </div>`
        ).join('')}

        ${r.tips ? `<div style="margin-top:12px;padding:8px;background:#fff7ed;border-radius:6px;font-size:12px;color:var(--warning);">💡 ${App.escapeHtml(r.tips)}</div>` : ''}

        <button class="btn btn-block" id="cook-btn" style="margin-top:12px;">✅ 我做过了</button>
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', () => { window.location.hash = 'recipes'; });
    document.getElementById('cook-btn').addEventListener('click', async () => {
      try {
        await Api.addCookLog({ recipe_id: r.id });
        alert('记录成功！');
        window.location.hash = 'recipes';
      } catch (e) {
        alert('记录失败: ' + e.message);
      }
    });
  },

  showForm() {
    const overlay = App.showModal(`
      <div class="modal-title">添加菜谱</div>
      <div class="form-group">
        <label class="form-label">菜名</label>
        <input class="input" id="r-name" placeholder="菜名">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">烹饪时间(分钟)</label>
          <input class="input" id="r-time" type="number" value="15" min="1">
        </div>
        <div class="form-group">
          <label class="form-label">难度</label>
          <select class="input" id="r-difficulty">
            <option>简单</option>
            <option>中等</option>
            <option>困难</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">食材（每行一个，格式: 名称,数量,单位,是否可选）</label>
        <textarea class="input" id="r-ingredients" rows="4" placeholder="番茄,2,个&#10;鸡蛋,3,个"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">做法步骤（每行一步）</label>
        <textarea class="input" id="r-steps" rows="5" placeholder="番茄切块&#10;鸡蛋打散&#10;炒锅加油..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">小贴士（可选）</label>
        <input class="input" id="r-tips" placeholder="小贴士">
      </div>
      <button class="btn btn-block" id="r-save">保存菜谱</button>
    `);

    document.getElementById('r-save').addEventListener('click', async () => {
      const name = document.getElementById('r-name').value.trim();
      if (!name) { alert('请输入菜名'); return; }

      const steps = document.getElementById('r-steps').value.split('\n').filter(s => s.trim());
      const ingredients = document.getElementById('r-ingredients').value.split('\n').filter(s => s.trim()).map(line => {
        const parts = line.split(',').map(s => s.trim());
        return { name: parts[0], quantity: parseFloat(parts[1]) || 1, unit: parts[2] || '', optional: parts[3] === '是' || parts[3] === 'true' };
      });

      try {
        await Api.addRecipe({
          name,
          steps,
          ingredients,
          cook_time: parseInt(document.getElementById('r-time').value) || 15,
          difficulty: document.getElementById('r-difficulty').value,
          tips: document.getElementById('r-tips').value.trim() || null
        });
        App.closeModal();
        await this.search();
      } catch (e) {
        alert('保存失败: ' + e.message);
      }
    });
  }
};
```

- [ ] **Step 2: 提交**

```bash
git add .
git commit -m "feat: recipes page with search, detail, and add form"
```

---

### Task 8: AI 推荐页面

**Files:**
- Create: `public/js/recommend.js`

- [ ] **Step 1: 创建 `public/js/recommend.js`**

```javascript
const RecommendPage = {
  ingredients: [],

  async render(container) {
    this.ingredients = await Api.getIngredients() || [];

    container.innerHTML = `
      <div class="recommend-header">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">当前冰箱库存</p>
        <div class="recommend-ingredients" id="stock-tags">
          ${this.ingredients.map(i => `<span class="recommend-ingredient">${App.escapeHtml(i.name)}</span>`).join('')}
        </div>
        ${this.ingredients.length === 0 ? '<p style="color:var(--text-secondary);font-size:13px;">冰箱是空的，先去添加食材吧</p>' : ''}
      </div>
      <button class="btn btn-block" id="recommend-btn" ${this.ingredients.length === 0 ? 'disabled' : ''}>
        🔀 看看能做什么
      </button>
      <div id="recommend-result" style="margin-top:16px;"></div>
    `;

    document.getElementById('recommend-btn').addEventListener('click', () => this.doRecommend());
  },

  async doRecommend() {
    const resultEl = document.getElementById('recommend-result');
    App.showLoading(resultEl);

    try {
      const data = await Api.recommend(this.ingredients.map(i => i.name));
      resultEl.innerHTML = '';

      // 已有菜谱匹配
      if (data.matched && data.matched.length > 0) {
        resultEl.innerHTML += `
          <h3 style="font-size:14px;margin-bottom:10px;">📋 库存能做的菜</h3>
          ${data.matched.map(r => `
            <div class="card" style="cursor:pointer;" data-recipe-id="${r.id}">
              <div style="font-weight:600;font-size:14px;">${App.escapeHtml(r.name)}</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">
                已做过 ${r.cook_count} 次
              </div>
            </div>
          `).join('')}
        `;
        resultEl.querySelectorAll('[data-recipe-id]').forEach(el => {
          el.addEventListener('click', () => {
            RecipesPage.detail = { id: parseInt(el.dataset.recipeId) };
            RecipesPage.showDetail(parseInt(el.dataset.recipeId));
          });
        });
      }

      // AI 推荐的新菜谱
      if (data.ai && data.ai.length > 0) {
        resultEl.innerHTML += `
          <h3 style="font-size:14px;margin:16px 0 10px;">🤖 AI 推荐的新菜谱</h3>
          ${data.ai.map((recipe, idx) => `
            <div class="card">
              <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${App.escapeHtml(recipe.name)}</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">
                ⏱ ${recipe.cook_time}min · ${recipe.difficulty}
              </div>
              <div style="font-size:12px;margin-bottom:6px;">
                🛒 ${(recipe.ingredients || []).map(i =>
                  `${App.escapeHtml(i.name)}${i.optional ? '(可选)' : ''}`
                ).join('、')}
              </div>
              <button class="btn-sm" data-save-ai="${idx}">💾 保存到菜谱</button>
            </div>
          `).join('')}
        `;
        resultEl.querySelectorAll('[data-save-ai]').forEach(btn => {
          const idx = parseInt(btn.dataset.saveAi);
          btn.addEventListener('click', async () => {
            try {
              await Api.addRecipe(data.ai[idx]);
              btn.textContent = '✅ 已保存';
              btn.disabled = true;
            } catch (e) {
              alert('保存失败: ' + e.message);
            }
          });
        });
      }

      if ((!data.matched || data.matched.length === 0) && (!data.ai || data.ai.length === 0)) {
        if (data.ai_raw) {
          resultEl.innerHTML += `
            <h3 style="font-size:14px;margin-bottom:8px;">🤖 AI 推荐</h3>
            <div class="card" style="font-size:13px;line-height:1.6;white-space:pre-wrap;">${App.escapeHtml(data.ai_raw)}</div>
          `;
        } else {
          resultEl.innerHTML = '<div class="empty-state"><p>暂时没有推荐结果</p></div>';
        }
      }
    } catch (e) {
      App.showError(resultEl, `推荐失败: ${e.message}`);
    }
  }
};
```

- [ ] **Step 2: 提交**

```bash
git add .
git commit -m "feat: AI recommend page with ingredient analysis"
```

---

### Task 9: 做菜记录页面

**Files:**
- Create: `public/js/cook-logs.js`

- [ ] **Step 1: 创建 `public/js/cook-logs.js`**

```javascript
const CookLogsPage = {
  async render(container) {
    container.innerHTML = '<div id="logs-list"></div>';
    await this.loadLogs();
  },

  async loadLogs() {
    const listEl = document.getElementById('logs-list');
    App.showLoading(listEl);
    try {
      const logs = await Api.getCookLogs() || [];
      if (!logs.length) {
        listEl.innerHTML = '<div class="empty-state"><p>还没有做菜记录</p></div>';
        return;
      }
      // 按日期分组
      const groups = {};
      for (const log of logs) {
        const date = log.cooked_at.split(' ')[0];
        if (!groups[date]) groups[date] = [];
        groups[date].push(log);
      }
      listEl.innerHTML = Object.entries(groups).map(([date, items]) => `
        <div style="margin-bottom:12px;">
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">${date}</div>
          ${items.map(log => `
            <div class="card log-item">
              <div>
                <div class="log-recipe-name">${App.escapeHtml(log.recipe_name)}</div>
                <div class="log-date">${log.cooked_at}</div>
              </div>
              <div style="margin-left:auto;text-align:right;">
                ${log.rating ? `<div class="log-rating">${'★'.repeat(log.rating)}${'☆'.repeat(5-log.rating)}</div>` : ''}
                ${log.note ? `<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${App.escapeHtml(log.note)}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `).join('');
    } catch (e) {
      App.showError(listEl, `加载失败: ${e.message}`);
    }
  }
};
```

- [ ] **Step 2: 提交**

```bash
git add .
git commit -m "feat: cook logs page with history timeline"
```

---

### Task 10: 集成测试

**Files:**
- None (修复文件)

- [ ] **Step 1: 运行本地开发服务器**

```bash
cd /c/Users/le241/Desktop/Claude项目/recipe-fridge
npx wrangler pages dev public --d1 DB --port 8789
```

- [ ] **Step 2: 验证功能**

1. 打开 http://localhost:8789
2. 冰箱页：添加食材（番茄、鸡蛋、青椒、鸡胸肉）
3. 菜谱页：手动添加一个菜谱（番茄炒蛋），包含食材关联
4. AI 推荐页：点击"看看能做什么"，检查返回结果
5. 做菜记录页：确认记录为空

- [ ] **Step 3: 修复发现的问题**

修复代码中的问题，确保所有功能正常工作。

- [ ] **Step 4: 最终提交**

```bash
git add .
git commit -m "chore: final integration adjustments"
```
