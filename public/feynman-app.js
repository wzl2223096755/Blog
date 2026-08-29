
(function() {
  if (!window.storage) {
    const ls = window.localStorage;
    window.storage = {
      async get(key) { try { return { value: ls.getItem(key) }; } catch (e) { return null; } },
      async set(key, value) { try { ls.setItem(key, value); } catch (e) { console.error('save failed', e); } }
    };
  }

  // ========== 云端同步功能 ==========
  const PASSKEY_STORAGE_KEY = 'feynman-cloud-passkey';
  const LAST_SYNC_KEY = 'feynman-last-sync-time';
  let cloudPasskey = null;
  let isSyncing = false;
  let lastSyncTime = null;
  let autoSyncEnabled = false;

  // 从 localStorage 加载 passkey
  function loadPasskey() {
    try {
      const stored = localStorage.getItem(PASSKEY_STORAGE_KEY);
      if (stored) {
        cloudPasskey = stored;
        const lastSync = localStorage.getItem(LAST_SYNC_KEY);
        if (lastSync) {
          lastSyncTime = new Date(lastSync);
        }
        autoSyncEnabled = true;
      }
    } catch(e) {
      console.error('Failed to load passkey', e);
    }
  }

  // 保存 passkey 到 localStorage
  function savePasskey(key) {
    try {
      localStorage.setItem(PASSKEY_STORAGE_KEY, key);
      cloudPasskey = key;
      autoSyncEnabled = true;
    } catch(e) {
      console.error('Failed to save passkey', e);
    }
  }

  // 清除 passkey
  function clearPasskey() {
    try {
      localStorage.removeItem(PASSKEY_STORAGE_KEY);
      localStorage.removeItem(LAST_SYNC_KEY);
      cloudPasskey = null;
      lastSyncTime = null;
      autoSyncEnabled = false;
    } catch(e) {
      console.error('Failed to clear passkey', e);
    }
  }

  // 保存数据到云端
  async function saveToCloud(data) {
    if (!cloudPasskey) {
      throw new Error('未设置云端密钥');
    }

    isSyncing = true;
    updateSyncStatus('同步中...', 'syncing');

    try {
      const response = await fetch('/api/feynman/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passkey: cloudPasskey,
          data: data
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '保存失败');
      }

      const result = await response.json();
      lastSyncTime = new Date(result.lastSyncAt);
      localStorage.setItem(LAST_SYNC_KEY, result.lastSyncAt);
      
      updateSyncStatus('已同步', 'success');
      setTimeout(() => updateSyncStatus('', ''), 3000);
      
      return result;
    } catch(e) {
      console.error('Cloud save failed:', e);
      updateSyncStatus('同步失败', 'error');
      setTimeout(() => updateSyncStatus('', ''), 5000);
      throw e;
    } finally {
      isSyncing = false;
    }
  }

  // 从云端加载数据
  async function loadFromCloud() {
    if (!cloudPasskey) {
      throw new Error('未设置云端密钥');
    }

    isSyncing = true;
    updateSyncStatus('加载中...', 'syncing');

    try {
      const response = await fetch('/api/feynman/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey: cloudPasskey })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '加载失败');
      }

      const result = await response.json();
      
      if (result.data) {
        lastSyncTime = new Date(result.data.lastSyncAt);
        localStorage.setItem(LAST_SYNC_KEY, result.data.lastSyncAt);
        updateSyncStatus('加载成功', 'success');
        setTimeout(() => updateSyncStatus('', ''), 3000);
        return result.data;
      } else {
        updateSyncStatus('云端无数据', 'info');
        setTimeout(() => updateSyncStatus('', ''), 3000);
        return null;
      }
    } catch(e) {
      console.error('Cloud load failed:', e);
      updateSyncStatus('加载失败', 'error');
      setTimeout(() => updateSyncStatus('', ''), 5000);
      throw e;
    } finally {
      isSyncing = false;
    }
  }

  // 更新同步状态显示
  function updateSyncStatus(message, status) {
    const statusEl = document.getElementById('sync-status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = 'sync-status ' + status;
    }
  }

  // 初始化时加载 passkey
  loadPasskey();
  // ========== 云端同步功能结束 ==========

  const DAY_MS = 86400000;
  const WEEKDAYS = ['一','二','三','四','五','六','日'];

  let feynmanEntries = [];
  let habits = [];
  let checks = {};
  let scheduleRows = [];
  let scheduleCells = {};
  let weekOffset = 0;
  let openCardId = null;
  let editingId = null;
  let subjectFilter = '全部';
  let searchQuery = '';
  let showWelcome = false;
  const SUBJECTS = ['数据结构', '计算机组成原理', '操作系统', '计算机网络', '数学一', '英语一', '政治', '其他'];
  const WEEKDAY_FULL = ['周一','周二','周三','周四','周五','周六','周日'];
  
  // 自动备份配置
  const AUTO_BACKUP_KEY = 'feynman-auto-backup-history';
  const MAX_AUTO_BACKUPS = 5;
  const AUTO_BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24小时
  const WELCOME_SHOWN_KEY = 'feynman-welcome-shown';

  function fmtDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function getMonday(offset) {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const monday = new Date(now.getTime() - dow * DAY_MS + offset * 7 * DAY_MS);
    monday.setHours(0,0,0,0);
    return monday;
  }

  function weekDates(offset) {
    const monday = getMonday(offset);
    return Array.from({length:7}, (_,i) => new Date(monday.getTime() + i*DAY_MS));
  }

  async function loadData() {
    // 如果有云端密钥，尝试从云端加载
    if (cloudPasskey) {
      try {
        const cloudData = await loadFromCloud();
        if (cloudData && cloudData.cards) {
          // 云端有数据，使用云端数据
          feynmanEntries = cloudData.cards || [];
          habits = cloudData.habits || [];
          checks = cloudData.checks || {};
          scheduleRows = cloudData.scheduleRows || [];
          scheduleCells = cloudData.scheduleCells || {};
          
          // 同步到本地存储
          await window.storage.set('feynman-data', JSON.stringify({entries: feynmanEntries}));
          await window.storage.set('habit-data', JSON.stringify({habits, checks}));
          await window.storage.set('schedule-data', JSON.stringify({rows: scheduleRows, cells: scheduleCells}));
          
          render();
          return;
        }
      } catch(e) {
        console.error('Failed to load from cloud, falling back to local:', e);
        // 继续从本地加载
      }
    }
    
    // 从本地加载
    try {
      const f = await window.storage.get('feynman-data');
      feynmanEntries = f && f.value ? (JSON.parse(f.value).entries || []) : [];
    } catch(e) { feynmanEntries = []; }
    try {
      const h = await window.storage.get('habit-data');
      const parsed = h && h.value ? JSON.parse(h.value) : {};
      habits = parsed.habits || [];
      checks = parsed.checks || {};
    } catch(e) { habits = []; checks = {}; }
    try {
      const s = await window.storage.get('schedule-data');
      const parsedS = s && s.value ? JSON.parse(s.value) : {};
      scheduleRows = parsedS.rows || [];
      scheduleCells = parsedS.cells || {};
    } catch(e) { scheduleRows = []; scheduleCells = {}; }
    
    // 检查是否首次使用
    try {
      const welcomeShown = await window.storage.get(WELCOME_SHOWN_KEY);
      if (!welcomeShown || !welcomeShown.value) {
        showWelcome = true;
      }
    } catch(e) {}
    
    // 检查并执行自动备份
    await checkAutoBackup();
    
    render();
  }
  
  // 自动备份系统
  async function checkAutoBackup() {
    try {
      const lastBackupData = await window.storage.get('feynman-last-backup-time');
      const lastBackup = lastBackupData && lastBackupData.value ? parseInt(lastBackupData.value) : 0;
      const now = Date.now();
      
      if (now - lastBackup > AUTO_BACKUP_INTERVAL) {
        await createAutoBackup();
        await window.storage.set('feynman-last-backup-time', now.toString());
      }
    } catch(e) {
      console.error('自动备份检查失败', e);
    }
  }
  
  async function createAutoBackup() {
    try {
      const backup = {
        timestamp: Date.now(),
        date: new Date().toLocaleString('zh-CN'),
        feynmanEntries,
        habits,
        checks,
        scheduleRows,
        scheduleCells
      };
      
      // 获取现有备份历史
      const historyData = await window.storage.get(AUTO_BACKUP_KEY);
      let history = historyData && historyData.value ? JSON.parse(historyData.value) : [];
      
      // 添加新备份
      history.unshift(backup);
      
      // 只保留最近的几个备份
      if (history.length > MAX_AUTO_BACKUPS) {
        history = history.slice(0, MAX_AUTO_BACKUPS);
      }
      
      await window.storage.set(AUTO_BACKUP_KEY, JSON.stringify(history));
      console.log('自动备份完成:', backup.date);
    } catch(e) {
      console.error('创建自动备份失败', e);
    }
  }
  
  async function getAutoBackupHistory() {
    try {
      const historyData = await window.storage.get(AUTO_BACKUP_KEY);
      return historyData && historyData.value ? JSON.parse(historyData.value) : [];
    } catch(e) {
      return [];
    }
  }
  
  async function restoreFromBackup(backup) {
    if (!confirm(`确定要恢复到 ${backup.date} 的备份吗？当前数据将被覆盖。`)) return;
    
    feynmanEntries = backup.feynmanEntries || [];
    habits = backup.habits || [];
    checks = backup.checks || {};
    scheduleRows = backup.scheduleRows || [];
    scheduleCells = backup.scheduleCells || {};
    
    editingId = null;
    openCardId = null;
    subjectFilter = '全部';
    weekOffset = 0;
    searchQuery = '';
    
    await saveFeynman();
    await saveHabits();
    await saveSchedule();
    render();
    alert('数据已恢复！');
  }
  
  async function showBackupManager() {
    const history = await getAutoBackupHistory();
    
    if (history.length === 0) {
      alert('暂无自动备份记录。系统会每24小时自动创建一个备份。');
      return;
    }
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:var(--card);border-radius:8px;padding:24px;max-width:600px;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
        <h3 style="margin:0 0 16px;font-family:'Newsreader',serif;font-size:20px;">自动备份历史</h3>
        <p style="font-size:13px;color:var(--ink-soft);margin-bottom:20px;">系统每24小时自动备份一次，最多保留最近${MAX_AUTO_BACKUPS}个备份。</p>
        <div id="backup-list"></div>
        <button id="close-backup-modal" class="btn-primary" style="margin-top:16px;width:100%;">关闭</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const list = modal.querySelector('#backup-list');
    list.innerHTML = history.map((backup, idx) => {
      const totalCards = (backup.feynmanEntries || []).length;
      const totalHabits = (backup.habits || []).length;
      return `
        <div style="border:1px solid var(--border);border-radius:4px;padding:12px;margin-bottom:10px;background:#fff;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong style="font-family:'IBM Plex Mono',monospace;font-size:13px;">${backup.date}</strong>
            <button class="btn-primary" data-restore="${idx}" style="padding:6px 12px;font-size:12px;">恢复此备份</button>
          </div>
          <div style="font-size:12px;color:var(--ink-soft);">
            学习卡 ${totalCards} 张 · 习惯 ${totalHabits} 个 · 计划 ${(backup.scheduleRows || []).length} 行
          </div>
        </div>
      `;
    }).join('');
    
    modal.querySelector('#close-backup-modal').onclick = () => document.body.removeChild(modal);
    modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };
    
    modal.querySelectorAll('[data-restore]').forEach(btn => {
      btn.onclick = async () => {
        const idx = parseInt(btn.getAttribute('data-restore'));
        document.body.removeChild(modal);
        await restoreFromBackup(history[idx]);
      };
    });
  }

  async function saveFeynman() {
    try { await window.storage.set('feynman-data', JSON.stringify({entries: feynmanEntries})); }
    catch(e) { console.error('save feynman failed', e); }
    // 自动同步到云端
    if (autoSyncEnabled && cloudPasskey && !isSyncing) {
      debouncedSyncToCloud();
    }
  }

  async function saveHabits() {
    try { await window.storage.set('habit-data', JSON.stringify({habits, checks})); }
    catch(e) { console.error('save habits failed', e); }
    // 自动同步到云端
    if (autoSyncEnabled && cloudPasskey && !isSyncing) {
      debouncedSyncToCloud();
    }
  }

  async function saveSchedule() {
    try { await window.storage.set('schedule-data', JSON.stringify({rows: scheduleRows, cells: scheduleCells})); }
    catch(e) { console.error('save schedule failed', e); }
    // 自动同步到云端
    if (autoSyncEnabled && cloudPasskey && !isSyncing) {
      debouncedSyncToCloud();
    }
  }

  function debounce(fn, ms) {
    let t;
    return function(...args) { clearTimeout(t); t = setTimeout(() => fn.apply(null, args), ms); };
  }
  const debouncedSaveSchedule = debounce(saveSchedule, 500);

  // 防抖的云端同步函数
  const debouncedSyncToCloud = debounce(async function() {
    if (!cloudPasskey || isSyncing) return;
    try {
      await saveToCloud({
        cards: feynmanEntries,
        habits: habits,
        checks: checks,
        subjects: SUBJECTS,
        scheduleRows: scheduleRows,
        scheduleCells: scheduleCells
      });
    } catch(e) {
      console.error('Cloud sync failed:', e);
    }
  }, 2000);

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  function exportData() {
    const payload = JSON.stringify({
      app: 'feynman-habit-tracker',
      exportedAt: new Date().toISOString(),
      feynmanEntries, habits, checks, scheduleRows, scheduleCells
    }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'feynman-habit-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function importData(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const hasAny = Array.isArray(data.feynmanEntries) || Array.isArray(data.entries)
        || Array.isArray(data.habits) || Array.isArray(data.scheduleRows);
      if (!hasAny) throw new Error('bad format');
      feynmanEntries = Array.isArray(data.feynmanEntries) ? data.feynmanEntries : (Array.isArray(data.entries) ? data.entries : []);
      habits = Array.isArray(data.habits) ? data.habits : [];
      checks = data.checks || {};
      scheduleRows = Array.isArray(data.scheduleRows) ? data.scheduleRows : [];
      scheduleCells = data.scheduleCells || {};
      editingId = null; openCardId = null; subjectFilter = '全部'; weekOffset = 0;
      await saveFeynman(); await saveHabits(); await saveSchedule();
      render();
    } catch (e) {
      alert('导入失败：文件格式不正确。');
    }
    input.value = '';
  }

  function addScheduleRow() {
    scheduleRows.push({id: uid(), label: ''});
    saveSchedule(); render();
  }
  function removeScheduleRow(id) {
    scheduleRows = scheduleRows.filter(r => r.id !== id);
    Object.keys(scheduleCells).forEach(k => { if (k.startsWith(id+'_')) delete scheduleCells[k]; });
    saveSchedule(); render();
  }
  function updateScheduleLabel(id, value) {
    const row = scheduleRows.find(r => r.id === id);
    if (row) row.label = value;
    debouncedSaveSchedule();
  }
  function updateScheduleCell(rowId, dayIdx, value) {
    scheduleCells[rowId+'_'+dayIdx] = value;
    debouncedSaveSchedule();
  }

  function addFeynmanEntry(data) {
    feynmanEntries.unshift({
      id: uid(), topic: data.topic, subject: data.subject, chapter: data.chapter,
      explain: data.explain, gaps: data.gaps, simplify: data.simplify,
      date: fmtDate(new Date()), ivl: 0, nextReview: null, reviews: 0, gapDone: false
    });
    saveFeynman(); render();
  }
  function updateFeynmanEntry(id, data) {
    const c = feynmanEntries.find(e => e.id === id);
    if (!c) return;
    c.topic = data.topic; c.subject = data.subject; c.chapter = data.chapter;
    c.explain = data.explain; c.simplify = data.simplify;
    if (data.gaps !== c.gaps) { c.gaps = data.gaps; c.gapDone = false; }
    saveFeynman(); render();
  }
  function deleteFeynmanEntry(id) {
    feynmanEntries = feynmanEntries.filter(e => e.id !== id);
    if (editingId === id) editingId = null;
    saveFeynman(); render();
  }
  function toggleCard(id) { openCardId = openCardId === id ? null : id; render(); }
  function startEdit(id) {
    editingId = id;
    render();
    const form = document.querySelector('.new-card-form');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function cancelEdit() { editingId = null; render(); }

  const INTERVALS = [1, 2, 4, 7, 14, 30, 60, 90];

  function isDue(c, today) { return !!(c.reviews && c.nextReview && c.nextReview <= today); }
  function isNew(c) { return !c.reviews; }

  function cardMeta(c, today) {
    if (isDue(c, today)) return { key: 'due', label: '待复习' };
    if (isNew(c)) return { key: 'new', label: '新学' };
    const ivl = c.ivl || 0;
    if (ivl >= 6) return { key: 'mastered', label: '已掌握' };
    if (ivl >= 1) return { key: 'learning', label: '学习中' };
    return { key: 'relearn', label: '重新学习' };
  }

  // 改进的间隔重复算法（基于SM-2简化版）
  function reviewCard(id, grade) {
    const c = feynmanEntries.find(e => e.id === id);
    if (!c) return;
    
    // 初始化难度系数（easeFactor）
    if (!c.easeFactor) c.easeFactor = 2.5;
    
    const idx = Math.max(0, Math.min(c.ivl || 0, INTERVALS.length - 1));
    let next;
    let newEaseFactor = c.easeFactor;
    
    if (grade === 'again') {
      // 完全忘记：重置到开头，降低难度系数
      next = 0;
      newEaseFactor = Math.max(1.3, c.easeFactor - 0.2);
    } else if (grade === 'hard') {
      // 模糊：维持或稍微倒退，略微降低难度系数
      next = Math.max(0, idx - 1);
      newEaseFactor = Math.max(1.3, c.easeFactor - 0.15);
    } else if (grade === 'good') {
      // 记住：正常进步
      next = Math.min(idx + 1, INTERVALS.length - 1);
      // easeFactor不变
    } else {
      // 轻松：快速进步，提高难度系数
      next = Math.min(idx + 2, INTERVALS.length - 1);
      newEaseFactor = Math.min(2.5, c.easeFactor + 0.15);
    }
    
    c.ivl = next;
    c.easeFactor = newEaseFactor;
    c.reviews = (c.reviews || 0) + 1;
    c.lastReview = fmtDate(new Date());
    
    // 计算下次复习日期，考虑难度系数
    const baseInterval = INTERVALS[next];
    const adjustedInterval = Math.round(baseInterval * (c.easeFactor / 2.5));
    c.nextReview = fmtDate(new Date(Date.now() + adjustedInterval * DAY_MS));
    
    saveFeynman(); 
    render();
  }

  function toggleGapDone(id) {
    const c = feynmanEntries.find(e => e.id === id);
    if (c) { c.gapDone = !c.gapDone; saveFeynman(); render(); }
  }

  function addHabit(name) {
    if (!name.trim()) return;
    habits.push({id: uid(), name: name.trim()});
    saveHabits(); render();
  }
  function removeHabit(id) {
    habits = habits.filter(h => h.id !== id);
    Object.keys(checks).forEach(k => { if (k.startsWith(id+'_')) delete checks[k]; });
    saveHabits(); render();
  }
  function toggleCheck(habitId, dateStr) {
    const key = habitId + '_' + dateStr;
    checks[key] = !checks[key];
    saveHabits(); render();
  }
  function weekStreak(habitId, dates) { return dates.filter(d => checks[habitId + '_' + fmtDate(d)]).length; }
  function currentStreak(habitId) {
    let streak = 0;
    const d = new Date();
    if (!checks[habitId + '_' + fmtDate(d)]) d.setDate(d.getDate() - 1);
    while (checks[habitId + '_' + fmtDate(d)]) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }

  function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  
  // 搜索功能
  function matchesSearch(entry) {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const searchFields = [
      entry.topic || '',
      entry.subject || '',
      entry.chapter || '',
      entry.explain || '',
      entry.gaps || '',
      entry.simplify || ''
    ].join(' ').toLowerCase();
    return searchFields.includes(q);
  }
  
  function highlightText(text, query) {
    if (!query.trim() || !text) return escapeHtml(text);
    const q = query.trim();
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escapeHtml(text).replace(new RegExp(regex.source, 'gi'), '<mark style="background:#FFE066;padding:1px 2px;border-radius:2px;">$1</mark>');
  }

  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }
  
  // 快捷键处理
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + N: 新建卡片
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (editingId) cancelEdit();
        document.querySelector('#f-topic')?.focus();
        document.querySelector('#feynman-panel')?.scrollIntoView({ behavior: 'smooth' });
      }
      
      // Ctrl/Cmd + S: 保存当前编辑
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        document.querySelector('#f-save')?.click();
      }
      
      // Esc: 取消编辑或关闭打开的卡片
      if (e.key === 'Escape') {
        if (editingId) {
          cancelEdit();
        } else if (openCardId) {
          openCardId = null;
          render();
        }
      }
      
      // Ctrl/Cmd + F: 聚焦搜索框
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        document.querySelector('#search-input')?.focus();
      }
      
      // Ctrl/Cmd + B: 打开备份管理器
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        showBackupManager();
      }
      
      // Ctrl/Cmd + I: 打开统计面板
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        showStatsPanel();
      }
      
      // Ctrl/Cmd + H: 打开帮助系统
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        showHelpPanel();
      }
      
      // 数字键 1-4: 快速评分（仅当有打开的卡片时）
      if (openCardId && !editingId && ['1','2','3','4'].includes(e.key)) {
        const grades = ['again', 'hard', 'good', 'easy'];
        const grade = grades[parseInt(e.key) - 1];
        reviewCard(openCardId, grade);
        e.preventDefault();
      }
    });
  }
  
  // 关闭欢迎引导
  async function dismissWelcome() {
    showWelcome = false;
    try {
      await window.storage.set(WELCOME_SHOWN_KEY, 'true');
    } catch(e) {}
    render();
  }
  
  // 显示帮助面板
  function showHelpPanel() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:800px;">
        <button class="modal-close" id="close-help">×</button>
        <h3 class="modal-title">📖 使用帮助与技巧</h3>
        
        <div class="help-tabs">
          <button class="help-tab active" data-tab="quickstart">快速开始</button>
          <button class="help-tab" data-tab="shortcuts">快捷键</button>
          <button class="help-tab" data-tab="tips">使用技巧</button>
          <button class="help-tab" data-tab="faq">常见问题</button>
        </div>
        
        <!-- 快速开始 -->
        <div class="help-content active" data-content="quickstart">
          <div class="help-section">
            <h4>📝 创建你的第一张学习卡</h4>
            <ol style="padding-left:20px;margin:0;">
              <li style="margin-bottom:8px;"><strong>选择科目</strong>：从下拉列表选择，或使用默认的"其他"</li>
              <li style="margin-bottom:8px;"><strong>填写主题</strong>：例如"操作系统的死锁"</li>
              <li style="margin-bottom:8px;"><strong>用自己的话讲解</strong>：假装给完全不懂的人解释，越通俗越好</li>
              <li style="margin-bottom:8px;"><strong>记录卡壳的地方</strong>：哪里讲不清楚？这就是要补的地方</li>
              <li style="margin-bottom:8px;"><strong>简化总结</strong>：用一两句话或一个类比浓缩这个概念</li>
            </ol>
            <div class="help-tip">
              💡 <strong>技巧</strong>：创建卡片时按 <span class="help-kbd">Ctrl</span> + <span class="help-kbd">S</span> 快速保存
            </div>
          </div>
          
          <div class="help-section">
            <h4>🔄 如何有效复习</h4>
            <p><strong>三步复习法：</strong></p>
            <ol style="padding-left:20px;margin:0;">
              <li style="margin-bottom:8px;">点击卡片标题，<strong>先不看内容</strong></li>
              <li style="margin-bottom:8px;">尝试用自己的话默讲一遍</li>
              <li style="margin-bottom:8px;">展开卡片对照，根据记忆程度评分：
                <ul style="margin-top:6px;padding-left:20px;">
                  <li><strong>1/忘记</strong>：完全想不起来 → 重新学习</li>
                  <li><strong>2/模糊</strong>：记得一些但不完整 → 需要巩固</li>
                  <li><strong>3/记住</strong>：基本都能讲出来 → 正常进步（最常用）</li>
                  <li><strong>4/轻松</strong>：非常熟练，可以教别人 → 谨慎使用</li>
                </ul>
              </li>
            </ol>
            <div class="help-warning">
              ⚠️ <strong>注意</strong>：不要高估自己！选"轻松"会大幅延长复习间隔，可能导致遗忘。只在真的非常熟练时使用。
            </div>
          </div>
          
          <div class="help-section">
            <h4>✅ 建立学习习惯</h4>
            <ul class="help-list">
              <li>每天固定时间复习（如早上7点或睡前）</li>
              <li>优先复习标记为"待复习"的卡片</li>
              <li>学习新内容后立即创建卡片</li>
              <li>每周查看统计面板（<span class="help-kbd">Ctrl</span>+<span class="help-kbd">I</span>）了解进度</li>
              <li>定期导出备份到云盘保存</li>
            </ul>
          </div>
        </div>
        
        <!-- 快捷键 -->
        <div class="help-content" data-content="shortcuts">
          <div class="help-section">
            <h4>⌨️ 卡片操作</h4>
            <table style="width:100%;border-collapse:collapse;">
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:8px;font-family:'IBM Plex Mono',monospace;"><span class="help-kbd">Ctrl</span> + <span class="help-kbd">N</span></td>
                <td style="padding:8px;">新建卡片（聚焦表单）</td>
              </tr>
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:8px;font-family:'IBM Plex Mono',monospace;"><span class="help-kbd">Ctrl</span> + <span class="help-kbd">S</span></td>
                <td style="padding:8px;">保存当前编辑的卡片</td>
              </tr>
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:8px;font-family:'IBM Plex Mono',monospace;"><span class="help-kbd">Esc</span></td>
                <td style="padding:8px;">取消编辑或关闭打开的卡片</td>
              </tr>
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:8px;font-family:'IBM Plex Mono',monospace;"><span class="help-kbd">1</span> - <span class="help-kbd">4</span></td>
                <td style="padding:8px;">打开卡片时快速评分（1=忘记，2=模糊，3=记住，4=轻松）</td>
              </tr>
            </table>
          </div>
          
          <div class="help-section">
            <h4>🔧 工具功能</h4>
            <table style="width:100%;border-collapse:collapse;">
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:8px;font-family:'IBM Plex Mono',monospace;"><span class="help-kbd">Ctrl</span> + <span class="help-kbd">F</span></td>
                <td style="padding:8px;">聚焦搜索框，快速查找卡片</td>
              </tr>
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:8px;font-family:'IBM Plex Mono',monospace;"><span class="help-kbd">Ctrl</span> + <span class="help-kbd">B</span></td>
                <td style="padding:8px;">打开备份管理器</td>
              </tr>
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:8px;font-family:'IBM Plex Mono',monospace;"><span class="help-kbd">Ctrl</span> + <span class="help-kbd">I</span></td>
                <td style="padding:8px;">打开统计面板</td>
              </tr>
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:8px;font-family:'IBM Plex Mono',monospace;"><span class="help-kbd">Ctrl</span> + <span class="help-kbd">H</span></td>
                <td style="padding:8px;">打开帮助面板（本窗口）</td>
              </tr>
            </table>
            <p style="font-size:12px;color:var(--ink-soft);margin-top:12px;">
              💡 Mac用户使用 <span class="help-kbd">Cmd</span> 代替 <span class="help-kbd">Ctrl</span>
            </p>
          </div>
        </div>
        
        <!-- 使用技巧 -->
        <div class="help-content" data-content="tips">
          <div class="help-section">
            <h4>📝 如何写好一张学习卡</h4>
            <p><strong>❌ 不好的例子：</strong></p>
            <div style="background:#f5f5f5;padding:12px;border-radius:4px;margin:8px 0;">
              <div style="font-size:13px;margin-bottom:4px;"><strong>主题</strong>：操作系统</div>
              <div style="font-size:12px;color:var(--ink-soft);">（太宽泛）</div>
            </div>
            
            <p><strong>✅ 好的例子：</strong></p>
            <div style="background:var(--sage-soft);padding:12px;border-radius:4px;margin:8px 0;">
              <div style="font-size:13px;margin-bottom:4px;"><strong>主题</strong>：操作系统中的死锁及其四个必要条件</div>
              <div style="font-size:12px;"><strong>讲解</strong>：死锁就像四辆车在十字路口都不让路。四个条件：1）互斥（车不能重叠）2）占有且等待（占着路还要等）3）不可抢占（不能把别的车推走）4）循环等待（A等B，B等C，C等D，D等A）</div>
            </div>
          </div>
          
          <div class="help-section">
            <h4>🎯 盲点清单使用技巧</h4>
            <ul class="help-list">
              <li><strong>具体描述</strong>："死锁的第三个条件不理解" 比 "不懂" 更好</li>
              <li><strong>及时攻克</strong>：标记盲点后，针对性学习，理解后立即勾选</li>
              <li><strong>定期回顾</strong>：查看攻克进度（统计面板），保持进步感</li>
              <li><strong>不要害怕</strong>：盲点越多说明你越诚实，这是进步的起点</li>
            </ul>
          </div>
          
          <div class="help-section">
            <h4>📈 科目平衡策略</h4>
            <p>按 <span class="help-kbd">Ctrl</span>+<span class="help-kbd">I</span> 查看科目分布：</p>
            <ul class="help-list">
              <li><strong>避免失衡</strong>：某科占比超过60%要注意</li>
              <li><strong>重点科目40-50%</strong>：给重要科目更多关注</li>
              <li><strong>其他科目平均</strong>：保持全面发展</li>
              <li><strong>每周调整</strong>：根据考试时间动态调整比例</li>
            </ul>
          </div>
          
          <div class="help-section">
            <h4>⏰ 复习时间安排</h4>
            <div class="help-tip">
              <strong>最佳复习时间：</strong><br>
              🌅 <strong>早上</strong>：大脑清醒，适合复习困难卡片<br>
              🌙 <strong>睡前</strong>：记忆巩固，适合快速过一遍<br>
              💡 <strong>碎片时间</strong>：通勤时可以默想卡片内容
            </div>
            <p><strong>每日建议：</strong></p>
            <ul class="help-list">
              <li>待复习 ≤ 10张：15-20分钟</li>
              <li>待复习 10-20张：20-30分钟</li>
              <li>待复习 > 20张：需要补课，先学习再复习</li>
            </ul>
          </div>
          
          <div class="help-section">
            <h4>🔍 搜索技巧</h4>
            <ul class="help-list">
              <li>搜索关键词会高亮显示，方便定位</li>
              <li>搜索 + 科目筛选组合使用更精准</li>
              <li>搜索"死锁"比搜索"操作系统 死锁"范围更广</li>
              <li>搜索会匹配所有内容（主题、讲解、卡壳、简化）</li>
            </ul>
          </div>
        </div>
        
        <!-- 常见问题 -->
        <div class="help-content" data-content="faq">
          <div class="help-section">
            <h4>❓ 数据会丢失吗？</h4>
            <p>数据保存在浏览器本地存储中，<strong>不会自动丢失</strong>。但以下情况会清空数据：</p>
            <ul class="help-list">
              <li>手动清除浏览器数据（Cookie、缓存等）</li>
              <li>使用"隐私模式/无痕模式"（关闭后数据消失）</li>
              <li>卸载浏览器</li>
            </ul>
            <div class="help-tip">
              💾 <strong>保护数据</strong>：定期点击"导出备份"保存到云盘（如OneDrive、百度网盘）
            </div>
          </div>
          
          <div class="help-section">
            <h4>❓ 自动备份在哪里？</h4>
            <p>自动备份也存在浏览器本地存储中，不是独立文件。按 <span class="help-kbd">Ctrl</span>+<span class="help-kbd">B</span> 可以查看和恢复最近5个自动备份。</p>
            <div class="help-warning">
              ⚠️ 清除浏览器数据会<strong>同时删除</strong>自动备份！务必手动导出备份文件。
            </div>
          </div>
          
          <div class="help-section">
            <h4>❓ 可以在多个设备使用吗？</h4>
            <p>目前不支持自动同步。要在多设备使用：</p>
            <ol style="padding-left:20px;margin:0;">
              <li style="margin-bottom:6px;">在设备A点"导出备份"</li>
              <li style="margin-bottom:6px;">将备份文件传到设备B（邮件、聊天工具、云盘等）</li>
              <li style="margin-bottom:6px;">在设备B点"导入备份"</li>
            </ol>
          </div>
          
          <div class="help-section">
            <h4>❓ 为什么我选"轻松"后很久才复习？</h4>
            <p>这是<strong>正常的</strong>！系统使用改进的SM-2算法：</p>
            <ul class="help-list">
              <li>选"轻松"会提高难度系数，延长复习间隔</li>
              <li>说明你真的掌握了，不需要频繁复习</li>
              <li>如果担心遗忘，下次选"记住"而不是"轻松"</li>
            </ul>
          </div>
          
          <div class="help-section">
            <h4>❓ 卡片太多怎么办？</h4>
            <p>几个应对策略：</p>
            <ul class="help-list">
              <li><strong>减少新增</strong>：暂停创建新卡片，专注复习</li>
              <li><strong>提高标准</strong>：不是所有内容都值得做卡片</li>
              <li><strong>归档旧卡</strong>：考完的科目可以导出后删除</li>
              <li><strong>合并相似</strong>：多张讲同一概念的卡片可以合并</li>
            </ul>
          </div>
          
          <div class="help-section">
            <h4>❓ 习惯完成率很低怎么办？</h4>
            <div class="help-tip">
              从小习惯开始：<br>
              ❌ "每天学习8小时"（太难）<br>
              ✅ "每天复习15分钟"（容易坚持）<br><br>
              习惯数量：2-3个足够，不要贪多
            </div>
          </div>
          
          <div class="help-section">
            <h4>❓ 搜索功能支持什么？</h4>
            <p>支持普通文本搜索，不支持正则表达式。搜索会匹配：</p>
            <ul class="help-list">
              <li>卡片主题</li>
              <li>科目和章节</li>
              <li>讲解内容</li>
              <li>卡壳的地方</li>
              <li>简化总结</li>
            </ul>
          </div>
        </div>
        
        <button class="btn-primary" style="margin-top:20px;width:100%;" id="close-help-btn">关闭</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Tab切换逻辑
    const tabs = modal.querySelectorAll('.help-tab');
    const contents = modal.querySelectorAll('.help-content');
    tabs.forEach(tab => {
      tab.onclick = () => {
        const targetTab = tab.getAttribute('data-tab');
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        modal.querySelector(`[data-content="${targetTab}"]`).classList.add('active');
      };
    });
    
    modal.querySelector('#close-help').onclick = () => document.body.removeChild(modal);
    modal.querySelector('#close-help-btn').onclick = () => document.body.removeChild(modal);
    modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };
  }
  
  // 统计数据计算
  function calculateStats() {
    const today = fmtDate(new Date());
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
    const monthAgo = new Date(now.getTime() - 30 * DAY_MS);
    
    // 卡片统计
    const totalCards = feynmanEntries.length;
    const dueCards = feynmanEntries.filter(e => isDue(e, today)).length;
    const newCards = feynmanEntries.filter(e => isNew(e)).length;
    const masteredCards = feynmanEntries.filter(e => (e.ivl || 0) >= 6).length;
    
    // 最近7天新增
    const recentCards = feynmanEntries.filter(e => {
      if (!e.date) return false;
      return e.date >= fmtDate(weekAgo);
    }).length;
    
    // 最近7天复习次数
    const recentReviews = feynmanEntries.reduce((sum, e) => {
      if (!e.lastReview || e.lastReview < fmtDate(weekAgo)) return sum;
      return sum + 1;
    }, 0);
    
    // 盲点统计
    const totalGaps = feynmanEntries.filter(e => e.gaps && e.gaps.trim()).length;
    const solvedGaps = feynmanEntries.filter(e => e.gapDone).length;
    const gapProgress = totalGaps > 0 ? Math.round((solvedGaps / totalGaps) * 100) : 0;
    
    // 科目分布
    const subjectDist = {};
    feynmanEntries.forEach(e => {
      const subj = e.subject || '其他';
      subjectDist[subj] = (subjectDist[subj] || 0) + 1;
    });
    
    // 习惯统计
    const totalHabits = habits.length;
    let totalChecks = 0;
    const last7Days = Array.from({length: 7}, (_, i) => {
      const d = new Date(now.getTime() - i * DAY_MS);
      return fmtDate(d);
    });
    
    habits.forEach(h => {
      last7Days.forEach(d => {
        if (checks[h.id + '_' + d]) totalChecks++;
      });
    });
    
    const habitCompletion = (totalHabits * 7) > 0 ? Math.round((totalChecks / (totalHabits * 7)) * 100) : 0;
    
    return {
      totalCards, dueCards, newCards, masteredCards, recentCards, recentReviews,
      totalGaps, solvedGaps, gapProgress,
      subjectDist,
      totalHabits, habitCompletion
    };
  }
  
  // 显示统计面板
  function showStatsPanel() {
    const stats = calculateStats();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" id="close-stats">×</button>
        <h3 class="modal-title">📊 学习统计</h3>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${stats.totalCards}</div>
            <div class="stat-label">总卡片数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:var(--rust);">${stats.dueCards}</div>
            <div class="stat-label">待复习</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:var(--sage);">${stats.masteredCards}</div>
            <div class="stat-label">已掌握</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.recentCards}</div>
            <div class="stat-label">近7天新增</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.recentReviews}</div>
            <div class="stat-label">近7天复习</div>
          </div>
        </div>
        
        <div style="margin-top:20px;">
          <h4 style="font-size:15px;margin:0 0 10px;font-family:'Newsreader',serif;">盲点攻克进度</h4>
          <div style="font-size:13px;color:var(--ink-soft);margin-bottom:8px;">
            已攻克 ${stats.solvedGaps} / ${stats.totalGaps} 个盲点
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${stats.gapProgress}%;"></div>
          </div>
        </div>
        
        <div style="margin-top:20px;">
          <h4 style="font-size:15px;margin:0 0 10px;font-family:'Newsreader',serif;">科目分布</h4>
          ${Object.entries(stats.subjectDist).map(([subj, count]) => {
            const pct = Math.round((count / stats.totalCards) * 100);
            return `
              <div style="margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
                  <span>${subj}</span>
                  <span>${count} 张 (${pct}%)</span>
                </div>
                <div class="progress-bar" style="height:6px;">
                  <div class="progress-fill" style="width:${pct}%;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        
        <div style="margin-top:20px;">
          <h4 style="font-size:15px;margin:0 0 10px;font-family:'Newsreader',serif;">习惯完成率（近7天）</h4>
          <div style="font-size:13px;color:var(--ink-soft);margin-bottom:8px;">
            完成 ${stats.habitCompletion}%
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${stats.habitCompletion}%;background:var(--sage);"></div>
          </div>
        </div>
        
        <button class="btn-primary" style="margin-top:20px;width:100%;" id="close-stats-btn">关闭</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#close-stats').onclick = () => document.body.removeChild(modal);
    modal.querySelector('#close-stats-btn').onclick = () => document.body.removeChild(modal);
    modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };
  }

  function render() {
    const app = document.getElementById('app');
    const dates = weekDates(weekOffset);
    const today = fmtDate(new Date());
    const isThisWeek = weekOffset === 0;
    const weekLabel = isThisWeek
      ? `本周（${fmtDate(dates[0]).slice(5)} – ${fmtDate(dates[6]).slice(5)}）`
      : `${fmtDate(dates[0])} – ${fmtDate(dates[6])}`;

    const editing = editingId ? feynmanEntries.find(e => e.id === editingId) : null;
    const subjectOptions = SUBJECTS.slice();
    if (editing && editing.subject && !subjectOptions.includes(editing.subject)) subjectOptions.unshift(editing.subject);
    
    // 应用搜索过滤
    const searchFiltered = feynmanEntries.filter(e => matchesSearch(e));
    const filteredEntries = searchFiltered.filter(e => subjectFilter === '全部' || (e.subject || '其他') === subjectFilter);
    
    const sortRank = (c) => isDue(c, today) ? 0 : (isNew(c) ? 1 : 2);
    const sortedEntries = filteredEntries.slice().sort((a, b) => {
      return sortRank(a) - sortRank(b) || (b.date || '').localeCompare(a.date || '');
    });
    const dueCount = searchFiltered.filter(e => isDue(e, today)).length;
    const newCount = searchFiltered.filter(e => isNew(e)).length;
    const gapItems = searchFiltered.filter(e => e.gaps && e.gaps.trim());

    app.className = '';
    app.innerHTML = `
      <div class="stats-line">
        学习卡 <b>${feynmanEntries.length}</b> 张 · 习惯 <b>${habits.length}</b> 个 · 计划 <b>${scheduleRows.length}</b> 行
        <button class="btn-text" id="show-stats-btn" style="margin-left:12px;padding:4px 8px;text-decoration:none;border:1px solid var(--border);border-radius:3px;font-size:11px;">📊 统计</button>
        <button class="btn-text" id="show-help-btn" style="margin-left:4px;padding:4px 8px;text-decoration:none;border:1px solid var(--border);border-radius:3px;font-size:11px;">❓ 帮助</button>
        <span style="float:right;font-size:10px;color:var(--ink-soft);">
          快捷键: Ctrl+N 新建 · Ctrl+S 保存 · Ctrl+F 搜索 · Ctrl+H 帮助
        </span>
      </div>
      
      ${showWelcome ? `
      <div class="welcome-card">
        <div class="welcome-title">👋 欢迎使用费曼学习卡！</div>
        <p style="margin:0 0 16px;font-size:13.5px;line-height:1.65;">
          这是一个基于<strong>费曼学习法</strong>和<strong>间隔重复算法</strong>的学习工具。让我们用3分钟快速上手：
        </p>
        <div class="welcome-steps">
          <div class="welcome-step">
            <div class="welcome-step-num">1</div>
            <div class="welcome-step-content">
              <div class="welcome-step-title">创建第一张学习卡</div>
              <div class="welcome-step-desc">按 Ctrl+N 或在下方表单填写。用自己的话讲解概念，记录不理解的地方。</div>
            </div>
          </div>
          <div class="welcome-step">
            <div class="welcome-step-num">2</div>
            <div class="welcome-step-content">
              <div class="welcome-step-title">每天复习</div>
              <div class="welcome-step-desc">点击卡片，先自己默讲一遍，再展开对照。根据记忆程度评分，系统自动安排下次复习。</div>
            </div>
          </div>
          <div class="welcome-step">
            <div class="welcome-step-num">3</div>
            <div class="welcome-step-content">
              <div class="welcome-step-title">善用工具</div>
              <div class="welcome-step-desc">按 Ctrl+F 搜索卡片，Ctrl+I 查看统计，Ctrl+H 查看完整帮助。</div>
            </div>
          </div>
        </div>
        <div class="welcome-actions">
          <button class="btn-primary" id="dismiss-welcome">开始使用</button>
          <button class="btn-text" id="show-full-help">查看完整帮助 (Ctrl+H)</button>
        </div>
      </div>
      ` : ''}
      <div class="layout">
        <section class="panel" id="feynman-panel">
          <div class="panel-title">费曼学习卡 <span class="due-badge">待复习 ${dueCount}</span>${newCount > 0 ? ` <span class="new-badge">新学 ${newCount}</span>` : ''}</div>
          <p class="panel-hint">先默讲一遍再点开卡片；复习后评分（或按数字键1-4），系统按间隔自动安排下次复习。卡片第③步「卡壳的地方」会自动进「盲点清单」。</p>
          
          <!-- 搜索框 -->
          <div class="search-bar">
            <input type="text" id="search-input" placeholder="🔍 搜索卡片内容（Ctrl+F）..." value="${escapeAttr(searchQuery)}" style="width:100%;padding:8px 12px;font-size:13px;">
            ${searchQuery ? `<div style="font-size:11.5px;color:var(--blue);margin-top:4px;">找到 ${searchFiltered.length} 张卡片</div>` : ''}
          </div>
          
          <div class="subject-filter">
            ${['全部'].concat(SUBJECTS).map(s => `<button class="filter-chip ${subjectFilter===s?'active':''}" data-filter="${s}">${s}</button>`).join('')}
          </div>
          <div class="new-card-form">
            <div class="form-title">${editing ? '编辑卡片：' + (escapeHtml(editing.topic) || '（未命名）') : '新建卡片'}</div>
            <label class="field-label">科目 / 章节</label>
            <div class="subject-row">
              <select id="f-subject">
                ${subjectOptions.map(s => `<option value="${s}" ${editing && (editing.subject||'其他')===s ? 'selected':''}>${s}</option>`).join('')}
              </select>
              <input type="text" id="f-chapter" placeholder="章节 / 标签（可选），如：死锁" value="${editing ? escapeAttr(editing.chapter) : ''}">
            </div>
            <label class="field-label">① 概念 / 主题
              <span class="tip-badge" title="要具体！不要写'操作系统'，要写'操作系统的死锁'">💡</span>
            </label>
            <input type="text" id="f-topic" placeholder="例如：操作系统的死锁" value="${editing ? escapeAttr(editing.topic) : ''}" maxlength="100">
            <label class="field-label">② 用自己的话讲给一个完全不懂的人听
              <span class="tip-badge" title="假装对方零基础，多用类比和例子">💡</span>
            </label>
            <textarea id="f-explain" placeholder="假装对方零基础，尽量用类比、不用术语" maxlength="2000">${editing ? escapeHtml(editing.explain) : ''}</textarea>
            <label class="field-label">③ 哪里讲不清楚 / 卡壳了
              <span class="tip-badge" title="诚实记录！这些会进入盲点清单">💡</span>
            </label>
            <textarea id="f-gaps" placeholder="写下卡住的地方，这就是真正要回去补的地方" maxlength="1000">${editing ? escapeHtml(editing.gaps) : ''}</textarea>
            <label class="field-label">④ 回去补完后，再简化一次
              <span class="tip-badge" title="用一两句话浓缩核心">💡</span>
            </label>
            <textarea id="f-simplify" placeholder="用一两句话或一个类比，浓缩这个概念" maxlength="500">${editing ? escapeHtml(editing.simplify) : ''}</textarea>
            <div class="form-actions">
              <button class="btn-primary" id="f-save">${editing ? '更新卡片' : '保存这张卡片'}</button>
              ${editing ? '<button class="btn-text" id="f-cancel-edit">取消编辑 (Esc)</button>' : ''}
            </div>
          </div>
          <div id="fcard-list">
            ${sortedEntries.length === 0 ? `
              <div class="empty-state">
                ${searchQuery ? '没有找到匹配的卡片' : `
                  <div style="padding:20px;">
                    <div style="font-size:48px;margin-bottom:12px;">📚</div>
                    <div style="font-size:15px;margin-bottom:12px;color:var(--ink);">还没有学习卡片</div>
                    <div style="font-size:13px;line-height:1.6;margin-bottom:16px;">
                      学完一个概念就创建一张卡片<br>
                      用自己的话讲一遍，找出不理解的地方
                    </div>
                    <button class="btn-primary" onclick="document.querySelector('#f-topic').focus();document.querySelector('#feynman-panel').scrollIntoView({behavior:'smooth'});">创建第一张卡片</button>
                  </div>
                `}
              </div>
            ` :
              sortedEntries.map(e => {
                const meta = cardMeta(e, today);
                const isOpen = openCardId === e.id;
                const query = searchQuery.trim();
                return `
                <div class="fcard ${isOpen ? 'open':''} ${meta.key==='due' ? 'due':''} ${editingId===e.id ? 'editing':''}" data-id="${e.id}">
                  <div class="fcard-head" data-toggle="${e.id}">
                    <span class="fcard-topic-wrap">
                      <span class="subject-tag">${escapeHtml(e.subject||'其他')}${e.chapter ? ' · '+escapeHtml(e.chapter) : ''}</span>
                      <span class="fcard-topic">${query ? highlightText(e.topic||'（未命名）', query) : (escapeHtml(e.topic)||'（未命名）')}</span>
                    </span>
                    <span class="fcard-meta">
                      <span class="badge badge-${meta.key}">${meta.label}</span>
                      <span class="fcard-date">${e.nextReview ? e.nextReview : e.date}</span>
                    </span>
                  </div>
                  <div class="fcard-body">
                    <div class="fcard-step"><span class="step-label">讲给别人听</span>${query ? highlightText(e.explain||'—', query) : (escapeHtml(e.explain)||'—')}</div>
                    <div class="fcard-step"><span class="step-label">卡壳的地方</span>${query ? highlightText(e.gaps||'—', query) : (escapeHtml(e.gaps)||'—')}</div>
                    <div class="fcard-step"><span class="step-label">简化后</span>${query ? highlightText(e.simplify||'—', query) : (escapeHtml(e.simplify)||'—')}</div>
                    <div class="review-row">
                      <span class="step-label">复习评分（决定下次复习时间）${isOpen ? ' — 或按数字键 1-4' : ''}</span>
                      <div class="review-btns">
                        <button class="review-btn again" data-review="${e.id}" data-grade="again">1️⃣ 忘记</button>
                        <button class="review-btn hard" data-review="${e.id}" data-grade="hard">2️⃣ 模糊</button>
                        <button class="review-btn good" data-review="${e.id}" data-grade="good">3️⃣ 记住</button>
                        <button class="review-btn easy" data-review="${e.id}" data-grade="easy">4️⃣ 轻松</button>
                      </div>
                    </div>
                    <div class="fcard-actions">
                      <button class="btn-text" data-edit="${e.id}">编辑</button>
                      <button class="btn-text danger" data-del="${e.id}">删除</button>
                    </div>
                  </div>
                </div>
              `;
              }).join('')
            }
          </div>
          <div class="gap-bank">
            <div class="gap-bank-title">盲点清单 <span class="due-badge">${gapItems.filter(e => !e.gapDone).length}</span>
              <span class="tip-badge" title="卡片第③步「卡壳的地方」会自动汇总到这里">?</span>
            </div>
            ${gapItems.length === 0 ? `
              <div class="empty-state">
                <div style="padding:16px;">
                  <div style="font-size:13px;color:var(--ink-soft);margin-bottom:8px;">暂无盲点</div>
                  <div style="font-size:12px;color:var(--ink-soft);line-height:1.5;">
                    创建卡片时在第③步填写"卡壳的地方"<br>
                    这些内容会自动进入盲点清单
                  </div>
                </div>
              </div>
            ` :
              gapItems.map(e => `
                <div class="gap-item ${e.gapDone ? 'done':''}">
                  <span class="gap-check" data-gap="${e.id}" title="${e.gapDone ? '撤销已攻克' : '标记已攻克'}">${e.gapDone ? '✓' : '○'}</span>
                  <div class="gap-text">
                    <div class="gap-topic">${escapeHtml(e.subject||'其他')}${e.chapter ? ' · '+escapeHtml(e.chapter) : ''} — ${escapeHtml(e.topic)||'（未命名）'}</div>
                    <div>${searchQuery ? highlightText(e.gaps, searchQuery) : escapeHtml(e.gaps)}</div>
                  </div>
                </div>
              `).join('')
            }
          </div>
        </section>

        <section class="panel" id="habit-panel">
          <div class="panel-title">习惯记录</div>
          <p class="panel-hint">自己定义要盯的习惯，每天打卡</p>
          <div class="habit-add-row">
            <input type="text" id="h-name" placeholder="添加一个习惯">
            <button class="btn-primary" id="h-add">添加</button>
          </div>
          <div class="week-nav">
            <div><button id="week-prev">‹ 上一周</button></div>
            <span>${weekLabel}</span>
            <div>
              ${isThisWeek ? '' : '<button id="week-today" class="btn-today">回到本周</button>'}
              <button id="week-next">下一周 ›</button>
            </div>
          </div>
          ${habits.length === 0 ? `
            <div class="empty-state">
              <div style="padding:20px;">
                <div style="font-size:40px;margin-bottom:12px;">✅</div>
                <div style="font-size:13px;color:var(--ink-soft);margin-bottom:12px;">还没有习惯记录</div>
                <div style="font-size:12px;color:var(--ink-soft);line-height:1.5;margin-bottom:12px;">
                  添加一个想要养成的习惯<br>
                  每天完成就打勾，积累连续天数
                </div>
                <div style="font-size:11px;color:var(--blue);">💡 建议从2-3个小习惯开始</div>
              </div>
            </div>
          ` : `
          <table class="habit-table">
            <thead>
              <tr>
                <th style="text-align:left;">习惯</th>
                ${dates.map(d => {
                  const isToday = fmtDate(d) === today;
                  return `<th class="${isToday?'is-today':''}">${WEEKDAYS[(d.getDay()+6)%7]}</th>`;
                }).join('')}
                <th>本周</th>
              </tr>
            </thead>
            <tbody>
              ${habits.map(h => `
                <tr>
                  <td class="habit-name-cell">${escapeHtml(h.name)}<button class="habit-row-remove" data-rmhabit="${h.id}" title="删除习惯">×</button>${currentStreak(h.id) > 0 ? `<div class="habit-streak">🔥 ${currentStreak(h.id)} 天</div>` : ''}</td>
                  ${dates.map(d => {
                    const ds = fmtDate(d);
                    const isChecked = !!checks[h.id+'_'+ds];
                    const isToday = ds === today;
                    return `<td class="${isToday?'is-today':''}"><span class="check-box ${isChecked?'checked':''}" data-check="${h.id}" data-date="${ds}">${isChecked?'✓':''}</span></td>`;
                  }).join('')}
                  <td class="streak-cell">${weekStreak(h.id, dates)}/7</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          `}
        </section>
      </div>

      <section class="panel full-width" id="schedule-panel">
        <div class="panel-title">每周计划表</div>
        <p class="panel-hint">自己加时间段、自己填每天安排，这是固定的每周模板，不跟具体日期绑定</p>
        <div class="schedule-wrap">
        <table class="schedule-table">
          <thead>
            <tr>
              <th style="min-width:60px;">时间段</th>
              ${WEEKDAY_FULL.map(w => `<th>${w}</th>`).join('')}
              <th style="width:20px;"></th>
            </tr>
          </thead>
          <tbody>
            ${scheduleRows.length === 0 ? `<tr><td colspan="9"><div class="empty-state">还没有时间段，点下面“添加时间段”开始排</div></td></tr>` :
              scheduleRows.map(r => `
                <tr>
                  <td><textarea class="slot-label-input" data-row-label="${r.id}" placeholder="如 9-11点">${escapeHtml(r.label)}</textarea></td>
                  ${[0,1,2,3,4,5,6].map(di => `
                    <td><textarea class="cell-input" data-cell-row="${r.id}" data-cell-day="${di}">${escapeHtml(scheduleCells[r.id+'_'+di]||'')}</textarea></td>
                  `).join('')}
                  <td><button class="slot-row-remove" data-rmrow="${r.id}" title="删除这一行">×</button></td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
        </div>
        <div class="add-slot-row"><button class="btn-primary" id="add-row-btn">添加时间段</button></div>
      </section>

      <div class="footer-note">
        数据只保存在你自己这里 ·
        <button class="btn-text" id="export-data">导出备份</button> ·
        <button class="btn-text" id="import-data">导入备份</button> ·
        <button class="btn-text" id="backup-manager">备份历史 (Ctrl+B)</button> ·
        <button class="btn-text danger" id="reset-all">清空全部数据</button>
      </div>
      <input type="file" id="import-file" accept="application/json,text/plain" style="display:none">
    `;

    bindEvents(app);
  }

  function bindEvents(app) {
    const saveBtn = app.querySelector('#f-save');
    if (saveBtn) saveBtn.onclick = () => {
      const topic = app.querySelector('#f-topic').value;
      const subject = app.querySelector('#f-subject').value;
      const chapter = app.querySelector('#f-chapter').value;
      const explain = app.querySelector('#f-explain').value;
      const gaps = app.querySelector('#f-gaps').value;
      const simplify = app.querySelector('#f-simplify').value;
      if (!topic.trim() && !explain.trim()) { alert('至少填「概念/主题」或「讲给别人听」'); return; }
      const id = editingId;
      editingId = null;
      if (id) {
        updateFeynmanEntry(id, {topic, subject, chapter, explain, gaps, simplify});
        if (subjectFilter !== '全部' && subjectFilter !== subject) subjectFilter = subject;
      } else addFeynmanEntry({topic, subject, chapter, explain, gaps, simplify});
    };

    const cancelEditBtn = app.querySelector('#f-cancel-edit');
    if (cancelEditBtn) cancelEditBtn.onclick = () => cancelEdit();

    app.querySelectorAll('[data-filter]').forEach(el => { el.onclick = () => { subjectFilter = el.getAttribute('data-filter'); render(); }; });

    app.querySelectorAll('[data-toggle]').forEach(el => { el.onclick = () => toggleCard(el.getAttribute('data-toggle')); });
    app.querySelectorAll('[data-edit]').forEach(el => { el.onclick = (ev) => { ev.stopPropagation(); startEdit(el.getAttribute('data-edit')); }; });
    app.querySelectorAll('[data-del]').forEach(el => { el.onclick = (ev) => { ev.stopPropagation(); if (confirm('删除这张学习卡？讲解、卡壳、简化内容都会一并删除。')) deleteFeynmanEntry(el.getAttribute('data-del')); }; });
    app.querySelectorAll('[data-review]').forEach(el => { el.onclick = (ev) => { ev.stopPropagation(); reviewCard(el.getAttribute('data-review'), el.getAttribute('data-grade')); }; });
    app.querySelectorAll('[data-gap]').forEach(el => { el.onclick = () => toggleGapDone(el.getAttribute('data-gap')); });

    const hAdd = app.querySelector('#h-add');
    const hInput = app.querySelector('#h-name');
    if (hAdd) hAdd.onclick = () => { addHabit(hInput.value); hInput.value=''; };
    if (hInput) hInput.onkeydown = (ev) => { if (ev.key === 'Enter') { addHabit(hInput.value); hInput.value=''; } };

    app.querySelectorAll('[data-rmhabit]').forEach(el => { el.onclick = () => { if (confirm('删除这个习惯会一并清掉它的打卡记录，确定吗？')) removeHabit(el.getAttribute('data-rmhabit')); }; });
    app.querySelectorAll('[data-check]').forEach(el => { el.onclick = () => toggleCheck(el.getAttribute('data-check'), el.getAttribute('data-date')); });

    const prev = app.querySelector('#week-prev');
    if (prev) prev.onclick = () => { weekOffset -= 1; render(); };
    const next = app.querySelector('#week-next');
    if (next) next.onclick = () => { weekOffset += 1; render(); };
    const todayBtn = app.querySelector('#week-today');
    if (todayBtn) todayBtn.onclick = () => { weekOffset = 0; render(); };

    const addRowBtn = app.querySelector('#add-row-btn');
    if (addRowBtn) addRowBtn.onclick = () => addScheduleRow();

    app.querySelectorAll('[data-rmrow]').forEach(el => { el.onclick = () => removeScheduleRow(el.getAttribute('data-rmrow')); });
    app.querySelectorAll('[data-row-label]').forEach(el => {
      autoGrow(el);
      el.oninput = () => { updateScheduleLabel(el.getAttribute('data-row-label'), el.value); autoGrow(el); };
    });
    app.querySelectorAll('[data-cell-row]').forEach(el => {
      autoGrow(el);
      el.oninput = () => { updateScheduleCell(el.getAttribute('data-cell-row'), el.getAttribute('data-cell-day'), el.value); autoGrow(el); };
    });

    const exportBtn = app.querySelector('#export-data');
    if (exportBtn) exportBtn.onclick = () => exportData();
    const importBtn = app.querySelector('#import-data');
    const importFile = app.querySelector('#import-file');
    if (importBtn && importFile) {
      importBtn.onclick = () => importFile.click();
      importFile.onchange = () => importData(importFile);
    }

    const resetBtn = app.querySelector('#reset-all');
    if (resetBtn) resetBtn.onclick = async () => {
      if (!confirm('确定要清空所有学习卡片、习惯记录和计划表吗？这个操作无法撤销。')) return;
      feynmanEntries = []; habits = []; checks = {}; scheduleRows = []; scheduleCells = {};
      editingId = null; openCardId = null; subjectFilter = '全部'; weekOffset = 0; searchQuery = '';
      await saveFeynman(); await saveHabits(); await saveSchedule();
      render();
    };
    
    // 搜索框事件
    const searchInput = app.querySelector('#search-input');
    if (searchInput) {
      searchInput.oninput = () => {
        searchQuery = searchInput.value;
        render();
      };
    }
    
    // 备份管理器按钮
    const backupManagerBtn = app.querySelector('#backup-manager');
    if (backupManagerBtn) backupManagerBtn.onclick = () => showBackupManager();
    
    // 统计面板按钮
    const showStatsBtn = app.querySelector('#show-stats-btn');
    if (showStatsBtn) showStatsBtn.onclick = () => showStatsPanel();
    
    // 帮助按钮
    const showHelpBtn = app.querySelector('#show-help-btn');
    if (showHelpBtn) showHelpBtn.onclick = () => showHelpPanel();
    
    // 欢迎引导相关
    const dismissWelcomeBtn = app.querySelector('#dismiss-welcome');
    if (dismissWelcomeBtn) dismissWelcomeBtn.onclick = () => dismissWelcome();
    
    const showFullHelpBtn = app.querySelector('#show-full-help');
    if (showFullHelpBtn) showFullHelpBtn.onclick = () => { dismissWelcome(); showHelpPanel(); };
  }

  // 初始化键盘快捷键
  setupKeyboardShortcuts();
  
  
  // ========== 云端同步 UI 初始化（在 IIFE 内部，可访问所有变量）==========
  function initCloudSyncUI() {
    const syncBtn = document.getElementById('sync-settings-btn');
    const modal = document.getElementById('sync-settings-modal');
    const closeBtn = document.getElementById('close-sync-modal');
    const setupSection = document.getElementById('sync-setup');
    const activeSection = document.getElementById('sync-active');
    const passkeyInput = document.getElementById('cloud-passkey-input');
    const savePasskeyBtn = document.getElementById('save-passkey-btn');
    const manualSyncBtn = document.getElementById('manual-sync-btn');
    const disableSyncBtn = document.getElementById('disable-sync-btn');
    const lastSyncTimeEl = document.getElementById('last-sync-time');

    if (!syncBtn || !modal) return;

    function refreshUI() {
      if (cloudPasskey) {
        setupSection.style.display = 'none';
        activeSection.style.display = 'block';
        if (lastSyncTimeEl) {
          lastSyncTimeEl.textContent = lastSyncTime
            ? lastSyncTime.toLocaleString('zh-CN')
            : '未同步';
        }
      } else {
        setupSection.style.display = 'block';
        activeSection.style.display = 'none';
      }
    }

    syncBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      refreshUI();
      modal.style.display = 'flex';
    };

    if (closeBtn) {
      closeBtn.onclick = () => {
        modal.style.display = 'none';
        if (passkeyInput) passkeyInput.value = '';
      };
    }

    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
        if (passkeyInput) passkeyInput.value = '';
      }
    };

    if (savePasskeyBtn) {
      savePasskeyBtn.onclick = async () => {
        const key = passkeyInput ? passkeyInput.value.trim() : '';
        if (!key) { alert('请输入密钥'); return; }
        if (key.length < 6) { alert('密钥至少需要6个字符'); return; }

        savePasskey(key);
        try {
          await saveToCloud({
            cards: feynmanEntries,
            habits: habits,
            checks: checks,
            subjects: SUBJECTS,
            scheduleRows: scheduleRows,
            scheduleCells: scheduleCells
          });
          alert('云端同步已启用！数据已上传到云端。');
          refreshUI();
          if (passkeyInput) passkeyInput.value = '';
        } catch(e) {
          alert('同步失败：' + e.message);
          clearPasskey();
        }
      };
    }

    if (manualSyncBtn) {
      manualSyncBtn.onclick = async () => {
        try {
          await saveToCloud({
            cards: feynmanEntries,
            habits: habits,
            checks: checks,
            subjects: SUBJECTS,
            scheduleRows: scheduleRows,
            scheduleCells: scheduleCells
          });
          alert('同步成功！');
          refreshUI();
        } catch(e) {
          alert('同步失败：' + e.message);
        }
      };
    }

    if (disableSyncBtn) {
      disableSyncBtn.onclick = () => {
        if (confirm('确定要禁用云端同步吗？本地数据不会被删除，但将不再自动同步到云端。')) {
          clearPasskey();
          refreshUI();
          updateSyncStatus('', '');
          alert('云端同步已禁用');
        }
      };
    }

    refreshUI();
  }

  // 初始化键盘快捷键
  setupKeyboardShortcuts();
  loadData().then(() => initCloudSyncUI());
})();