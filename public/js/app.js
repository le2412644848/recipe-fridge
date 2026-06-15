// public/js/app.js
const App = {
  currentPage: 'fridge',

  init() {
    window.addEventListener('hashchange', () => this.route());
    this.route();
  },

  route() {
    const hash = location.hash.slice(1) || 'fridge';
    this.currentPage = hash;
    const container = document.getElementById('main-content');
    const titleEl = document.getElementById('page-title');

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === hash);
    });

    switch (hash) {
      case 'fridge':
        titleEl.textContent = '🧊 我的冰箱';
        FridgePage.render(container);
        break;
      case 'recipes':
        titleEl.textContent = '📖 我的菜谱';
        RecipesPage.render(container);
        break;
      case 'recommend':
        titleEl.textContent = '🤖 AI 推荐';
        RecommendPage.render(container);
        break;
      case 'logs':
        titleEl.textContent = '📝 做菜记录';
        CookLogsPage.render(container);
        break;
      case 'recipe-detail':
        titleEl.textContent = '📖 菜谱详情';
        RecipesPage.renderDetail(container);
        break;
    }
  },

  showLoading(container) {
    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>加载中...</p></div>';
  },

  showError(container, msg) {
    container.innerHTML = `<div class="error-state"><p>${this.escapeHtml(msg)}</p></div>`;
  },

  escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },

  showModal(html) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal">${html}</div>`;
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
    return overlay;
  },

  closeModal() {
    document.querySelector('.modal-overlay')?.remove();
  },

  showToast(msg) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;z-index:300;max-width:80%;text-align:center;';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
