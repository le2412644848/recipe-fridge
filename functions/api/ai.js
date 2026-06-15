// functions/api/ai.js
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

  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (method !== 'POST') return error('Method not allowed', 405);

  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) return error('未配置 DeepSeek API Key', 500);

  const db = getDb(context);

  try {
    const body = await request.json();

    // POST /api/ai/recommend
    if (url.pathname.endsWith('/recommend')) {
      const ingredients = body.ingredients || [];
      if (ingredients.length === 0) return error('请提供食材列表');

      // 从已有菜谱中匹配
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

      // AI 生成新推荐
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
        return success({ matched: matchedRecipes, ai_raw: aiText });
      }

      return success({ matched: matchedRecipes, ai: aiRecipes });
    }

    // POST /api/ai/generate
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
