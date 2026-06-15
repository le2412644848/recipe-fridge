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
            : '<span style="color:var(--text-secondary);font-size:13px;">冰箱是空的，先去添加食材吧</span>'}
        </div>
      </div>
      <button class="btn btn-block" id="recommend-btn" ${this.ingredients.length === 0 ? 'disabled' : ''}>
        🔀 看看能做什么
      </button>
      <div id="recommend-result" style="margin-top:16px;"></div>
    `;

    document.getElementById('recommend-btn').addEventListener('click', () => this.doRecommend());
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
          ${data.ai.map((recipe, idx) => `
            <div class="card">
              <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${App.escapeHtml(recipe.name)}</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">
                ⏱ ${recipe.cook_time}min · ${recipe.difficulty}
              </div>
              <div style="font-size:12px;margin-bottom:6px;">
                🛒 ${(recipe.ingredients || []).map(i =>
                  `${App.escapeHtml(i.name)}${i.optional ? '(可选)' : ''}`
                ).join('、')}
              </div>
              <button class="btn-sm" data-save-ai="${idx}">💾 保存到菜谱</button>
            </div>
          `).join('')}
        `;
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
    } catch (e) {
      App.showError(resultEl, '推荐失败: ' + e.message);
    }
  }
};
