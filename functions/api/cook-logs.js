// functions/api/cook-logs.js
import { getDb, success, error } from './_db.js';

export async function onRequest(context) {
  const { request } = context;
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  const db = getDb(context);

  try {
    // GET /api/cook-logs
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

    // POST /api/cook-logs
    if (method === 'POST') {
      const body = await request.json();
      if (!body.recipe_id) return error('缺少必填字段: recipe_id');

      const result = await db.prepare(
        `INSERT INTO cook_logs (recipe_id, rating, note) VALUES (?, ?, ?)`
      ).bind(body.recipe_id, body.rating || null, body.note || null).run();

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
