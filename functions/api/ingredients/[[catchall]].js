// functions/api/ingredients/[[catchall]].js
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
  const action = parts[3] && isNaN(parts[3]) ? parts[3] : null;

  const db = getDb(context);

  try {
    // GET /api/ingredients — 列表
    if (method === 'GET' && !id) {
      let sql = 'SELECT * FROM ingredients';
      const params = [];
      if (url.searchParams.get('expiring')) {
        sql += ` WHERE expiry_date IS NOT NULL AND expiry_date <= date('now', '+3 days') AND expiry_date >= date('now')`;
      }
      sql += ' ORDER BY category, name';
      const result = await db.prepare(sql).all();
      return success(result.results);
    }

    // GET /api/ingredients/:id
    if (method === 'GET' && id) {
      const result = await db.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first();
      if (!result) return error('食材不存在', 404);
      return success(result);
    }

    // POST /api/ingredients — 添加
    if (method === 'POST' && !id && !action) {
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

    // PUT /api/ingredients/:id — 更新
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

    // DELETE /api/ingredients/:id
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
      await db.prepare(
        "UPDATE ingredients SET quantity = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(newQty, body.id).run();
      return success({ id: body.id, remaining: newQty });
    }

    return error('Method not allowed', 405);
  } catch (e) {
    return error(e.message, 500);
  }
}
