// public/js/api.js
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
