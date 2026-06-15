// public/js/recipes.js
const RecipesPage = {
  recipes: [],
  detail: null,

  async render(container) {
    container.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input class="input" id="recipe-search" placeholder="搜索菜谱...">
        <button class="btn" id="search-btn">搜索</button>
      </div>
      <button class="btn btn-block" id="add-recipe-btn" style="margin-bottom:12px;">+ 添加菜谱</button>
      <div id="recipe-list"></div>
    `;

    document.getElementById('search-btn').addEventListener('click', () => this.search());
    document.getElementById('recipe-search').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.search();
    });
    document.getElementById('add-recipe-btn').addEventListener('click', () => this.showForm());
    await this.search();
  },

  async search() {
    const q = document.getElementById('recipe-search')?.value.trim() || '';
    const listEl = document.getElementById('recipe-list');
    App.showLoading(listEl);
    try {
      this.recipes = (await Api.getRecipes(q)) || [];
      this.renderList(listEl);
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
        <button class="btn btn-block" id="delete-recipe-btn" style="margin-top:8px;background:var(--danger);">删除菜谱</button>
      </div>
    `;

    document.getElementById('back-btn').addEventListener('click', () => { window.location.hash = 'recipes'; });
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

      try {
        await Api.addRecipe({
          name,
          steps,
          ingredients,
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
