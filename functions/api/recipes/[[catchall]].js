// functions/api/recipes/[[catchall]].js
import { getDb, success, error } from '../_db.js';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  const parts = url.pathname.split('/');
  const id = parts[3] && !isNaN(parts[3]) ? parseInt(parts[3]) : null;

  const db = getDb(context);

  try {
    // GET /api/recipes — 搜索
    if (method === 'GET' && !id) {
      const q = url.searchParams.get('q');
      const ingredient = url.searchParams.get('ingredient');
      const tag = url.searchParams.get('tag');
      let sql = 'SELECT r.* FROM recipes r';
      const params = [];
      const wheres = [];

      if (ingredient) {
        sql = `SELECT DISTINCT r.* FROM recipes r
               JOIN recipe_ingredients ri ON r.id = ri.recipe_id`;
        wheres.push('ri.ingredient_name = ?');
        params.push(ingredient);
      }
      if (tag) {
        wheres.push('r.tags LIKE ?');
        params.push(`%${tag}%`);
      }
      if (q) {
        wheres.push('r.name LIKE ?');
        params.push(`%${q}%`);
      }
      if (wheres.length > 0) {
        sql += ' WHERE ' + wheres.join(' AND ');
      }
      sql += ' ORDER BY r.cook_count DESC';
      const result = await db.prepare(sql).bind(...params).all();
      return success(result.results.map(r => ({ ...r, steps: JSON.parse(r.steps) })));
    }

    // GET /api/recipes/:id — 详情
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

    // POST /api/recipes — 添加
    if (method === 'POST' && !id) {
      const body = await request.json();
      if (!body.name) return error('缺少必填字段: name');
      const steps = JSON.stringify(body.steps || []);
      const tags = body.tags ? (Array.isArray(body.tags) ? body.tags.join(',') : body.tags) : '';
      const result = await db.prepare(
        `INSERT INTO recipes (name, image, steps, difficulty, cook_time, tips, source, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        body.name, body.image || null, steps,
        body.difficulty || '简单', body.cook_time || 15,
        body.tips || null, body.source || 'manual', tags
      ).run();

      const recipeId = result.meta.last_row_id;

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

    // PUT /api/recipes/:id — 更新
    if (method === 'PUT' && id) {
      const body = await request.json();
      if (!body.name) return error('缺少必填字段: name');
      const steps = JSON.stringify(body.steps || []);
      const tags = body.tags ? (Array.isArray(body.tags) ? body.tags.join(',') : body.tags) : '';
      await db.prepare(
        `UPDATE recipes SET name = ?, image = ?, steps = ?, difficulty = ?, cook_time = ?, tips = ?, tags = ? WHERE id = ?`
      ).bind(
        body.name, body.image || null, steps,
        body.difficulty || '简单', body.cook_time || 15,
        body.tips || null, tags, id
      ).run();

      // 替换食材
      await db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').bind(id).run();
      if (body.ingredients && body.ingredients.length > 0) {
        const stmt = db.prepare(
          `INSERT INTO recipe_ingredients (recipe_id, ingredient_name, quantity, unit, optional)
           VALUES (?, ?, ?, ?, ?)`
        );
        for (const ing of body.ingredients) {
          await stmt.bind(id, ing.name, ing.quantity || 0, ing.unit || '', ing.optional ? 1 : 0).run();
        }
      }

      return success({ id });
    }

    // DELETE /api/recipes/:id
    if (method === 'DELETE' && id) {
      await db.prepare('DELETE FROM recipes WHERE id = ?').bind(id).run();
      return success({ id });
    }

    return error('Method not allowed', 405);
  } catch (e) {
    return error(e.message, 500);
  }
}
