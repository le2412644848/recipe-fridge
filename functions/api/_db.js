// functions/api/_db.js
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

export function success(data, status = 200) {
  return json({ code: 200, data, message: 'ok' }, status);
}
