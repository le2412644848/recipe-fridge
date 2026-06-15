// public/js/cook-logs.js
const CookLogsPage = {
  async render(container) {
    container.innerHTML = '<div id="logs-list"></div>';
    await this.loadLogs();
  },

  async loadLogs() {
    const listEl = document.getElementById('logs-list');
    App.showLoading(listEl);
    try {
      const logs = (await Api.getCookLogs()) || [];
      if (!logs.length) {
        listEl.innerHTML = '<div class="empty-state"><p>还没有做菜记录</p><p style="font-size:12px;margin-top:4px;">在菜谱详情中点击"我做过了"来记录</p></div>';
        return;
      }
      const groups = {};
      for (const log of logs) {
        const date = log.cooked_at.split(' ')[0];
        if (!groups[date]) groups[date] = [];
        groups[date].push(log);
      }
      listEl.innerHTML = Object.entries(groups).map(([date, items]) => `
        <div style="margin-bottom:12px;">
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;font-weight:500;">${date}</div>
          ${items.map(log => `
            <div class="card">
              <div style="display:flex;align-items:center;gap:12px;">
                <div>
                  <div class="log-recipe-name">${App.escapeHtml(log.recipe_name)}</div>
                  <div class="log-date">${log.cooked_at}</div>
                </div>
                <div style="margin-left:auto;text-align:right;">
                  ${log.rating ? `<div class="log-rating">${'★'.repeat(log.rating)}${'☆'.repeat(5 - log.rating)}</div>` : ''}
                  ${log.note ? `<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${App.escapeHtml(log.note)}</div>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('');
    } catch (e) {
      App.showError(listEl, '加载失败: ' + e.message);
    }
  }
};
