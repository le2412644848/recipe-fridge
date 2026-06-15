# 智能冰箱食谱工具 - 设计文档

> 基于现有食材的随机食谱推荐工具。记录冰箱里有什么，AI 推荐能做什么菜。

**技术栈：** Cloudflare Pages + Pages Functions + D1 数据库 + DeepSeek API
**前端：** 纯 HTML/CSS/JS SPA + PWA
**部署：** Cloudflare Pages，零服务端运维

---

## 架构

```
用户 → 浏览器（PWA 添加到手机桌面）
         ↓
Cloudflare Pages（静态资源 CDN）
         ↓
Pages Function（API 代理层）
         ├── D1 数据库（菜谱、食材、做菜记录）
         └── DeepSeek API（AI 推荐/菜谱生成）
```

所有 API 请求经过 Pages Function 代理，前端不直接调用 DeepSeek，避免跨域和 Key 泄露。

## 页面

四个页面，底部 Tab 导航：

### 1. 冰箱页（首页）
- 食材库存列表，按分类分组展示（蔬菜/肉类/调料/主食/其他）
- 即将过期食材置顶提醒（红色标记）
- 添加食材弹窗：名称、分类、数量、单位、过期日
- 点击食材可编辑数量或删除

### 2. 菜谱页
- 搜索框（按菜名或食材搜索）
- 卡片列表展示菜谱：菜名、图片、难度、烹饪时间
- 点击进入菜谱详情：食材清单、做法步骤
- 标记"已做过"按钮
- 添加菜谱入口（AI 生成或手动录入）

### 3. AI 推荐页
- 显示当前库存摘要
- 自动分析：哪些菜能直接做、缺什么才能做其他菜
- "随机选一道"按钮：从能做的菜里随机选一个
- 支持用 AI 生成新菜谱（基于现有食材创作）

### 4. 做菜记录页
- 历史做菜记录时间线
- 评分和备注显示
- 哪些菜做得最多统计

## 数据模型

### ingredients（食材库存）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| name | TEXT NOT NULL | 食材名称 |
| category | TEXT | 分类（蔬菜/肉类/调料/主食/其他） |
| quantity | REAL | 库存数量 |
| unit | TEXT | 单位（个/克/毫升/把/根） |
| expiry_date | TEXT | 过期日期（可选，格式 YYYY-MM-DD） |
| created_at | TEXT | 添加时间 |
| updated_at | TEXT | 更新时间 |

### recipes（菜谱库）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| name | TEXT NOT NULL | 菜名 |
| image | TEXT | 图片 URL |
| steps | TEXT | 做法步骤（JSON 数组） |
| difficulty | TEXT | 难度（简单/中等/困难） |
| cook_time | INTEGER | 烹饪时间（分钟） |
| tips | TEXT | 小贴士 |
| source | TEXT | 来源（ai/manual） |
| created_at | TEXT | 添加时间 |
| cook_count | INTEGER DEFAULT 0 | 做过次数 |

### recipe_ingredients（菜谱-食材关联）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| recipe_id | INTEGER | 关联菜谱 ID |
| ingredient_name | TEXT | 食材名称 |
| quantity | REAL | 用量 |
| unit | TEXT | 单位 |
| optional | INTEGER DEFAULT 0 | 是否可选（0 必需/1 可选） |

### cook_logs（做菜记录）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| recipe_id | INTEGER | 关联菜谱 ID |
| cooked_at | TEXT | 做菜时间 |
| rating | INTEGER | 评分（1-5，可空） |
| note | TEXT | 备注（可空） |

## API 接口

所有接口返回 `{ code: 200, data: ..., message: "ok" }` 格式。

### 食材
- `GET /api/ingredients` — 列表，支持 `?expiring=1` 过滤即将过期
- `POST /api/ingredients` — 添加 `{ name, category, quantity, unit, expiry_date? }`
- `PUT /api/ingredients/:id` — 更新 `{ quantity?, expiry_date? }`
- `DELETE /api/ingredients/:id` — 删除
- `POST /api/ingredients/consume` — 消耗食材 `{ id, quantity }`

### 菜谱
- `GET /api/recipes` — 搜索 `?q=关键字&ingredient=食材`
- `GET /api/recipes/:id` — 详情（含关联食材）
- `POST /api/recipes` — 添加（含关联食材数组）
- `DELETE /api/recipes/:id` — 删除

### AI 推荐
- `POST /api/ai/recommend` — 请求体 `{ ingredients: ["番茄","鸡蛋"...] }`，返回推荐菜谱列表（已有的 + AI 生成的）
- `POST /api/ai/generate` — 用 AI 生成新菜谱 `{ ingredients: [...], preference: "下饭" }`

### 做菜记录
- `GET /api/cook-logs` — 记录列表，支持 `?recipe_id=1` 过滤
- `POST /api/cook-logs` — 新增 `{ recipe_id, rating?, note? }`

## 费用估算

基于 DeepSeek V4 Flash 定价：
- 每次 AI 推荐/生成：输入 ~1000 tokens + 输出 ~1200 tokens ≈ $0.0005
- 每天 10 次使用：~$0.15/月
- Cloudflare D1：免费额度（5GB 存储，每月 500 万行读取）
- Cloudflare Pages：免费额度
- **总计：个人使用基本免费**

## 非功能性需求

- PWA 支持：manifest.json + Service Worker，可添加到手机桌面
- 响应式设计：手机优先，桌面适配
- 离线缓存：Service Worker 缓存静态资源，API 请求在线工作
- DeepSeek API 通过 Pages Function 代理，前端不暴露 Key
