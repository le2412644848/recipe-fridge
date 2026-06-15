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
  getRecipes(q, tag) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (tag) params.set('tag', tag);
    const qs = params.toString();
    return this.request('GET', `/api/recipes${qs ? '?' + qs : ''}`);
  },
  getRecipe(id) { return this.request('GET', `/api/recipes/${id}`); },
  addRecipe(data) { return this.request('POST', '/api/recipes', data); },
  updateRecipe(id, data) { return this.request('PUT', `/api/recipes/${id}`, data); },
  deleteRecipe(id) { return this.request('DELETE', `/api/recipes/${id}`); },

  // AI
  recommend(ingredients) {
    return this.request('POST', '/api/ai/recommend', { ingredients });
  },
  generate(ingredients, preference) {
    return this.request('POST', '/api/ai/generate', { ingredients, preference });
  },
  streamGenerate(ingredients, preference, onContent, onDone, onError) {
    fetch(this.base + '/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients, preference, stream: true })
    }).then(async resp => {
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(err);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let parseTimer = null;

      const tryParse = () => {
        try {
          const cleaned = accumulated.replace(/```json|```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          const recipes = Array.isArray(parsed) ? parsed : [parsed];
          onDone(recipes.filter(r => r.name));
          return true;
        } catch { return false; }
      };

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
              if (parsed.error) { onError?.(parsed.error); continue; }
              if (parsed.content) {
                accumulated += parsed.content;
                onContent(accumulated);
                // 每秒尝试解析一次
                if (!parseTimer) {
                  parseTimer = setTimeout(() => {
                    parseTimer = null;
                    if (!tryParse()) {
                      onContent(accumulated);
                    }
                  }, 1000);
                }
              }
            } catch {}
          }
        }
      }

      clearTimeout(parseTimer);
      // 最终解析
      if (!tryParse()) {
        onDone([]);
      }
    }).catch(e => onError?.(e.message));
  },
  searchWebRecipes(query) {
    return this.request('POST', '/api/ai/search', { query });
  },

  // 做菜记录
  getCookLogs(recipeId) {
    return this.request('GET', `/api/cook-logs${recipeId ? `?recipe_id=${recipeId}` : ''}`);
  },
  addCookLog(data) { return this.request('POST', '/api/cook-logs', data); }
};
