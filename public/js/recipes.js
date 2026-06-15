// public/js/recipes.js
const RecipesPage = {
  recipes: [],
  detail: null,
  allTags: [],
  currentTag: '',

  async render(container) {
    container.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input class="input" id="recipe-search" placeholder="搜索菜谱...">
        <button class="btn" id="search-btn">搜索</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;" id="tag-filters">
        <button class="btn-sm" data-tag="" style="border-color:var(--primary);color:var(--primary);">全部</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <button class="btn btn-sm" id="add-recipe-btn" style="flex:1;background:var(--card-bg);color:var(--text);border:1px solid var(--border);">+ 手动添加</button>
        <button class="btn btn-sm" id="web-search-btn" style="flex:1;background:var(--card-bg);color:var(--text);border:1px solid var(--border);">🌐 网上搜菜谱</button>
      </div>
      <div id="recipe-list"></div>
    `;

    document.getElementById('search-btn').addEventListener('click', () => this.search());
    document.getElementById('recipe-search').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.search();
    });
    document.getElementById('add-recipe-btn').addEventListener('click', () => this.showForm());
    document.getElementById('web-search-btn').addEventListener('click', () => this.showWebSearch());
    // 标签过滤
    document.getElementById('tag-filters').addEventListener('click', e => {
      const btn = e.target.closest('[data-tag]');
      if (btn) {
        document.querySelectorAll('#tag-filters [data-tag]').forEach(b => b.style.borderColor = 'var(--border)');
        btn.style.borderColor = 'var(--primary)';
        btn.style.color = 'var(--primary)';
        this.currentTag = btn.dataset.tag;
        this.search();
      }
    });
    await this.search();
  },

  async search() {
    const q = document.getElementById('recipe-search')?.value.trim() || '';
    const listEl = document.getElementById('recipe-list');
    App.showLoading(listEl, true);
    try {
      this.recipes = (await Api.getRecipes(q, this.currentTag)) || [];
      this.renderList(listEl);
      // 从搜索结果提取所有标签
      const tags = new Set();
      this.recipes.forEach(r => {
        if (r.tags) r.tags.split(',').filter(Boolean).forEach(t => tags.add(t.trim()));
      });
      this.allTags = [...tags].sort();
      this.renderTagFilters();
    } catch (e) {
      App.showError(listEl, '加载失败: ' + e.message);
    }
  },

  renderList(container) {
    if (!this.recipes.length) {
      container.innerHTML = '<div class="empty-state"><p>还没有菜谱，点击上方添加</p></div>';
      return;
    }
    container.innerHTML = this.recipes.map(r => `
      <div class="card recipe-card" data-id="${r.id}">
        <div class="recipe-img">
          ${r.image ? `<img src="${r.image}" alt="${App.escapeHtml(r.name)}">` : ''}
        </div>
        <div class="recipe-info">
          <div class="recipe-name">${App.escapeHtml(r.name)}</div>
          ${r.tags ? `<div style="display:flex;gap:3px;flex-wrap:wrap;margin:4px 0;">${r.tags.split(',').filter(Boolean).map(t => `<span class="tag tag-green">${App.escapeHtml(t.trim())}</span>`).join('')}</div>` : ''}
          <div class="recipe-meta">
            <span>⏱ ${r.cook_time}min</span>
            <span>${r.difficulty}</span>
            <span>${r.source === 'ai' ? '🤖 AI 生成' : '📝 手动'}</span>
            <span>做过 ${r.cook_count} 次</span>
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.recipe-card').forEach(card => {
      card.addEventListener('click', () => this.showDetail(parseInt(card.dataset.id)));
    });
  },

  renderTagFilters() {
    const el = document.getElementById('tag-filters');
    if (!el) return;
    const tagsHtml = ['<button class="btn-sm" data-tag="" style="border-color:var(--primary);color:var(--primary);">全部</button>',
      ...this.allTags.map(t =>
        `<button class="btn-sm" data-tag="${App.escapeHtml(t)}"${this.currentTag === t ? ' style="border-color:var(--primary);color:var(--primary);"' : ''}>${App.escapeHtml(t)}</button>`
      )
    ].join('');
    el.innerHTML = tagsHtml;
  },

  async showDetail(id) {
    try {
      const recipe = await Api.getRecipe(id);
      RecipesPage.detail = recipe;
      window.location.hash = 'recipe-detail';
    } catch (e) {
      alert('加载失败: ' + e.message);
    }
  },

  async renderDetail(container) {
    const r = this.detail;
    if (!r) { window.location.hash = 'recipes'; return; }

    container.innerHTML = `
      <button class="btn-sm" id="back-btn" style="margin-bottom:12px;">← 返回</button>
      <div class="card">
        <h2 style="font-size:16px;margin-bottom:8px;">${App.escapeHtml(r.name)}</h2>
        ${r.tags ? `<div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:8px;">${r.tags.split(',').filter(Boolean).map(t => `<span class="tag tag-green">${App.escapeHtml(t.trim())}</span>`).join('')}</div>` : ''}
        <div style="font-size:12px;color:var(--text-secondary);display:flex;gap:12px;margin-bottom:12px;">
          <span>⏱ ${r.cook_time} 分钟</span>
          <span>${r.difficulty}</span>
          <span>做过 ${r.cook_count} 次</span>
        </div>

        <h3 style="font-size:13px;margin-bottom:6px;">🛒 食材</h3>
        <div class="recipe-detail-ingredients">
          ${(r.ingredients || []).map(i =>
            `<div class="recipe-detail-ingredient">
              <span>${App.escapeHtml(i.ingredient_name)} ${i.optional ? '(可选)' : ''}</span>
              <span>${i.quantity} ${i.unit}</span>
            </div>`
          ).join('')}
        </div>

        <h3 style="font-size:13px;margin:12px 0 6px;">👨‍🍳 做法</h3>
        ${(r.steps || []).map((step, i) =>
          `<div class="recipe-detail-step">
            <span class="recipe-detail-step-num">${i + 1}</span>
            ${App.escapeHtml(step)}
          </div>`
        ).join('')}

        ${r.tips ? `<div style="margin-top:12px;padding:8px;background:#fff7ed;border-radius:6px;font-size:12px;color:var(--warning);">💡 ${App.escapeHtml(r.tips)}</div>` : ''}

        <button class="btn btn-block" id="cook-btn" style="margin-top:12px;">✅ 我做过了</button>
        <button class="btn btn-block" id="shopping-list-btn" style="margin-top:8px;background:var(--card-bg);color:var(--text);border:1px solid var(--border);">🛒 购物清单</button>
        <button class="btn btn-block" id="delete-recipe-btn" style="margin-top:8px;background:var(--danger);">删除菜谱</button>
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', () => { window.location.hash = 'recipes'; });
    document.getElementById('shopping-list-btn').addEventListener('click', () => this.showShoppingList(r.ingredients || []));
    document.getElementById('cook-btn').addEventListener('click', async () => {
      try {
        await Api.addCookLog({ recipe_id: r.id });
        App.showToast('记录成功！');
        window.location.hash = 'recipes';
      } catch (e) {
        alert('记录失败: ' + e.message);
      }
    });
    document.getElementById('delete-recipe-btn').addEventListener('click', async () => {
      if (!confirm('确定删除「' + r.name + '」？')) return;
      try {
        await Api.deleteRecipe(r.id);
        App.showToast('已删除');
        window.location.hash = 'recipes';
      } catch (e) {
        alert('删除失败: ' + e.message);
      }
    });
  },

  async showWebSearch() {
    let wsRecipes = [];

    const overlay = App.showModal(`
      <div class="modal-title">🌐 网上搜菜谱</div>
      <div class="form-group">
        <label class="form-label">想搜什么菜？</label>
        <input class="input" id="ws-query" placeholder="例如：川菜、糖醋、一周午餐、减脂餐...">
      </div>
      <button class="btn btn-block" id="ws-search-btn">搜索</button>
      <div id="ws-results" style="margin-top:12px;"></div>
    `);

    const renderList = () => {
      const el = document.getElementById('ws-results');
      el.innerHTML = wsRecipes.map((recipe, idx) => `
        <div class="card recipe-card" data-idx="${idx}" style="margin-bottom:8px;">
          <div class="recipe-info">
            <div class="recipe-name">${App.escapeHtml(recipe.name)}</div>
            <div class="recipe-meta">
              <span>⏱ ${recipe.cook_time || '?'}min</span>
              <span>${recipe.difficulty || '简单'}</span>
              <span>🛒 ${(recipe.ingredients || []).length}种食材</span>
            </div>
          </div>
        </div>
      `).join('');
      el.querySelectorAll('[data-idx]').forEach(card => {
        card.addEventListener('click', () => showDetail(parseInt(card.dataset.idx)));
      });
    };

    const showDetail = (idx) => {
      const recipe = wsRecipes[idx];
      if (!recipe) return;
      const el = document.getElementById('ws-results');
      el.innerHTML = `
        <button class="btn-sm" id="ws-back" style="margin-bottom:12px;">← 返回搜索结果</button>
        <div class="card">
          <h2 style="font-size:16px;margin-bottom:8px;">${App.escapeHtml(recipe.name)}</h2>
          <div style="font-size:12px;color:var(--text-secondary);display:flex;gap:12px;margin-bottom:12px;">
            <span>⏱ ${recipe.cook_time || '?'} 分钟</span>
            <span>${recipe.difficulty || '简单'}</span>
          </div>
          <h3 style="font-size:13px;margin-bottom:6px;">🛒 食材</h3>
          <div class="recipe-detail-ingredients">
            ${(recipe.ingredients || []).map(i =>
              `<div class="recipe-detail-ingredient">
                <span>${App.escapeHtml(i.name)} ${i.optional ? '(可选)' : ''}</span>
                <span>${i.quantity || ''} ${i.unit || ''}</span>
              </div>`
            ).join('')}
          </div>
          <h3 style="font-size:13px;margin:12px 0 6px;">👨‍🍳 做法</h3>
          ${(recipe.steps || []).map((step, i) =>
            `<div class="recipe-detail-step">
              <span class="recipe-detail-step-num">${i + 1}</span>
              ${App.escapeHtml(step)}
            </div>`
          ).join('')}
          ${recipe.tips ? `<div style="margin-top:12px;padding:8px;background:#fff7ed;border-radius:6px;font-size:12px;color:var(--warning);">💡 ${App.escapeHtml(recipe.tips)}</div>` : ''}
          <button class="btn btn-block" id="ws-save" style="margin-top:12px;">💾 保存到菜谱</button>
        </div>
      `;
      document.getElementById('ws-back').addEventListener('click', renderList);
      document.getElementById('ws-save').addEventListener('click', async () => {
        try {
          await Api.addRecipe(recipe);
          const btn = document.getElementById('ws-save');
          btn.textContent = '✅ 已保存';
          btn.disabled = true;
        } catch (e) { alert('保存失败: ' + e.message); }
      });
    };

    document.getElementById('ws-search-btn').addEventListener('click', async () => {
      const q = document.getElementById('ws-query').value.trim();
      if (!q) { alert('请输入搜索内容'); return; }
      const resultsEl = document.getElementById('ws-results');
      resultsEl.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>搜索中...</p></div>';
      try {
        const data = await Api.searchWebRecipes(q);
        wsRecipes = data.recipes || [];
        // 如果后端没解析成功但返回了raw，前端再试试
        if (wsRecipes.length === 0 && data.raw) {
          try {
            const parsed = JSON.parse(data.raw.replace(/```json|```/g, '').trim());
            wsRecipes = Array.isArray(parsed) ? parsed : [parsed];
          } catch {}
        }
        if (wsRecipes.length > 0) {
          renderList();
        } else if (data.raw) {
          resultsEl.innerHTML = `<div class="card" style="font-size:13px;white-space:pre-wrap;">${App.escapeHtml(data.raw)}</div>`;
        } else {
          resultsEl.innerHTML = '<p style="color:var(--text-secondary);">没有找到结果</p>';
        }
      } catch (e) {
        resultsEl.innerHTML = `<p style="color:var(--danger);">搜索失败: ${e.message}</p>`;
      }
    });

    document.getElementById('ws-query').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('ws-search-btn').click();
    });
  },

  async showShoppingList(recipeIngredients) {
    // 获取冰箱库存
    let fridge = [];
    try {
      fridge = await Api.getIngredients();
    } catch {}

    // 对比生成购物清单
    const items = recipeIngredients.map(ri => {
      const match = fridge.find(f => f.name.toLowerCase() === ri.ingredient_name.toLowerCase());
      const have = match ? match.quantity : 0;
      const need = ri.quantity || 0;
      const missing = Math.max(0, need - have);
      return {
        name: ri.ingredient_name,
        have,
        need,
        missing,
        unit: ri.unit,
        enough: missing === 0
      };
    });

    const overlay = App.showModal(`
      <div class="modal-title">🛒 购物清单</div>
      ${items.map(item => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
          <span>${App.escapeHtml(item.name)}</span>
          <span style="color:${item.enough ? 'var(--primary)' : 'var(--danger)'};">
            ${item.enough
              ? `✅ 已有 ${item.have}${item.unit}`
              : item.have > 0
                ? `还需 ${item.missing}${item.unit}（已有 ${item.have}${item.unit}）`
                : `需购买 ${item.need}${item.unit}`}
          </span>
        </div>
      `).join('')}
      ${items.some(i => !i.enough)
        ? `<button class="btn btn-block" id="copy-list-btn" style="margin-top:12px;">📋 复制清单</button>`
        : '<p style="text-align:center;color:var(--primary);margin-top:12px;font-size:13px;">✅ 食材齐全，可以开工！</p>'}
    `);

    document.getElementById('copy-list-btn')?.addEventListener('click', () => {
      const text = items.filter(i => !i.enough).map(i =>
        `${i.name}${i.missing > 0 ? ` x${i.missing}${i.unit}` : ''}`
      ).join('\n');
      navigator.clipboard.writeText(text).then(() => {
        App.showToast('已复制到剪贴板');
      }).catch(() => {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        App.showToast('已复制到剪贴板');
      });
    });
  },

  showForm() {
    const overlay = App.showModal(`
      <div class="modal-title">添加菜谱</div>
      <div class="form-group">
        <label class="form-label">菜名</label>
        <input class="input" id="r-name" placeholder="菜名">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">烹饪时间(分钟)</label>
          <input class="input" id="r-time" type="number" value="15" min="1">
        </div>
        <div class="form-group">
          <label class="form-label">难度</label>
          <select class="input" id="r-difficulty">
            <option>简单</option>
            <option>中等</option>
            <option>困难</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">食材（每行一个，格式: 名称,数量,单位,是否可选(可省略)）</label>
        <textarea class="input" id="r-ingredients" rows="4" placeholder="番茄,2,个&#10;鸡蛋,3,个"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">做法步骤（每行一步）</label>
        <textarea class="input" id="r-steps" rows="5" placeholder="番茄切块&#10;鸡蛋打散&#10;炒锅加油..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">小贴士（可选）</label>
        <input class="input" id="r-tips" placeholder="小贴士">
      </div>
      <div class="form-group">
        <label class="form-label">标签（英文逗号分隔，可选）</label>
        <input class="input" id="r-tags" placeholder="例如：川菜,快手菜,早餐">
      </div>
      <button class="btn btn-block" id="r-save">保存菜谱</button>
    `);

    document.getElementById('r-save').addEventListener('click', async () => {
      const name = document.getElementById('r-name').value.trim();
      if (!name) { alert('请输入菜名'); return; }

      const steps = document.getElementById('r-steps').value.split('\n').filter(s => s.trim());
      const ingredients = document.getElementById('r-ingredients').value.split('\n').filter(s => s.trim()).map(line => {
        const parts = line.split(',').map(s => s.trim());
        return {
          name: parts[0],
          quantity: parseFloat(parts[1]) || 1,
          unit: parts[2] || '',
          optional: parts[3] === '是' || parts[3] === 'true'
        };
      });
      const tags = document.getElementById('r-tags').value.split(/[,，]/).map(s => s.trim()).filter(Boolean);

      try {
        await Api.addRecipe({
          name,
          steps,
          ingredients,
          tags,
          cook_time: parseInt(document.getElementById('r-time').value) || 15,
          difficulty: document.getElementById('r-difficulty').value,
          tips: document.getElementById('r-tips').value.trim() || null
        });
        App.closeModal();
        App.showToast('菜谱已添加');
        await this.search();
      } catch (e) {
        alert('保存失败: ' + e.message);
      }
    });
  }
};
