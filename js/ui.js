/**
 * SPEND MANAGER - UI & MICRO-ANIMATIONS SERVICE
 * Quản lý các hiệu ứng chuyển động, Toast, Modals, CountUp Animation, Render danh sách & Quản lý danh mục
 */

class UiService {
  constructor() {
    this.currentList = [];
    this.activeTab = 'all';
    this.searchQuery = '';
    this.categoryFilter = 'all';
    this.activeCatTab = 'expense'; // Tab đang chọn trong Modal Quản lý danh mục
    this.selectedCatIcon = 'tag';
    this.selectedCatColor = '#6366F1';
    this.currentView = 'dashboard';
    this.historyViewMode = 'calendar';
    this.calendarMonth = new Date().getMonth();
    this.calendarYear = new Date().getFullYear();
    this.selectedCalendarDate = CONFIG.utils.getLocalDateString();
    this.audioCtx = null;
    this.initGlobalHapticFeedback();
  }

  /**
   * Hiệu ứng đếm số tiền mượt mà (CountUp Animation)
   */
  animateCountUp(element, startVal, endVal, duration = 800) {
    if (!element) return;
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const currentVal = Math.floor(easeProgress * (endVal - startVal) + startVal);
      
      element.textContent = this.formatCurrency(currentVal);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        element.textContent = this.formatCurrency(endVal);
      }
    };
    window.requestAnimationFrame(step);
  }

  formatCurrency(amount) {
    return Number(amount || 0).toLocaleString('vi-VN') + ' ₫';
  }

  formatDate(dateStr) {
    if (!dateStr) return '';
    const normDate = CONFIG.utils.normalizeDate(dateStr);
    const today = CONFIG.utils.getLocalDateString();
    const yesterdayDate = CONFIG.utils.getLocalDateString(new Date(Date.now() - 86400000));

    if (normDate === today) return 'Hôm nay';
    if (normDate === yesterdayDate) return 'Hôm qua';

    const parts = normDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return normDate;
  }

  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const id = 'toast_' + Date.now();
    const icons = {
      success: 'check-circle',
      error: 'alert-circle',
      info: 'info',
      warning: 'alert-triangle'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-slide-in`;
    toast.id = id;
    toast.innerHTML = `
      <div class="toast-icon"><i data-lucide="${icons[type] || 'bell'}"></i></div>
      <div class="toast-content">${message}</div>
      <button class="toast-close" onclick="document.getElementById('${id}').remove()"><i data-lucide="x"></i></button>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons({ root: toast });

    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('animate-slide-out');
        setTimeout(() => el.remove(), 300);
      }
    }, 4000);
  }

  triggerConfetti() {
    this.triggerHaptic('success');
    if (window.confetti) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#27AE60', '#4ECDC4', '#FF6B6B', '#F9A826']
      });
    }
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      
      const firstInput = modal.querySelector('input:not([type="radio"]):not([type="checkbox"]), select, textarea');
      if (firstInput) setTimeout(() => firstInput.focus(), 100);
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      // Chỉ khôi phục overflow nếu không còn modal nào active
      const activeModals = document.querySelectorAll('.modal-overlay.active');
      if (activeModals.length === 0) {
        document.body.style.overflow = '';
      }
    }
  }

  updateOverviewCards(transactions, budget) {
    let totalIncome = 0;
    let totalExpense = 0;
    let allTimeIncome = 0;
    let allTimeExpense = 0;

    const currentMonth = CONFIG.utils.getLocalMonthString();
    transactions.forEach(tx => {
      const txDate = CONFIG.utils.normalizeDate(tx.date);
      const amount = Number(tx.amount) || 0;

      // Cộng dồn tích lũy trọn đời cho Tổng số dư
      if (tx.type === 'income') {
        allTimeIncome += amount;
      } else {
        allTimeExpense += amount;
      }

      // Cộng dồn riêng cho tháng hiện tại
      if (txDate && txDate.startsWith(currentMonth)) {
        if (tx.type === 'income') totalIncome += amount;
        else totalExpense += amount;
      }
    });

    const balance = allTimeIncome - allTimeExpense;

    const balanceEl = document.getElementById('statBalance');
    const incomeEl = document.getElementById('statIncome');
    const expenseEl = document.getElementById('statExpense');

    const oldBalance = balanceEl ? Number(balanceEl.getAttribute('data-val')) || 0 : 0;
    const oldIncome = incomeEl ? Number(incomeEl.getAttribute('data-val')) || 0 : 0;
    const oldExpense = expenseEl ? Number(expenseEl.getAttribute('data-val')) || 0 : 0;

    if (balanceEl) {
      this.animateCountUp(balanceEl, oldBalance, balance);
      balanceEl.setAttribute('data-val', balance);
      balanceEl.className = `stat-value ${balance >= 0 ? 'text-success' : 'text-danger'}`;
    }
    if (incomeEl) {
      this.animateCountUp(incomeEl, oldIncome, totalIncome);
      incomeEl.setAttribute('data-val', totalIncome);
    }
    if (expenseEl) {
      this.animateCountUp(expenseEl, oldExpense, totalExpense);
      expenseEl.setAttribute('data-val', totalExpense);
    }

    this.updateBudgetProgress(totalExpense, budget);
  }

  updateBudgetProgress(totalExpense, budget) {
    const progressBar = document.getElementById('budgetProgressBar');
    const percentEl = document.getElementById('budgetPercent');
    const remainEl = document.getElementById('budgetRemain');

    if (!progressBar || !percentEl || !remainEl) return;

    const percent = budget > 0 ? Math.min(Math.round((totalExpense / budget) * 100), 100) : 0;
    const remain = Math.max(budget - totalExpense, 0);

    progressBar.style.width = `${percent}%`;
    percentEl.textContent = `${percent}%`;
    remainEl.textContent = `Còn lại: ${this.formatCurrency(remain)}`;

    progressBar.className = 'progress-bar-fill';
    if (percent >= 90) {
      progressBar.classList.add('bg-danger');
      if (percent >= 100) {
        remainEl.textContent = `Vượt ngân sách: ${this.formatCurrency(totalExpense - budget)}`;
        remainEl.classList.add('text-danger');
      }
    } else if (percent >= 75) {
      progressBar.classList.add('bg-warning');
      remainEl.classList.remove('text-danger');
    } else {
      progressBar.classList.add('bg-success');
      remainEl.classList.remove('text-danger');
    }
  }

  /**
   * Render danh sách giao dịch
   */
  renderTransactionList(transactions = [], onDeleteCallback = null) {
    this.currentList = transactions;
    const container = document.getElementById('transactionListContainer');
    const emptyState = document.getElementById('emptyStateContainer');
    if (!container) return;

    let filtered = transactions;
    if (this.activeTab !== 'all') {
      filtered = filtered.filter(tx => tx.type === this.activeTab);
    }

    if (this.categoryFilter !== 'all') {
      filtered = filtered.filter(tx => tx.category === this.categoryFilter);
    }

    const allCats = apiService.getCategories();

    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(tx => {
        const catName = (allCats[tx.category] ? allCats[tx.category].name : '').toLowerCase();
        const note = (tx.note || '').toLowerCase();
        const amountStr = String(tx.amount);
        return catName.includes(q) || note.includes(q) || amountStr.includes(q);
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    container.innerHTML = '';

    filtered.forEach((tx, index) => {
      const card = this.createTxCardElement(tx, index, allCats, onDeleteCallback);
      container.appendChild(card);
    });

    if (window.lucide) lucide.createIcons({ root: container });
  }

  createTxCardElement(tx, index, allCats, onDeleteCallback) {
    const catInfo = allCats[tx.category] || {
      name: 'Khác',
      icon: 'tag',
      color: '#828282',
      bgColor: 'rgba(130, 130, 130, 0.15)'
    };

    const isExpense = tx.type === 'expense';
    const amountPrefix = isExpense ? '-' : '+';
    const amountClass = isExpense ? 'tx-amount-expense' : 'tx-amount-income';

    const card = document.createElement('div');
    card.className = 'tx-card animate-fade-in';
    card.style.animationDelay = `${Math.min(index * 40, 400)}ms`;
    card.innerHTML = `
      <div class="tx-icon-wrapper" style="background-color: ${catInfo.bgColor}; color: ${catInfo.color};">
        <i data-lucide="${catInfo.icon || 'tag'}"></i>
      </div>
      <div class="tx-details">
        <div class="tx-title">
          <span class="tx-category-name">${catInfo.name}</span>
          <span class="tx-date">${this.formatDate(tx.date)}</span>
        </div>
        ${tx.note ? `<div class="tx-note">${tx.note}</div>` : ''}
      </div>
      <div class="tx-right">
        <div class="${amountClass}">${amountPrefix}${this.formatCurrency(tx.amount)}</div>
        <button class="tx-delete-btn" title="Xóa giao dịch" data-id="${tx.id}">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;

    const deleteBtn = card.querySelector('.tx-delete-btn');
    if (deleteBtn && onDeleteCallback) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onDeleteCallback(tx.id, card);
      });
    }

    return card;
  }

  updateConnectionStatus(status = 'online', message = 'Google Sheet Đã Kết Nối') {
    const badge = document.getElementById('connectionStatusBadge');
    if (!badge) return;

    badge.className = 'connection-badge ' + (status === 'online' ? 'badge-online' : status === 'demo' ? 'badge-demo' : 'badge-offline');
    badge.innerHTML = `
      <span class="status-dot"></span>
      <span class="status-text">${message}</span>
    `;
  }

  // =========================================================================
  // --- QUẢN LÝ DANH MỤC (CATEGORY MANAGEMENT UI) ---
  // =========================================================================

  /**
   * Render danh sách danh mục trong Modal Quản lý
   */
  renderCategoryManagerList(onEditCallback, onDeleteCallback) {
    const container = document.getElementById('categoryListContainer');
    if (!container) return;

    const allCats = apiService.getCategories();
    const filteredCats = Object.values(allCats).filter(cat => cat.type === this.activeCatTab);

    container.innerHTML = '';
    
    if (filteredCats.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-muted);">Chưa có danh mục nào</div>`;
      return;
    }

    filteredCats.forEach((cat, idx) => {
      const item = document.createElement('div');
      item.className = 'cat-list-item animate-fade-in';
      item.style.animationDelay = `${idx * 30}ms`;
      item.innerHTML = `
        <div class="cat-list-left">
          <div class="cat-icon-badge" style="background-color: ${cat.bgColor}; color: ${cat.color};">
            <i data-lucide="${cat.icon || 'tag'}"></i>
          </div>
          <span class="cat-list-name">${cat.name}</span>
        </div>
        <div class="cat-list-actions">
          <button class="cat-action-btn cat-edit-btn" title="Sửa danh mục" data-id="${cat.id}">
            <i data-lucide="edit-2"></i>
          </button>
          <button class="cat-action-btn cat-delete-btn" title="Xóa danh mục" data-id="${cat.id}">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;

      item.querySelector('.cat-edit-btn')?.addEventListener('click', () => onEditCallback(cat));
      item.querySelector('.cat-delete-btn')?.addEventListener('click', () => onDeleteCallback(cat.id));

      container.appendChild(item);
    });

    if (window.lucide) lucide.createIcons({ root: container });
  }

  /**
   * Render bộ chọn Icon (Icon Picker Grid)
   */
  
  renderIconPicker(onSelectCallback) {
    const container = document.getElementById('iconPickerGrid');
    if (!container) return;

    // Thay đổi class của container để áp dụng layout mới
    container.className = 'icon-picker-container';

    // Dữ liệu icon đã được phân nhóm giống hình ảnh
    const iconGroups = [
      { label: 'Ăn uống', icons: ['utensils', 'utensils-crossed', 'pizza', 'coffee', 'cup-soda', 'wine', 'beer', 'glass-water', 'cake', 'chef-hat'] },
      { label: 'Giao thông & Giao hàng', icons: ['car', 'bus', 'truck', 'bike', 'train-front', 'plane', 'ship', 'navigation', 'map-pin', 'fuel'] },
      { label: 'Mua sắm', icons: ['shopping-cart', 'shopping-bag', 'tag', 'tags', 'gift', 'store', 'credit-card', 'smartphone', 'watch'] },
      { label: 'Kinh doanh & Con người', icons: ['user', 'users', 'briefcase', 'pie-chart', 'bar-chart-2', 'building', 'handshake', 'contact', 'globe'] },
      { label: 'Tài chính & Tiền bạc', icons: ['dollar-sign', 'coins', 'wallet', 'piggy-bank', 'banknote', 'landmark', 'receipt', 'percent', 'trending-up'] },
      { label: 'Lịch & Giáo dục', icons: ['calendar', 'graduation-cap', 'book-open', 'book', 'lightbulb', 'school', 'pen-tool', 'clipboard', 'award'] },
      { label: 'Nhà cửa & Sinh hoạt', icons: ['home', 'sofa', 'tv', 'lamp', 'armchair', 'router', 'bath', 'key', 'wifi'] },
      { label: 'Sức khỏe & Thể dục', icons: ['heart', 'activity', 'stethoscope', 'dumbbell', 'cross', 'pill', 'syringe', 'thermometer', 'smile'] },
      { label: 'Du lịch & Giải trí', icons: ['luggage', 'ticket', 'compass', 'map', 'camera', 'palmtree', 'tent', 'gamepad-2', 'music', 'video', 'headphones'] }
    ];

    container.innerHTML = '';

    iconGroups.forEach(group => {
      // 1. Tạo tiêu đề cho từng nhóm (Ví dụ: "Ăn uống")
      const title = document.createElement('div');
      title.className = 'icon-category-title';
      title.textContent = group.label;
      container.appendChild(title);

      // 2. Tạo lưới chứa icon của nhóm đó
      const grid = document.createElement('div');
      grid.className = 'icon-picker-grid-inner';

      group.icons.forEach(iconName => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'icon-picker-item ' + (iconName === this.selectedCatIcon ? 'active' : '');
        btn.innerHTML = `<i data-lucide="${iconName}"></i>`;
        btn.title = iconName;

        btn.addEventListener('click', () => {
          container.querySelectorAll('.icon-picker-item').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.selectedCatIcon = iconName;
          if (onSelectCallback) onSelectCallback(iconName);
        });

        grid.appendChild(btn);
      });

      container.appendChild(grid);
    });

    if (window.lucide) lucide.createIcons({ root: container });
  }

  /**
   * Render bộ chọn Màu sắc (Color Presets Grid)
   */
  renderColorPicker(onSelectCallback) {
    const container = document.getElementById('colorPickerGrid');
    if (!container) return;

    const curatedColors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#F9A826', '#9B51E0', '#EB5757',
      '#2D9CDB', '#27AE60', '#F2994A', '#2F80ED', '#6FCF97', '#6366F1',
      '#EC4899', '#14B8A6', '#8B5CF6', '#F59E0B', '#10B981', '#3B82F6'
    ];

    container.innerHTML = '';
    curatedColors.forEach(hexColor => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-picker-item ' + (hexColor.toLowerCase() === this.selectedCatColor.toLowerCase() ? 'active' : '');
      btn.style.backgroundColor = hexColor;
      btn.title = hexColor;

      btn.addEventListener('click', () => {
        container.querySelectorAll('.color-picker-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedCatColor = hexColor;
        // Đồng bộ vào input màu tùy biến nếu có
        const colorInput = document.getElementById('catColorInput');
        if (colorInput) colorInput.value = hexColor;

        if (onSelectCallback) onSelectCallback(hexColor);
      });

      container.appendChild(btn);
    });
  }

  /**
   * Render các gợi ý số tiền thông minh theo đầu vào người dùng
   */
  renderAmountSuggestions(inputVal, onSelectCallback) {
    const container = document.getElementById('amountSuggestions');
    if (!container) return;

    let numStr = String(inputVal || '').replace(/\D/g, '');
    let numVal = Number(numStr);
    let candidates = [];

    if (!numStr || numVal === 0) {
      // Mặc định khi chưa nhập gì: 20k, 35k, 50k, 100k, 200k, 500k
      candidates = [20000, 35000, 50000, 100000, 200000, 500000];
    } else {
      // Khi đã nhập một số (ví dụ: 1, 5, 25, 15, 120...)
      // Tạo các gợi ý nhân với 10^3, 10^4, 10^5, 10^6, 10^7
      const multipliers = [1000, 10000, 100000, 1000000, 10000000];
      const seen = new Set();
      
      if (numVal >= 1000 && numVal <= 500000000) {
        candidates.push(numVal);
        seen.add(numVal);
      }

      multipliers.forEach(m => {
        const val = numVal * m;
        if (val >= 1000 && val <= 500000000 && !seen.has(val)) {
          candidates.push(val);
          seen.add(val);
        }
      });
      
      candidates = candidates.slice(0, 6);
    }

    container.innerHTML = '';
    candidates.forEach(amount => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'amount-sug-chip animate-fade-in';
      chip.setAttribute('data-val', amount);
      
      const word = this.formatCurrencyWord(amount);
      const numFormatted = this.formatCurrency(amount);

      chip.innerHTML = `
        <span class="sug-word">${word}</span>
        <span class="sug-num">${numFormatted}</span>
      `;

      chip.addEventListener('click', () => {
        if (onSelectCallback) onSelectCallback(amount);
      });

      container.appendChild(chip);
    });
  }

  formatCurrencyWord(amount) {
    if (amount >= 1000000000) {
      return (amount / 1000000000).toLocaleString('vi-VN') + ' tỷ';
    }
    if (amount >= 1000000) {
      return (amount / 1000000).toLocaleString('vi-VN') + ' triệu';
    }
    if (amount >= 1000) {
      return (amount / 1000).toLocaleString('vi-VN') + ' nghìn';
    }
    return amount + ' ₫';
  }

  formatCompactNumber(num) {
    if (!num || num === 0) return '0';
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1).replace('.0', '') + 'B';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
    }
    if (num >= 1000) {
      return Math.round(num / 1000) + 'k';
    }
    return String(num);
  }

  /**
   * Render chế độ Lịch (Calendar View)
   */
  renderCalendarView(transactions, onSelectDateCallback) {
    const gridContainer = document.getElementById('calendarDaysGrid');
    const titleEl = document.getElementById('calendarMonthTitle');
    const incomeEl = document.getElementById('calMonthIncome');
    const expenseEl = document.getElementById('calMonthExpense');
    const balanceEl = document.getElementById('calMonthBalance');
    if (!gridContainer) return;

    if (titleEl) {
      titleEl.textContent = `Tháng ${this.calendarMonth + 1}, ${this.calendarYear}`;
    }

    let monthInc = 0, monthExp = 0;
    transactions.forEach(tx => {
      const [y, m] = tx.date.split('-');
      if (Number(y) === this.calendarYear && Number(m) === (this.calendarMonth + 1)) {
        if (tx.type === 'income') monthInc += Number(tx.amount || 0);
        else monthExp += Number(tx.amount || 0);
      }
    });

    if (incomeEl) incomeEl.textContent = '+' + this.formatCurrency(monthInc);
    if (expenseEl) expenseEl.textContent = '-' + this.formatCurrency(monthExp);
    if (balanceEl) {
      const bal = monthInc - monthExp;
      balanceEl.textContent = (bal >= 0 ? '+' : '') + this.formatCurrency(bal);
      balanceEl.className = bal >= 0 ? 'text-primary' : 'text-danger';
    }

    const firstDay = new Date(this.calendarYear, this.calendarMonth, 1).getDay();
    const startOffset = (firstDay === 0) ? 6 : (firstDay - 1);
    const daysInMonth = new Date(this.calendarYear, this.calendarMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(this.calendarYear, this.calendarMonth, 0).getDate();

    const allCats = apiService.getCategories();
    const todayStr = CONFIG.utils.getLocalDateString();

    gridContainer.innerHTML = '';

    for (let i = 0; i < 42; i++) {
      let dayNum, cellMonth, cellYear, isOtherMonth = false;
      if (i < startOffset) {
        dayNum = daysInPrevMonth - startOffset + 1 + i;
        cellMonth = this.calendarMonth - 1;
        cellYear = this.calendarYear;
        if (cellMonth < 0) { cellMonth = 11; cellYear--; }
        isOtherMonth = true;
      } else if (i < startOffset + daysInMonth) {
        dayNum = i - startOffset + 1;
        cellMonth = this.calendarMonth;
        cellYear = this.calendarYear;
      } else {
        dayNum = i - startOffset - daysInMonth + 1;
        cellMonth = this.calendarMonth + 1;
        cellYear = this.calendarYear;
        if (cellMonth > 11) { cellMonth = 0; cellYear++; }
        isOtherMonth = true;
      }

      const dateStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayTxs = transactions.filter(tx => tx.date === dateStr);
      
      let dayInc = 0, dayExp = 0;
      const catColors = new Set();
      dayTxs.forEach(tx => {
        if (tx.type === 'income') dayInc += Number(tx.amount || 0);
        else dayExp += Number(tx.amount || 0);
        const cat = allCats[tx.category];
        if (cat && cat.color) catColors.add(cat.color);
      });

      const isToday = (dateStr === todayStr);
      const isActive = (dateStr === this.selectedCalendarDate);

      const cell = document.createElement('div');
      cell.className = `cal-day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isActive ? 'active' : ''}`;
      cell.setAttribute('data-date', dateStr);

      let badgesHtml = '';
      Array.from(catColors).slice(0, 4).forEach(color => {
        badgesHtml += `<span class="cal-cat-dot" style="background-color: ${color}"></span>`;
      });

      let statsHtml = '';
      if (dayInc > 0) statsHtml += `<div class="cal-stat-inc">+${this.formatCompactNumber(dayInc)}</div>`;
      if (dayExp > 0) statsHtml += `<div class="cal-stat-exp">-${this.formatCompactNumber(dayExp)}</div>`;

      cell.innerHTML = `
        <div class="cal-day-top">
          <span class="cal-day-num">${dayNum}</span>
          <div class="cal-day-badges">${badgesHtml}</div>
        </div>
        <div class="cal-day-stats">${statsHtml}</div>
      `;

      cell.addEventListener('click', () => {
        this.selectedCalendarDate = dateStr;
        document.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('active'));
        cell.classList.add('active');
        if (onSelectDateCallback) onSelectDateCallback(dateStr);
      });

      gridContainer.appendChild(cell);
    }
  }

  /**
   * Render danh sách giao dịch cho Ngày được chọn trong Lịch
   */
  renderSelectedDayTransactions(dateStr, transactions, onDeleteCallback) {
    const listContainer = document.getElementById('selectedDayTxList');
    const titleEl = document.getElementById('selectedDayTitle');
    const summaryEl = document.getElementById('selectedDaySummary');
    if (!listContainer) return;

    const [y, m, d] = (dateStr || CONFIG.utils.getLocalDateString()).split('-');
    const dateObj = new Date(y, m - 1, d);
    const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = weekdays[dateObj.getDay()];

    if (titleEl) titleEl.textContent = `${dayName}, ngày ${d}/${m}/${y}`;

    const dayTxs = transactions.filter(tx => tx.date === dateStr);
    if (summaryEl) summaryEl.textContent = `${dayTxs.length} giao dịch`;

    listContainer.innerHTML = '';
    if (dayTxs.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); background: rgba(0,0,0,0.15); border-radius: var(--radius-md); border: 1px dashed var(--glass-border);">
          <i data-lucide="calendar-check-2" style="width: 36px; height: 36px; margin-bottom: 0.5rem; opacity: 0.6; color: var(--accent-color);"></i>
          <p style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">Không có giao dịch nào trong ngày này</p>
          <p style="font-size: 0.85rem;">Bạn đã có một ngày quản lý chi tiêu tuyệt vời!</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons({ root: listContainer });
      return;
    }

    const allCats = apiService.getCategories();
    dayTxs.forEach((tx, idx) => {
      const card = this.createTxCardElement(tx, idx, allCats, onDeleteCallback);
      listContainer.appendChild(card);
    });

    if (window.lucide) lucide.createIcons({ root: listContainer });
  }

  /**
   * Render chế độ Dòng thời gian (Timeline View)
   */
  renderTimelineView(transactions, onDeleteCallback) {
    const container = document.getElementById('timelineListContainer');
    if (!container) return;

    const monthTxs = transactions.filter(tx => {
      const [y, m] = tx.date.split('-');
      return Number(y) === this.calendarYear && Number(m) === (this.calendarMonth + 1);
    });

    container.innerHTML = '';
    if (monthTxs.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i data-lucide="inbox" style="width: 48px; height: 48px; margin-bottom: 0.75rem; opacity: 0.5;"></i>
          <p style="font-size: 1.1rem; font-weight: 600;">Chưa có giao dịch nào trong Tháng ${this.calendarMonth + 1}/${this.calendarYear}</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons({ root: container });
      return;
    }

    const groups = {};
    monthTxs.forEach(tx => {
      if (!groups[tx.date]) groups[tx.date] = [];
      groups[tx.date].push(tx);
    });

    const sortedDates = Object.keys(groups).sort().reverse();
    const allCats = apiService.getCategories();
    const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

    sortedDates.forEach((dateStr, idx) => {
      const [y, m, d] = dateStr.split('-');
      const dateObj = new Date(y, m - 1, d);
      const dayName = weekdays[dateObj.getDay()];

      let dayInc = 0, dayExp = 0;
      groups[dateStr].forEach(tx => {
        if (tx.type === 'income') dayInc += Number(tx.amount || 0);
        else dayExp += Number(tx.amount || 0);
      });

      const groupEl = document.createElement('div');
      groupEl.className = 'timeline-group animate-fade-in';
      groupEl.style.animationDelay = `${idx * 40}ms`;

      let statsText = '';
      if (dayInc > 0) statsText += `<span class="text-success">+${this.formatCurrency(dayInc)}</span>`;
      if (dayExp > 0) {
        if (statsText) statsText += ' | ';
        statsText += `<span class="text-danger">-${this.formatCurrency(dayExp)}</span>`;
      }

      groupEl.innerHTML = `
        <div class="timeline-date-header">
          <span>${dayName}, ${d}/${m}/${y}</span>
          <div class="timeline-date-stats">${statsText}</div>
        </div>
        <div class="timeline-cards-list"></div>
      `;

      const cardsList = groupEl.querySelector('.timeline-cards-list');
      groups[dateStr].forEach((tx, cIdx) => {
        const card = this.createTxCardElement(tx, cIdx, allCats, onDeleteCallback);
        cardsList.appendChild(card);
      });

      container.appendChild(groupEl);
    });

    if (window.lucide) lucide.createIcons({ root: container });
  }

  /**
   * Kích hoạt hiệu ứng Haptic Feedback (Rung vật lý & Âm thanh click kiểu iOS)
   * @param {string} type - 'light' | 'medium' | 'heavy' | 'success' | 'warning'
   */
  triggerHaptic(type = 'light') {
    if ('vibrate' in navigator) {
      try {
        switch (type) {
          case 'light':
            navigator.vibrate(8);
            break;
          case 'medium':
            navigator.vibrate(15);
            break;
          case 'heavy':
            navigator.vibrate([12, 40, 12]);
            break;
          case 'success':
            navigator.vibrate([15, 50, 15, 50, 25]);
            break;
          case 'warning':
            navigator.vibrate([20, 40, 20]);
            break;
          default:
            navigator.vibrate(10);
        }
      } catch (e) {
        // Bỏ qua nếu trình duyệt chặn
      }
    }

    this.playIosClickSound(type);
  }

  /**
   * Tạo âm thanh haptic tick siêu nhẹ giống tiếng click trên iPhone (Web Audio API)
   */
  playIosClickSound(type = 'light') {
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.audioCtx = new AudioContext();
        }
      }

      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;

      if (type === 'light') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.008);
        
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);
        
        osc.start(now);
        osc.stop(now + 0.008);
      } else if (type === 'medium' || type === 'heavy') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.012);
        
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
        
        osc.start(now);
        osc.stop(now + 0.012);
      } else if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.05);
        
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'warning') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.02);
        
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
        
        osc.start(now);
        osc.stop(now + 0.02);
      }
    } catch (e) {
      // Bỏ qua lỗi audio nếu thiết bị không hỗ trợ
    }
  }

  /**
   * Khởi tạo bộ lắng nghe toàn cục cho hiệu ứng Haptic khi bấm nút
   */
  initGlobalHapticFeedback() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('button, .radio-card, .filter-tab-btn, .cal-day-cell, .page-nav-btn, .cat-item, .amount-sug-chip, .icon-btn');
      if (!target) return;

      if (target.classList.contains('btn-primary') || target.id === 'btnSubmitTransaction') {
        this.triggerHaptic('medium');
      } else if (target.classList.contains('tx-delete-btn')) {
        this.triggerHaptic('warning');
      } else {
        this.triggerHaptic('light');
      }
    }, { passive: true });
  }
}

window.uiService = new UiService();
