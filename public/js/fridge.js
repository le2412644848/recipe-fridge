// public/js/fridge.js
const FridgePage = {
  ingredients: [],

  async render(container) {
    container.innerHTML = `
      <div style="margin-bottom:12px;">
        <button class="btn btn-block" id="add-ingredient-btn">+ 添加食材</button>
      </div>
      <div id="fridge-list"></div>
    `;

    document.getElementById('add-ingredient-btn').addEventListener('click', () => this.showForm());
    await this.loadList();
  },

  async loadList() {
    const listEl = document.getElementById('fridge-list');
    App.showLoading(listEl);
    try {
      this.ingredients = await Api.getIngredients();
      this.renderList(listEl);
    } catch (e) {
      App.showError(listEl, '加载失败: ' + e.message);
    }
  },

  renderList(container) {
    if (!this.ingredients.length) {
      container.innerHTML = '<div class="empty-state"><p>冰箱里还没有食材，去添加一些吧</p></div>';
      return;
    }

    const groups = {};
    const now = new Date();
    for (const ing of this.ingredients) {
      if (!groups[ing.category]) groups[ing.category] = [];
      let expiring = false;
      if (ing.expiry_date) {
        const expiry = new Date(ing.expiry_date + 'T23:59:59');
        const diff = (expiry - now) / (1000 * 60 * 60 * 24);
        expiring = diff >= 0 && diff <= 3;
      }
      groups[ing.category].push({ ...ing, expiring });
    }

    container.innerHTML = Object.entries(groups).map(([category, items]) => `
      <div class="ingredient-group">
        <div class="ingredient-group-title">${category}</div>
        ${items.map(item => `
          <div class="ingredient-item ${item.expiring ? 'expiring' : ''}">
            <div>
              <div class="ingredient-name">${App.escapeHtml(item.name)}</div>
              <div class="ingredient-qty">${item.quantity} ${item.unit}${item.expiring ? ' ⚠️ 即将过期' : ''}${item.expiry_date ? ' (' + item.expiry_date + ')' : ''}</div>
            </div>
            <div class="ingredient-actions">
              <button class="btn-sm" data-edit="${item.id}">编辑</button>
              <button class="btn-sm danger" data-del="${item.id}">删除</button>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');

    container.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => this.deleteItem(parseInt(btn.dataset.del)));
    });
    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => this.showForm(parseInt(btn.dataset.edit)));
    });
  },

  async deleteItem(id) {
    if (!confirm('确定删除这个食材？')) return;
    try {
      await Api.deleteIngredient(id);
      await this.loadList();
    } catch (e) {
      alert('删除失败: ' + e.message);
    }
  },

  showForm(id) {
    const item = id ? this.ingredients.find(i => i.id === id) : null;
    const overlay = App.showModal(`
      <div class="modal-title">${item ? '编辑食材' : '添加食材'}</div>
      <div class="form-group">
        <label class="form-label">名称</label>
        <input class="input" id="f-name" value="${item ? App.escapeHtml(item.name) : ''}" placeholder="食材名称">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">分类</label>
          <select class="input" id="f-category">
            ${['蔬菜', '肉类', '调料', '主食', '水果', '奶制品', '其他'].map(c =>
              `<option value="${c}" ${item && item.category === c ? 'selected' : ''}>${c}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">数量</label>
          <input class="input" id="f-qty" type="number" value="${item ? item.quantity : ''}" step="0.1" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">单位</label>
          <input class="input" id="f-unit" value="${item ? App.escapeHtml(item.unit) : '个'}" placeholder="个/克/根">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">过期日期（可选）</label>
        <input class="input" id="f-expiry" type="date" value="${item && item.expiry_date ? item.expiry_date : ''}">
      </div>
      <button class="btn btn-block" id="f-save">保存</button>
    `);

    document.getElementById('f-save').addEventListener('click', async () => {
      const data = {
        name: document.getElementById('f-name').value.trim(),
        category: document.getElementById('f-category').value,
        quantity: parseFloat(document.getElementById('f-qty').value) || 0,
        unit: document.getElementById('f-unit').value.trim() || '个',
        expiry_date: document.getElementById('f-expiry').value || null
      };
      if (!data.name) { alert('请输入食材名称'); return; }
      try {
        if (item) {
          await Api.updateIngredient(item.id, data);
        } else {
          await Api.addIngredient(data);
        }
        App.closeModal();
        App.showToast(item ? '食材已更新' : '食材已添加');
        await this.loadList();
      } catch (e) {
        alert('保存失败: ' + e.message);
      }
    });
  }
};
