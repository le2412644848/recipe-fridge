// public/js/recommend.js
const RecommendPage = {
  ingredients: [],

  async render(container) {
    try {
      this.ingredients = (await Api.getIngredients()) || [];
    } catch {
      this.ingredients = [];
    }

    container.innerHTML = `
      <div class="recommend-header">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">当前冰箱库存</p>
        <div class="recommend-ingredients" id="stock-tags">
          ${this.ingredients.length > 0
            ? this.ingredients.map(i => `<span class="recommend-ingredient">${App.escapeHtml(i.name)}</span>`).join('')
            : '<span style="color:var(--text-secondary);font-size:13px;">冰箱是空的</span>'}
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input class="input" id="craving-input" placeholder="想吃什么？输入菜系、口味或直接说随便...">
        <button class="btn" id="ai-generate-btn">🤖 生成</button>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <button class="btn btn-sm" id="recommend-btn" style="flex:1;background:var(--card-bg);color:var(--text);border:1px solid var(--border);">
          📋 根据库存推荐
        </button>
        <button class="btn btn-sm" id="surprise-btn" style="flex:1;background:var(--card-bg);color:var(--text);border:1px solid var(--border);">
          🎲 随机推荐菜谱
        </button>
      </div>
      <div id="recommend-result" style="margin-top:16px;"></div>
    `;

    document.getElementById('recommend-btn').addEventListener('click', () => this.doRecommend());
    document.getElementById('ai-generate-btn').addEventListener('click', () => this.doGenerate());
    document.getElementById('craving-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.doGenerate();
    });
    document.getElementById('surprise-btn').addEventListener('click', () => this.doSurprise());
  },

  async doGenerate() {
    const resultEl = document.getElementById('recommend-result');
    const input = document.getElementById('craving-input').value.trim() || '随便推荐几道家常菜';
    resultEl.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>AI 思考中...</p></div>';

    let recipes = [];
    let streamingDiv = null;

    Api.streamGenerate(
      this.ingredients.map(i => i.name),
      input,
      // onContent — 显示原始文本流
      (text) => {
        if (!streamingDiv) {
          resultEl.innerHTML = '<div class="card" style="font-size:12px;line-height:1.5;max-height:400px;overflow-y:auto;white-space:pre-wrap;font-family:monospace;" id="stream-text"></div>';
          streamingDiv = document.getElementById('stream-text');
        }
        streamingDiv.textContent = text;
        streamingDiv.scrollTop = streamingDiv.scrollHeight;
      },
      // onDone — 渲染菜谱
      (parsedRecipes) => {
        recipes = parsedRecipes;
        if (recipes.length > 0) {
          resultEl.innerHTML = '';
          recipes.forEach((r, idx) => { resultEl.innerHTML += this.renderAiRecipeCard(r, idx); });
          if (recipes.length > 1) {
            resultEl.innerHTML += `<button class="btn btn-block" id="save-all-recipes" style="margin-top:8px;">💾 全部保存到菜谱</button>`;
          }
          this.wireSaveButtons(resultEl, recipes);
        } else if (streamingDiv) {
          streamingDiv.innerHTML = '<p style="color:var(--text-secondary);">未能解析到菜谱，请重试</p>';
        }
      },
      // onError
      async (errMsg) => {
        // 流式失败，回退到非流式
        console.warn('Stream failed, falling back:', errMsg);
        try {
          const data = await Api.generate(this.ingredients.map(i => i.name), input);
          resultEl.innerHTML = '';
          let fallbackRecipes = data.recipes || [];
          if (fallbackRecipes.length === 0 && data.raw) {
            try {
              const parsed = JSON.parse(data.raw.replace(/```json|```/g, '').trim());
              fallbackRecipes = Array.isArray(parsed) ? parsed : [parsed];
            } catch {}
          }
          if (fallbackRecipes.length > 0) {
            fallbackRecipes.forEach((r, idx) => { resultEl.innerHTML += this.renderAiRecipeCard(r, idx); });
            if (fallbackRecipes.length > 1) {
              resultEl.innerHTML += `<button class="btn btn-block" id="save-all-recipes" style="margin-top:8px;">💾 全部保存到菜谱</button>`;
            }
            this.wireSaveButtons(resultEl, fallbackRecipes);
          } else if (data.raw) {
            resultEl.innerHTML = `<div class="card" style="font-size:13px;line-height:1.6;white-space:pre-wrap;">${App.escapeHtml(data.raw)}</div>`;
          }
        } catch (e) {
          App.showError(resultEl, '生成失败: ' + e.message);
        }
      }
    );
  },

  async doSurprise() {
    const resultEl = document.getElementById('recommend-result');
    resultEl.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>AI 思考中...</p></div>';

    let streamingDiv = null;

    Api.streamGenerate(
      [],
      '随机推荐3道家常菜，什么类型都可以，不要重复',
      (text) => {
        if (!streamingDiv) {
          resultEl.innerHTML = '<div class="card" style="font-size:12px;line-height:1.5;max-height:400px;overflow-y:auto;white-space:pre-wrap;font-family:monospace;" id="stream-text-surprise"></div>';
          streamingDiv = document.getElementById('stream-text-surprise');
        }
        streamingDiv.textContent = text;
        streamingDiv.scrollTop = streamingDiv.scrollHeight;
      },
      (parsedRecipes) => {
        if (parsedRecipes.length > 0) {
          resultEl.innerHTML = '';
          parsedRecipes.forEach((r, idx) => { resultEl.innerHTML += this.renderAiRecipeCard(r, idx); });
          if (parsedRecipes.length > 1) {
            resultEl.innerHTML += `<button class="btn btn-block" id="save-all-recipes" style="margin-top:8px;">💾 全部保存到菜谱</button>`;
          }
          this.wireSaveButtons(resultEl, parsedRecipes);
        } else if (streamingDiv) {
          streamingDiv.innerHTML = '<p style="color:var(--text-secondary);">未能解析到菜谱，请重试</p>';
        }
      },
      async (errMsg) => {
        console.warn('Surprise stream failed, falling back:', errMsg);
        try {
          const data = await Api.generate([], '随机推荐3道家常菜，什么类型都可以，不要重复');
          resultEl.innerHTML = '';
          let recipes = data.recipes || [];
          if (recipes.length === 0 && data.raw) {
            try {
              const parsed = JSON.parse(data.raw.replace(/```json|```/g, '').trim());
              recipes = Array.isArray(parsed) ? parsed : [parsed];
            } catch {}
          }
          if (recipes.length > 0) {
            recipes.forEach((r, idx) => { resultEl.innerHTML += this.renderAiRecipeCard(r, idx); });
            if (recipes.length > 1) {
              resultEl.innerHTML += `<button class="btn btn-block" id="save-all-recipes" style="margin-top:8px;">💾 全部保存到菜谱</button>`;
            }
            this.wireSaveButtons(resultEl, recipes);
          } else if (data.raw) {
            resultEl.innerHTML = `<div class="card" style="font-size:13px;line-height:1.6;white-space:pre-wrap;">${App.escapeHtml(data.raw)}</div>`;
          }
        } catch (e) {
          App.showError(resultEl, '生成失败: ' + e.message);
        }
      }
    );
  },

  wireSaveButtons(container, recipes) {
    // 单个保存
    container.querySelectorAll('[data-save-ai]').forEach(btn => {
      const idx = parseInt(btn.dataset.saveAi);
      btn.addEventListener('click', async () => {
        try {
          console.log('saving recipe:', recipes[idx]?.name);
          await Api.addRecipe(recipes[idx]);
          btn.textContent = '✅ 已保存';
          btn.disabled = true;
        } catch (e) { alert('保存失败: ' + e.message + '\n\n' + JSON.stringify(recipes[idx], null, 2).slice(0, 500)); }
      });
    });
    // 全部保存
    const allBtn = document.getElementById('save-all-recipes');
    if (allBtn) {
      allBtn.addEventListener('click', async () => {
        for (const r of recipes) {
          try { await Api.addRecipe(r); } catch {}
        }
        App.showToast('已全部保存');
        allBtn.textContent = '✅ 已全部保存';
        allBtn.disabled = true;
      });
    }
  },

  renderAiRecipeCard(recipe, idx) {
    return `<div class="card">
      <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${App.escapeHtml(recipe.name)}</div>
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">
        ⏱ ${recipe.cook_time || '?'}min · ${recipe.difficulty || '简单'}
      </div>
      <div style="font-size:12px;margin-bottom:6px;">
        🛒 ${(recipe.ingredients || []).map(i =>
          `${App.escapeHtml(i.name)}${i.quantity ? ' ' + i.quantity + (i.unit || '') : ''}${i.optional ? '(可选)' : ''}`
        ).join('、')}
      </div>
      <div style="font-size:12px;border-top:1px solid var(--border);padding-top:6px;margin-top:6px;">
        ${(recipe.steps || []).map((s, i) => `<div style="margin-bottom:4px;">${i+1}. ${App.escapeHtml(s)}</div>`).join('')}
      </div>
      ${recipe.tips ? `<div style="font-size:11px;color:var(--warning);margin-top:4px;">💡 ${App.escapeHtml(recipe.tips)}</div>` : ''}
      <button class="btn-sm" data-save-ai="${idx}" style="margin-top:6px;">💾 保存到菜谱</button>
    </div>`;
  },

  async doRecommend() {
    const resultEl = document.getElementById('recommend-result');
    App.showLoading(resultEl);

    try {
      const data = await Api.recommend(this.ingredients.map(i => i.name));
      resultEl.innerHTML = '';

      // 已有菜谱匹配
      if (data.matched && data.matched.length > 0) {
        resultEl.innerHTML += `
          <h3 style="font-size:14px;margin-bottom:10px;">📋 库存能做的菜</h3>
          ${data.matched.map(r => `
            <div class="card" style="cursor:pointer;" data-recipe-id="${r.id}">
              <div style="font-weight:600;font-size:14px;">${App.escapeHtml(r.name)}</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">
                已做过 ${r.cook_count} 次
              </div>
            </div>
          `).join('')}
        `;
        resultEl.querySelectorAll('[data-recipe-id]').forEach(el => {
          el.addEventListener('click', () => {
            RecipesPage.showDetail(parseInt(el.dataset.recipeId));
          });
        });
      }

      // AI 推荐的新菜谱
      if (data.ai && data.ai.length > 0) {
        resultEl.innerHTML += `
          <h3 style="font-size:14px;margin:16px 0 10px;">🤖 AI 推荐的新菜谱</h3>
          ${data.ai.map((recipe, idx) => this.renderAiRecipeCard(recipe, idx)).join('')}`;
        resultEl.querySelectorAll('[data-save-ai]').forEach(btn => {
          const idx = parseInt(btn.dataset.saveAi);
          btn.addEventListener('click', async () => {
            try {
              await Api.addRecipe(data.ai[idx]);
              btn.textContent = '✅ 已保存';
              btn.disabled = true;
            } catch (e) {
              alert('保存失败: ' + e.message);
            }
          });
        });
      }

      if ((!data.matched || data.matched.length === 0) && (!data.ai || data.ai.length === 0)) {
        if (data.ai_raw) {
          resultEl.innerHTML += `
            <h3 style="font-size:14px;margin-bottom:8px;">🤖 AI 推荐</h3>
            <div class="card" style="font-size:13px;line-height:1.6;white-space:pre-wrap;">${App.escapeHtml(data.ai_raw)}</div>
          `;
        } else {
          resultEl.innerHTML = '<div class="empty-state"><p>暂时没有推荐结果</p></div>';
        }
      }

      if ((!data.matched || data.matched.length === 0) && (!data.ai || data.ai.length === 0)) {
        if (data.ai_raw) {
          resultEl.innerHTML += `
            <h3 style="font-size:14px;margin-bottom:8px;">🤖 AI 推荐</h3>
            <div class="card" style="font-size:13px;line-height:1.6;white-space:pre-wrap;">${App.escapeHtml(data.ai_raw)}</div>
          `;
        } else {
          resultEl.innerHTML = '<div class="empty-state"><p>暂时没有推荐结果</p></div>';
        }
      }
    } catch (e) {
      App.showError(resultEl, '推荐失败: ' + e.message);
    }
  }
};
