// functions/api/ai/[[catchall]].js
import { getDb, success, error } from '../_db.js';

async function callDeepSeek(apiKey, messages) {
  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages,
      temperature: 0.7,
      max_tokens: 4096
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`DeepSeek API 错误: ${err}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

function extractJson(text) {
  text = text.trim();
  // Direct parse
  try { return JSON.parse(text); } catch {}
  // Remove markdown code block markers and try again
  let cleaned = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  // Find the outermost JSON array/object brackets
  const firstBrace = text.indexOf('[');
  const firstCurly = text.indexOf('{');
  if (firstBrace >= 0) {
    // Try to extract array from [ to the last ]
    const lastBrace = text.lastIndexOf(']');
    if (lastBrace > firstBrace) {
      try { return JSON.parse(text.slice(firstBrace, lastBrace + 1)); } catch {}
    }
  }
  if (firstCurly >= 0) {
    const lastCurly = text.lastIndexOf('}');
    if (lastCurly > firstCurly) {
      try { return JSON.parse(text.slice(firstCurly, lastCurly + 1)); } catch {}
    }
  }
  throw new Error('No valid JSON found in response');
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

      if (ingredients.length === 0) {
        return success({ matched: [], ai: [] });
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
        aiRecipes = extractJson(aiText);
      } catch {
        return success({ matched: matchedRecipes, ai_raw: aiText });
      }

      return success({ matched: matchedRecipes, ai: aiRecipes });
    }

    // POST /api/ai/generate — 无食材也能生成
    if (url.pathname.endsWith('/generate')) {
      const ingredients = body.ingredients || [];
      const preference = body.preference || '随便推荐几道家常菜';
      const stream = body.stream === true;

      const prompt = `你是一个家常菜谱助手。请根据以下要求推荐菜谱，只输出 JSON，不要任何其他文字。

要求：${preference}
${ingredients.length > 0 ? `可用食材：${ingredients.join('、')}` : '无特定食材限制'}

请输出 JSON 数组（至少3道菜），格式严格如下：
[
  {
    "name": "菜名",
    "ingredients": [{"name": "食材名", "quantity": 数值, "unit": "单位", "optional": false}],
    "steps": ["步骤1", "步骤2"],
    "cook_time": 分钟数,
    "difficulty": "简单",
    "tips": "小贴士"
  }
]`;

      // 流式输出
      if (stream) {
        const deepseekResp = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-v4-flash',
            messages: [
              { role: 'system', content: '你是一个家常菜谱助手。只输出 JSON 数组，不要任何其他文字或注释。' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 4096,
            stream: true
          })
        });

        if (!deepseekResp.ok) {
          const err = await deepseekResp.text();
          throw new Error(`DeepSeek API 错误: ${err}`);
        }

        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        (async () => {
          try {
            const reader = deepseekResp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') continue;
                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content || '';
                    if (content) {
                      writer.write(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                    }
                  } catch {}
                }
              }
            }
          } catch (e) {
            writer.write(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
          } finally {
            writer.write(encoder.encode('data: [DONE]\n\n'));
            writer.close();
          }
        })();

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        });
      }

      // 非流式
      const aiText = await callDeepSeek(apiKey, [
        { role: 'system', content: '你是一个家常菜谱助手。只输出 JSON 数组，不要任何其他文字或注释。' },
        { role: 'user', content: prompt }
      ]);

      let parsed;
      try {
        parsed = extractJson(aiText);
      } catch {
        return success({ raw: aiText });
      }

      // 返回数组，不存库（由前端保存按钮触发入库）
      const recipes = Array.isArray(parsed) ? parsed : [parsed];
      // 给每个 recipe 临时 id 用于前端索引
      recipes.forEach((r, i) => { if (r.name) r._tmpId = i; });
      return success({ recipes: recipes.filter(r => r.name) });
    }

    // POST /api/ai/search — 网上搜菜谱（AI 模拟爬取）
    if (url.pathname.endsWith('/search')) {
      const query = body.query || '';
      if (!query) return error('请输入要搜索的菜谱');

      const prompt = `用户想找这样的菜谱：${query}。
请推荐5道相关的菜，用 JSON 数组格式返回，每道菜包含完整信息：
[
  {
    "name": "菜名",
    "ingredients": [{"name": "食材名", "quantity": "用量数值", "unit": "单位", "optional": false}],
    "steps": ["步骤1", "步骤2", "..."],
    "cook_time": 分钟数,
    "difficulty": "简单/中等/困难",
    "tips": "小贴士"
  }
]
请确保每道菜都有完整的食材用量和详细做法步骤。`;

      const aiText = await callDeepSeek(apiKey, [
        { role: 'system', content: '你是一个菜谱搜索助手。只输出 JSON 数组，不要任何其他文字。' },
        { role: 'user', content: prompt }
      ]);

      let recipes = [];
      try {
        recipes = extractJson(aiText);
      } catch {
        return success({ raw: aiText });
      }

      return success({ recipes });
    }

    return error('Unknown action', 404);
  } catch (e) {
    return error(e.message, 500);
  }
}
