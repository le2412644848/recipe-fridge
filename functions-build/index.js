var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/_cors.js
async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(onRequestOptions, "onRequestOptions");
async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return onRequestOptions();
  }
}
__name(onRequest, "onRequest");

// api/_db.js
function getDb(context) {
  return context.env.DB;
}
__name(getDb, "getDb");
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}
__name(json, "json");
function error(msg, status = 400) {
  return json({ code: status, data: null, message: msg }, status);
}
__name(error, "error");
function success(data, status = 200) {
  return json({ code: 200, data, message: "ok" }, status);
}
__name(success, "success");

// api/ai.js
async function callDeepSeek(apiKey, messages) {
  const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 0.7,
      max_tokens: 2048
    })
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`DeepSeek API \u9519\u8BEF: ${err}`);
  }
  const data = await resp.json();
  return data.choices[0].message.content;
}
__name(callDeepSeek, "callDeepSeek");
async function onRequest2(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }
  if (method !== "POST") return error("Method not allowed", 405);
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) return error("\u672A\u914D\u7F6E DeepSeek API Key", 500);
  const db = getDb(context);
  try {
    const body = await request.json();
    if (url.pathname.endsWith("/recommend")) {
      const ingredients = body.ingredients || [];
      if (ingredients.length === 0) return error("\u8BF7\u63D0\u4F9B\u98DF\u6750\u5217\u8868");
      let matchedRecipes = [];
      if (ingredients.length > 0) {
        const placeholders = ingredients.map(() => "?").join(",");
        const rows = await db.prepare(
          `SELECT r.*, GROUP_CONCAT(ri.ingredient_name) as need_ingredients
           FROM recipes r
           JOIN recipe_ingredients ri ON r.id = ri.recipe_id
           WHERE ri.ingredient_name IN (${placeholders})
           GROUP BY r.id`
        ).bind(...ingredients).all();
        matchedRecipes = rows.results;
      }
      const prompt = `\u6211\u51B0\u7BB1\u91CC\u6709\u4EE5\u4E0B\u98DF\u6750\uFF1A${ingredients.join("\u3001")}\u3002
\u8BF7\u63A8\u83503\u9053\u5BB6\u5E38\u83DC\uFF0C\u8981\u6C42\uFF1A
1. \u4F18\u5148\u4F7F\u7528\u73B0\u6709\u98DF\u6750
2. \u6BCF\u9053\u83DC\u5217\u51FA\uFF1A\u83DC\u540D\u3001\u6240\u9700\u98DF\u6750\uFF08\u6807\u6CE8\u54EA\u4E9B\u5DF2\u5728\u51B0\u7BB1\u3001\u9700\u8865\u5145\u4EC0\u4E48\uFF09\u3001\u505A\u6CD5\u6B65\u9AA4\u3001\u70F9\u996A\u65F6\u95F4\u3001\u96BE\u5EA6
3. \u7528 JSON \u683C\u5F0F\u8FD4\u56DE\uFF0C\u683C\u5F0F\u4E3A\uFF1A
[
  {
    "name": "\u83DC\u540D",
    "ingredients": [{"name": "\u98DF\u6750\u540D", "quantity": "\u7528\u91CF", "unit": "\u5355\u4F4D", "optional": false}],
    "steps": ["\u6B65\u9AA41", "\u6B65\u9AA42"],
    "cook_time": 15,
    "difficulty": "\u7B80\u5355"
  }
]`;
      const aiText = await callDeepSeek(apiKey, [
        { role: "system", content: "\u4F60\u662F\u4E00\u4E2A\u5BB6\u5E38\u83DC\u8C31\u63A8\u8350\u52A9\u624B\u3002\u59CB\u7EC8\u7528\u4E2D\u6587\u56DE\u590D\u3002" },
        { role: "user", content: prompt }
      ]);
      let aiRecipes = [];
      try {
        aiRecipes = JSON.parse(aiText.replace(/```json|```/g, "").trim());
      } catch {
        return success({ matched: matchedRecipes, ai_raw: aiText });
      }
      return success({ matched: matchedRecipes, ai: aiRecipes });
    }
    if (url.pathname.endsWith("/generate")) {
      const ingredients = body.ingredients || [];
      const preference = body.preference || "";
      const prompt = `\u7528\u4EE5\u4E0B\u98DF\u6750\u521B\u4F5C\u4E00\u9053\u65B0\u83DC\uFF1A${ingredients.join("\u3001")}${preference ? "\uFF0C\u504F\u597D\uFF1A" + preference : ""}\u3002
\u8BF7\u7528 JSON \u683C\u5F0F\u8FD4\u56DE\uFF1A
{
  "name": "\u83DC\u540D",
  "ingredients": [{"name": "\u98DF\u6750\u540D", "quantity": "\u7528\u91CF", "unit": "\u5355\u4F4D", "optional": false}],
  "steps": ["\u6B65\u9AA41", "\u6B65\u9AA42", "..."],
  "cook_time": \u5206\u949F\u6570,
  "difficulty": "\u7B80\u5355/\u4E2D\u7B49/\u56F0\u96BE",
  "tips": "\u5C0F\u8D34\u58EB"
}`;
      const aiText = await callDeepSeek(apiKey, [
        { role: "system", content: "\u4F60\u662F\u4E00\u4E2A\u521B\u610F\u83DC\u8C31\u751F\u6210\u52A9\u624B\u3002\u59CB\u7EC8\u7528\u4E2D\u6587\u56DE\u590D\u3002" },
        { role: "user", content: prompt }
      ]);
      let recipe;
      try {
        recipe = JSON.parse(aiText.replace(/```json|```/g, "").trim());
      } catch {
        return success({ raw: aiText });
      }
      const result = await db.prepare(
        `INSERT INTO recipes (name, image, steps, difficulty, cook_time, tips, source)
         VALUES (?, ?, ?, ?, ?, ?, 'ai')`
      ).bind(recipe.name, null, JSON.stringify(recipe.steps), recipe.difficulty || "\u7B80\u5355", recipe.cook_time || 15, recipe.tips || null).run();
      const recipeId = result.meta.last_row_id;
      if (recipe.ingredients) {
        const stmt = db.prepare(
          `INSERT INTO recipe_ingredients (recipe_id, ingredient_name, quantity, unit, optional)
           VALUES (?, ?, ?, ?, ?)`
        );
        for (const ing of recipe.ingredients) {
          await stmt.bind(recipeId, ing.name, ing.quantity || 0, ing.unit || "", ing.optional ? 1 : 0).run();
        }
      }
      return success({ id: recipeId, recipe }, 201);
    }
    return error("Unknown action", 404);
  } catch (e) {
    return error(e.message, 500);
  }
}
__name(onRequest2, "onRequest");

// api/cook-logs.js
async function onRequest3(context) {
  const { request } = context;
  const method = request.method;
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }
  const db = getDb(context);
  try {
    if (method === "GET") {
      const { searchParams } = new URL(request.url);
      let sql = `SELECT cl.*, r.name as recipe_name FROM cook_logs cl
                 JOIN recipes r ON cl.recipe_id = r.id`;
      const params = [];
      if (searchParams.get("recipe_id")) {
        sql += " WHERE cl.recipe_id = ?";
        params.push(parseInt(searchParams.get("recipe_id")));
      }
      sql += " ORDER BY cl.cooked_at DESC";
      const result = await db.prepare(sql).bind(...params).all();
      return success(result.results);
    }
    if (method === "POST") {
      const body = await request.json();
      if (!body.recipe_id) return error("\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5: recipe_id");
      const result = await db.prepare(
        `INSERT INTO cook_logs (recipe_id, rating, note) VALUES (?, ?, ?)`
      ).bind(body.recipe_id, body.rating || null, body.note || null).run();
      await db.prepare(
        "UPDATE recipes SET cook_count = cook_count + 1 WHERE id = ?"
      ).bind(body.recipe_id).run();
      return success({ id: result.meta.last_row_id }, 201);
    }
    return error("Method not allowed", 405);
  } catch (e) {
    return error(e.message, 500);
  }
}
__name(onRequest3, "onRequest");

// api/ingredients.js
async function onRequest4(context) {
  const { request } = context;
  const url = new URL(request.url);
  const method = request.method;
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }
  const parts = url.pathname.split("/");
  const id = parts[3] && !isNaN(parts[3]) ? parseInt(parts[3]) : null;
  const action = parts[3] && isNaN(parts[3]) ? parts[3] : null;
  const db = getDb(context);
  try {
    if (method === "GET" && !id) {
      let sql = "SELECT * FROM ingredients";
      const params = [];
      if (url.searchParams.get("expiring")) {
        sql += ` WHERE expiry_date IS NOT NULL AND expiry_date <= date('now', '+3 days') AND expiry_date >= date('now')`;
      }
      sql += " ORDER BY category, name";
      const result = await db.prepare(sql).all();
      return success(result.results);
    }
    if (method === "GET" && id) {
      const result = await db.prepare("SELECT * FROM ingredients WHERE id = ?").bind(id).first();
      if (!result) return error("\u98DF\u6750\u4E0D\u5B58\u5728", 404);
      return success(result);
    }
    if (method === "POST" && !id && !action) {
      const body = await request.json();
      if (!body.name || body.quantity === void 0) {
        return error("\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5: name, quantity");
      }
      const result = await db.prepare(
        `INSERT INTO ingredients (name, category, quantity, unit, expiry_date)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        body.name,
        body.category || "\u5176\u4ED6",
        body.quantity,
        body.unit || "\u4E2A",
        body.expiry_date || null
      ).run();
      return success({ id: result.meta.last_row_id }, 201);
    }
    if (method === "PUT" && id) {
      const body = await request.json();
      const sets = [];
      const params = [];
      for (const key of ["name", "category", "quantity", "unit", "expiry_date"]) {
        if (body[key] !== void 0) {
          sets.push(`${key} = ?`);
          params.push(body[key]);
        }
      }
      if (sets.length === 0) return error("\u6CA1\u6709\u8981\u66F4\u65B0\u7684\u5B57\u6BB5");
      sets.push("updated_at = datetime('now')");
      params.push(id);
      await db.prepare(`UPDATE ingredients SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
      return success({ id });
    }
    if (method === "DELETE" && id) {
      await db.prepare("DELETE FROM ingredients WHERE id = ?").bind(id).run();
      return success({ id });
    }
    if (method === "POST" && action === "consume") {
      const body = await request.json();
      if (!body.id || !body.quantity) return error("\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5");
      const ing = await db.prepare("SELECT * FROM ingredients WHERE id = ?").bind(body.id).first();
      if (!ing) return error("\u98DF\u6750\u4E0D\u5B58\u5728", 404);
      const newQty = Math.max(0, ing.quantity - body.quantity);
      await db.prepare(
        "UPDATE ingredients SET quantity = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(newQty, body.id).run();
      return success({ id: body.id, remaining: newQty });
    }
    return error("Method not allowed", 405);
  } catch (e) {
    return error(e.message, 500);
  }
}
__name(onRequest4, "onRequest");

// api/recipes.js
async function onRequest5(context) {
  const { request } = context;
  const url = new URL(request.url);
  const method = request.method;
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }
  const parts = url.pathname.split("/");
  const id = parts[3] && !isNaN(parts[3]) ? parseInt(parts[3]) : null;
  const db = getDb(context);
  try {
    if (method === "GET" && !id) {
      const q = url.searchParams.get("q");
      const ingredient = url.searchParams.get("ingredient");
      let sql = "SELECT r.* FROM recipes r";
      const params = [];
      if (ingredient) {
        sql = `SELECT DISTINCT r.* FROM recipes r
               JOIN recipe_ingredients ri ON r.id = ri.recipe_id
               WHERE ri.ingredient_name = ?`;
        params.push(ingredient);
      } else if (q) {
        sql = "SELECT r.* FROM recipes r WHERE r.name LIKE ?";
        params.push(`%${q}%`);
      }
      sql += " ORDER BY r.cook_count DESC";
      const result = await db.prepare(sql).bind(...params).all();
      return success(result.results.map((r) => ({ ...r, steps: JSON.parse(r.steps) })));
    }
    if (method === "GET" && id) {
      const recipe = await db.prepare("SELECT * FROM recipes WHERE id = ?").bind(id).first();
      if (!recipe) return error("\u83DC\u8C31\u4E0D\u5B58\u5728", 404);
      recipe.steps = JSON.parse(recipe.steps);
      const ingredients = await db.prepare(
        "SELECT * FROM recipe_ingredients WHERE recipe_id = ?"
      ).bind(id).all();
      recipe.ingredients = ingredients.results;
      return success(recipe);
    }
    if (method === "POST" && !id) {
      const body = await request.json();
      if (!body.name) return error("\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5: name");
      const steps = JSON.stringify(body.steps || []);
      const result = await db.prepare(
        `INSERT INTO recipes (name, image, steps, difficulty, cook_time, tips, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        body.name,
        body.image || null,
        steps,
        body.difficulty || "\u7B80\u5355",
        body.cook_time || 15,
        body.tips || null,
        body.source || "manual"
      ).run();
      const recipeId = result.meta.last_row_id;
      if (body.ingredients && body.ingredients.length > 0) {
        const stmt = db.prepare(
          `INSERT INTO recipe_ingredients (recipe_id, ingredient_name, quantity, unit, optional)
           VALUES (?, ?, ?, ?, ?)`
        );
        for (const ing of body.ingredients) {
          await stmt.bind(recipeId, ing.name, ing.quantity || 0, ing.unit || "", ing.optional ? 1 : 0).run();
        }
      }
      return success({ id: recipeId }, 201);
    }
    if (method === "DELETE" && id) {
      await db.prepare("DELETE FROM recipes WHERE id = ?").bind(id).run();
      return success({ id });
    }
    return error("Method not allowed", 405);
  } catch (e) {
    return error(e.message, 500);
  }
}
__name(onRequest5, "onRequest");

// ../.wrangler/tmp/pages-6tYDqD/functionsRoutes-0.484564988702626.mjs
var routes = [
  {
    routePath: "/api/_cors",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions]
  },
  {
    routePath: "/api/_cors",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/ai",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/cook-logs",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  },
  {
    routePath: "/api/ingredients",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest4]
  },
  {
    routePath: "/api/recipes",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest5]
  }
];

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error2) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error2;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
