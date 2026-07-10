/**
 * SPEND MANAGER - MAIN APPLICATION CONTROLLER
 * Điều phối toàn bộ hoạt động của website: kết nối UI, API, Charts và xử lý sự kiện
 */

class AppController {
  constructor() {
    this.transactions = [];
    this.currentChartType = 'expense';
    this.editingCategoryId = null; // ID danh mục đang chỉnh sửa (null nếu thêm mới)
  }

  async init() {
    console.log('🚀 SpendManager đang khởi động...');
    
    // 1. Cài đặt giao diện chủ đề (Light/Dark Mode) từ Cache
    this.initTheme();

    // 2. Nạp dữ liệu cấu hình ban đầu vào UI
    this.initSettingsUI();

    // 3. Khởi tạo các bộ lọc danh mục trong các Modal và Thanh công cụ
    this.populateCategorySelects();

    // 4. Lắng nghe toàn bộ sự kiện người dùng
    this.bindEvents();

    // 5. Tải dữ liệu giao dịch (Lập tức từ Cache + Ngầm từ Google Sheet)
    await this.loadData();

    // 6. Kích hoạt Lucide Icons
    if (window.lucide) lucide.createIcons();
    
    console.log('✅ SpendManager khởi tạo hoàn tất!');
  }

  initTheme() {
    const savedTheme = apiService.getTheme();
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);
  }

  updateThemeIcon(theme) {
    const themeBtn = document.getElementById('themeToggleBtn');
    if (!themeBtn) return;
    const iconName = theme === 'dark' ? 'sun' : 'moon';
    themeBtn.innerHTML = `<i data-lucide="${iconName}"></i>`;
    if (window.lucide) lucide.createIcons({ root: themeBtn });
  }

  initSettingsUI() {
    const userName = apiService.getUserName();
    const budget = apiService.getBudget();
    const isDemo = apiService.isDemoMode();

    const greetingEl = document.getElementById('userGreetingName');
    if (greetingEl) greetingEl.textContent = userName;

    const inputName = document.getElementById('settingUserName');
    if (inputName) inputName.value = userName;

    const inputBudget = document.getElementById('settingBudget');
    if (inputBudget) inputBudget.value = budget;

    const toggleDemo = document.getElementById('settingDemoMode');
    if (toggleDemo) toggleDemo.checked = isDemo;

    if (isDemo) {
      uiService.updateConnectionStatus('demo', 'Chế độ Demo (Offline)');
    } else {
      uiService.updateConnectionStatus('online', 'Google Sheet Đã Kết Nối');
    }
  }

  /**
   * Tạo các lựa chọn danh mục trong thẻ Select và Filter Bar
   */
  populateCategorySelects() {
    const modalSelect = document.getElementById('txCategory');
    const filterSelect = document.getElementById('categoryFilterSelect');
    if (!modalSelect) return;

    modalSelect.innerHTML = '';
    if (filterSelect) {
      filterSelect.innerHTML = '<option value="all">Tất cả danh mục</option>';
    }

    const allCats = apiService.getCategories();
    const categories = Object.values(allCats);
    
    const expenseGroup = document.createElement('optgroup');
    expenseGroup.label = '— Chi tiêu —';
    const incomeGroup = document.createElement('optgroup');
    incomeGroup.label = '— Thu nhập —';

    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = `${cat.name}`;
      option.setAttribute('data-type', cat.type);

      if (cat.type === 'expense') {
        expenseGroup.appendChild(option);
      } else {
        incomeGroup.appendChild(option);
      }

      if (filterSelect) {
        const filterOpt = option.cloneNode(true);
        filterSelect.appendChild(filterOpt);
      }
    });

    modalSelect.appendChild(expenseGroup);
    modalSelect.appendChild(incomeGroup);
  }

  async loadData() {
    try {
      const isDemo = apiService.isDemoMode();

      // 1. Đồng bộ danh mục từ Google Sheet TRƯỚC (chỉ khi không phải Demo)
      if (!isDemo) {
        try {
          console.log('⏳ Đang đồng bộ danh mục từ Google Sheet...');
          await apiService.syncCategories();
          console.log('✅ Hoàn tất đồng bộ danh mục.');
        } catch (catErr) {
          console.warn('⚠️ Lỗi đồng bộ danh mục:', catErr);
        }
      }

      // Đảm bảo cập nhật danh mục vào select trước khi load dữ liệu và vẽ dashboard
      this.populateCategorySelects();

      // 2. Tải giao dịch từ Local Cache và bắt đầu đồng bộ ngầm
      const { transactions, status } = await apiService.getTransactions((remoteTx) => {
        console.log('🔄 Đã đồng bộ dữ liệu mới từ Google Sheet:', remoteTx.length, 'giao dịch');
        this.transactions = remoteTx;
        
        // Đồng bộ lại danh mục nếu có cập nhật mới ngầm
        if (!isDemo) {
          apiService.syncCategories().then(() => {
            this.populateCategorySelects();
            this.updateDashboard();
          });
        } else {
          this.updateDashboard();
        }
        uiService.showToast('Đã cập nhật dữ liệu mới nhất từ Google Sheets', 'info');
      });

      this.transactions = transactions || [];
      this.updateDashboard();

      if (status === 'demo') {
        uiService.showToast('Đang trải nghiệm chế độ Demo Mode với dữ liệu mẫu', 'info');
      }
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu:', error);
      uiService.showToast('Có lỗi xảy ra khi tải dữ liệu chi tiêu', 'error');
    }
  }

  updateDashboard() {
    const budget = apiService.getBudget();
    uiService.updateOverviewCards(this.transactions, budget);
    chartService.updateChartsTheme(this.transactions, this.currentChartType);
    uiService.renderTransactionList(this.transactions, (id, cardEl) => {
      this.handleDeleteTransaction(id, cardEl);
    });
    this.updateHistoryView();
  }

  switchPage(page) {
    uiService.currentView = page;
    document.querySelectorAll('.page-nav-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-page') === page);
    });
    
    const dashboardView = document.getElementById('dashboardPageView');
    const historyView = document.getElementById('historyPageView');
    const navActions = document.getElementById('pageNavActions');

    if (page === 'dashboard') {
      if (dashboardView) dashboardView.style.display = 'block';
      if (historyView) historyView.style.display = 'none';
      if (navActions) navActions.style.display = 'none';
      this.updateDashboard();
    } else {
      if (dashboardView) dashboardView.style.display = 'none';
      if (historyView) historyView.style.display = 'block';
      if (navActions) navActions.style.display = 'flex';
      this.updateHistoryView();
    }
  }

  updateHistoryView() {
    if (uiService.currentView !== 'history') return;

    if (uiService.historyViewMode === 'calendar') {
      document.getElementById('calendarGridViewSection').style.display = 'block';
      document.getElementById('timelineListViewSection').style.display = 'none';
      document.getElementById('selectedDayPanel').style.display = 'block';

      uiService.renderCalendarView(this.transactions, (dateStr) => {
        uiService.renderSelectedDayTransactions(dateStr, this.transactions, (id, card) => this.handleDeleteTransaction(id, card));
      });
      
      uiService.renderSelectedDayTransactions(
        uiService.selectedCalendarDate,
        this.transactions,
        (id, card) => this.handleDeleteTransaction(id, card)
      );
    } else {
      document.getElementById('calendarGridViewSection').style.display = 'none';
      document.getElementById('timelineListViewSection').style.display = 'block';
      document.getElementById('selectedDayPanel').style.display = 'none';

      uiService.renderTimelineView(this.transactions, (id, card) => this.handleDeleteTransaction(id, card));
    }
  }

  async handleAddTransaction(formData) {
    const btnSubmit = document.getElementById('btnSubmitTransaction');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span class="spinner"></span> Đang lưu...';
    }

    try {
      const newTx = {
        date: formData.get('date'),
        type: formData.get('type'),
        category: formData.get('category'),
        amount: Number(formData.get('amount')),
        note: formData.get('note') || ''
      };

      const res = await apiService.addTransaction(newTx);
      
      if (res && res.status === 'success') {
        this.transactions.unshift(res.transaction);
        this.updateDashboard();

        uiService.closeModal('addTransactionModal');
        document.getElementById('transactionForm').reset();
        document.getElementById('txDate').value = CONFIG.utils.getLocalDateString();

        uiService.showToast('🎉 Đã thêm khoản ' + (newTx.type === 'income' ? 'thu nhập' : 'chi tiêu') + ' mới!', 'success');
        
        if (newTx.type === 'income' || (newTx.type === 'expense' && newTx.amount < 50000)) {
          uiService.triggerConfetti();
        }
      }
    } catch (error) {
      console.error('Lỗi lưu giao dịch:', error);
      uiService.showToast('Không thể lưu giao dịch. Vui lòng kiểm tra lại!', 'error');
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i data-lucide="check"></i> Lưu Giao Dịch';
        if (window.lucide) lucide.createIcons({ root: btnSubmit });
      }
    }
  }

  async handleDeleteTransaction(id, cardEl) {
    if (!confirm('Bạn có chắc chắn muốn xóa giao dịch này không?')) return;

    if (cardEl) {
      cardEl.style.transform = 'translateX(100px)';
      cardEl.style.opacity = '0';
      cardEl.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    }

    setTimeout(async () => {
      const res = await apiService.deleteTransaction(id);
      if (res && res.status === 'success') {
        this.transactions = this.transactions.filter(tx => String(tx.id) !== String(id));
        this.updateDashboard();
        uiService.showToast('Đã xóa giao dịch thành công', 'info');
      } else {
        uiService.showToast('Lỗi khi xóa giao dịch', 'error');
        this.updateDashboard();
      }
    }, 300);
  }

  handleSelectSuggestedAmount(val) {
    const inputEl = document.getElementById('txAmount');
    if (inputEl) {
      inputEl.value = val;
      inputEl.style.transform = 'scale(1.03)';
      inputEl.style.borderColor = 'var(--success-color)';
      setTimeout(() => {
        inputEl.style.transform = 'scale(1)';
        inputEl.style.borderColor = '';
      }, 200);
    }
  }

  // =========================================================================
  // --- QUẢN LÝ DANH MỤC (CATEGORY MANAGEMENT HANDLERS) ---
  // =========================================================================

  openCategoryModal() {
    this.showCategoryListView();
    uiService.openModal('categoryModal');
  }

  showCategoryListView() {
    document.getElementById('categoryListView').style.display = 'block';
    document.getElementById('categoryFormView').style.display = 'none';
    
    uiService.renderCategoryManagerList(
      (cat) => this.showCategoryFormView(cat), // On Edit
      (id) => this.handleDeleteCategory(id)    // On Delete
    );
  }

  showCategoryFormView(categoryToEdit = null) {
    document.getElementById('categoryListView').style.display = 'none';
    document.getElementById('categoryFormView').style.display = 'block';

    const titleEl = document.getElementById('categoryFormTitle');
    const nameInput = document.getElementById('catNameInput');
    const typeExpenseRadio = document.getElementById('catTypeExpense');
    const typeIncomeRadio = document.getElementById('catTypeIncome');
    const colorInput = document.getElementById('catColorInput');

    if (categoryToEdit) {
      this.editingCategoryId = categoryToEdit.id;
      if (titleEl) titleEl.innerHTML = '<i data-lucide="edit-2"></i> Sửa Danh Mục';
      if (nameInput) nameInput.value = categoryToEdit.name;
      
      if (categoryToEdit.type === 'income') {
        if (typeIncomeRadio) typeIncomeRadio.checked = true;
      } else {
        if (typeExpenseRadio) typeExpenseRadio.checked = true;
      }

      uiService.selectedCatIcon = categoryToEdit.icon || 'tag';
      uiService.selectedCatColor = categoryToEdit.color || '#6366F1';
      if (colorInput) colorInput.value = uiService.selectedCatColor;
    } else {
      this.editingCategoryId = null;
      if (titleEl) titleEl.innerHTML = '<i data-lucide="plus-circle"></i> Thêm Danh Mục Mới';
      if (nameInput) nameInput.value = '';
      
      // Mặc định theo tab đang xem
      if (uiService.activeCatTab === 'income') {
        if (typeIncomeRadio) typeIncomeRadio.checked = true;
      } else {
        if (typeExpenseRadio) typeExpenseRadio.checked = true;
      }

      uiService.selectedCatIcon = 'tag';
      uiService.selectedCatColor = '#6366F1';
      if (colorInput) colorInput.value = '#6366F1';
    }

    if (window.lucide) lucide.createIcons({ root: titleEl });

    uiService.renderIconPicker();
    uiService.renderColorPicker();
  }

  handleSaveCategory(formData) {
    const name = formData.get('name')?.trim();
    if (!name) {
      uiService.showToast('Vui lòng nhập tên danh mục', 'warning');
      return;
    }

    const type = formData.get('type') || 'expense';
    const color = document.getElementById('catColorInput')?.value || uiService.selectedCatColor || '#6366F1';
    const icon = uiService.selectedCatIcon || 'tag';

    const catData = {
      id: this.editingCategoryId || ('cat_' + Date.now()),
      name: name,
      type: type,
      icon: icon,
      color: color
    };

    apiService.saveCategory(catData);
    
    // Cập nhật lại dropdown danh mục, biểu đồ và danh sách giao dịch
    this.populateCategorySelects();
    this.updateDashboard();

    uiService.showToast(this.editingCategoryId ? '✏️ Đã cập nhật danh mục!' : '✨ Đã thêm danh mục mới!', 'success');
    
    // Quay lại màn hình danh sách danh mục
    uiService.activeCatTab = type;
    document.querySelectorAll('.cat-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === type);
    });
    this.showCategoryListView();
  }

  handleDeleteCategory(id) {
    if (!confirm('Bạn có chắc muốn xóa danh mục này không? Các giao dịch cũ sẽ được chuyển sang "Khác".')) return;

    try {
      apiService.deleteCategory(id);
      
      // Chuyển các giao dịch thuộc danh mục này sang 'other_expense' hoặc 'other_income'
      let changed = false;
      this.transactions.forEach(tx => {
        if (tx.category === id) {
          tx.category = tx.type === 'income' ? 'other_income' : 'other_expense';
          changed = true;
        }
      });

      if (changed) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.TRANSACTIONS, JSON.stringify(this.transactions));
      }

      this.populateCategorySelects();
      this.updateDashboard();
      this.showCategoryListView();
      uiService.showToast('🗑️ Đã xóa danh mục thành công', 'info');
    } catch (err) {
      uiService.showToast(err.message || 'Không thể xóa danh mục này', 'error');
    }
  }

  handleResetCategories() {
    if (!confirm('Khôi phục lại 12 danh mục mặc định ban đầu? (Các danh mục tự tạo sẽ bị xóa)')) return;

    apiService.resetCategories();
    this.populateCategorySelects();
    this.updateDashboard();
    this.showCategoryListView();
    uiService.showToast('🔄 Đã khôi phục danh mục mặc định!', 'success');
  }

  /**
   * Lắng nghe sự kiện (Event Listeners)
   */
  bindEvents() {
    // --- 1. Mở / Đóng Modals ---
    document.querySelectorAll('.page-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.getAttribute('data-page');
        this.switchPage(page);
      });
    });

    document.getElementById('btnPrevMonth')?.addEventListener('click', () => {
      uiService.calendarMonth--;
      if (uiService.calendarMonth < 0) { uiService.calendarMonth = 11; uiService.calendarYear--; }
      this.updateHistoryView();
    });
    document.getElementById('btnNextMonth')?.addEventListener('click', () => {
      uiService.calendarMonth++;
      if (uiService.calendarMonth > 11) { uiService.calendarMonth = 0; uiService.calendarYear++; }
      this.updateHistoryView();
    });
    document.getElementById('btnTodayMonth')?.addEventListener('click', () => {
      const now = new Date();
      uiService.calendarMonth = now.getMonth();
      uiService.calendarYear = now.getFullYear();
      uiService.selectedCalendarDate = CONFIG.utils.getLocalDateString(now);
      this.updateHistoryView();
    });

    document.querySelectorAll('.cal-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cal-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        uiService.historyViewMode = btn.getAttribute('data-view');
        this.updateHistoryView();
      });
    });

    document.getElementById('btnAddForSelectedDay')?.addEventListener('click', () => {
      document.getElementById('txDate').value = uiService.selectedCalendarDate || CONFIG.utils.getLocalDateString();
      uiService.renderAmountSuggestions('', (val) => this.handleSelectSuggestedAmount(val));
      uiService.openModal('addTransactionModal');
    });
    document.getElementById('btnOpenAddModalFromHistory')?.addEventListener('click', () => {
      document.getElementById('txDate').value = uiService.selectedCalendarDate || CONFIG.utils.getLocalDateString();
      uiService.renderAmountSuggestions('', (val) => this.handleSelectSuggestedAmount(val));
      uiService.openModal('addTransactionModal');
    });

    document.getElementById('btnOpenAddModal')?.addEventListener('click', () => {
      document.getElementById('txDate').value = CONFIG.utils.getLocalDateString();
      uiService.renderAmountSuggestions('', (val) => this.handleSelectSuggestedAmount(val));
      uiService.openModal('addTransactionModal');
    });

    document.getElementById('btnOpenSettingsModal')?.addEventListener('click', () => {
      uiService.openModal('settingsModal');
    });

    document.getElementById('btnOpenHelpModal')?.addEventListener('click', () => {
      uiService.openModal('helpModal');
    });

    // Mở Modal Quản Lý Danh Mục từ Header, Settings hoặc Modal Thêm Giao Dịch
    document.getElementById('btnOpenCategoryModal')?.addEventListener('click', () => this.openCategoryModal());
    document.getElementById('btnOpenCategoryFromSettings')?.addEventListener('click', () => {
      uiService.closeModal('settingsModal');
      setTimeout(() => this.openCategoryModal(), 200);
    });
    document.getElementById('btnOpenCategoryFromAdd')?.addEventListener('click', () => {
      uiService.closeModal('addTransactionModal');
      setTimeout(() => this.openCategoryModal(), 200);
    });

    document.querySelectorAll('.modal-close, .btn-cancel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        if (modal) uiService.closeModal(modal.id);
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) uiService.closeModal(modal.id);
      });
    });

    // --- 2. Thay đổi loại thu/chi trong Form Thêm Giao Dịch ---
    const typeRadios = document.querySelectorAll('input[name="type"]');
    typeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const selectedType = e.target.value;
        const selectEl = document.getElementById('txCategory');
        if (!selectEl) return;

        Array.from(selectEl.options).forEach(opt => {
          const optType = opt.getAttribute('data-type');
          if (!optType || optType === selectedType) {
            opt.hidden = false;
          } else {
            opt.hidden = true;
          }
        });

        const firstValid = Array.from(selectEl.options).find(opt => !opt.hidden && opt.value);
        if (firstValid) selectEl.value = firstValid.value;
      });
    });

    // --- 3. Submit Form Thêm Giao Dịch ---
    document.getElementById('transactionForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      this.handleAddTransaction(formData);
    });

    // Lắng nghe sự kiện gõ số tiền để cập nhật gợi ý thông minh
    document.getElementById('txAmount')?.addEventListener('input', (e) => {
      uiService.renderAmountSuggestions(e.target.value, (val) => this.handleSelectSuggestedAmount(val));
    });

    // --- 4. Submit Form Cài Đặt ---
    document.getElementById('settingsForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const newName = document.getElementById('settingUserName').value.trim() || 'Bạn';
      const newBudget = Number(document.getElementById('settingBudget').value) || CONFIG.DEFAULT_BUDGET;
            const demoToggle = document.getElementById('settingDemoMode');
      const isDemo = demoToggle ? demoToggle.checked : apiService.isDemoMode();

      const oldDemo = apiService.isDemoMode();

      apiService.setUserName(newName);
      apiService.setBudget(newBudget);
      if (demoToggle) {
        apiService.setDemoMode(isDemo);
      }

      this.initSettingsUI();
      
      if (demoToggle && oldDemo !== isDemo) {
        this.loadData();
      } else {
        this.updateDashboard();
      }

      uiService.closeModal('settingsModal');
      uiService.showToast('⚙️ Đã lưu cấu hình cài đặt mới!', 'success');
    });

    // --- 5. Kiểm tra kết nối Google Sheet ---
    document.getElementById('btnTestConnection')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Đang kiểm tra...';
      
      const res = await apiService.testConnection();
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="wifi"></i> Kiểm tra kết nối Google Sheet';
      if (window.lucide) lucide.createIcons({ root: btn });

      if (res.success) {
        uiService.showToast(`✅ Kết nối API tốt! (Độ trễ: ${res.latency}ms, ${res.count} giao dịch trên Sheet)`, 'success');
        uiService.updateConnectionStatus('online', 'Google Sheet Đã Kết Nối');
      } else {
        uiService.showToast(`⚠️ Không thể kết nối API: ${res.message}`, 'warning');
      }
    });

    // --- 6. Chuyển đổi Light/Dark Mode ---
    document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);
      apiService.setTheme(nextTheme);
      this.updateThemeIcon(nextTheme);
      
      chartService.updateChartsTheme(this.transactions, this.currentChartType);
    });

    // --- 7. Bộ lọc & Tìm kiếm Giao dịch ---
    document.querySelectorAll('.filter-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        uiService.activeTab = e.currentTarget.getAttribute('data-tab');
        uiService.renderTransactionList(this.transactions, (id, cardEl) => this.handleDeleteTransaction(id, cardEl));
      });
    });

    document.getElementById('searchInput')?.addEventListener('input', (e) => {
      uiService.searchQuery = e.target.value;
      uiService.renderTransactionList(this.transactions, (id, cardEl) => this.handleDeleteTransaction(id, cardEl));
    });

    document.getElementById('categoryFilterSelect')?.addEventListener('change', (e) => {
      uiService.categoryFilter = e.target.value;
      uiService.renderTransactionList(this.transactions, (id, cardEl) => this.handleDeleteTransaction(id, cardEl));
    });

    // --- 8. Chuyển đổi biểu đồ Chi Tiêu / Thu Nhập ---
    document.querySelectorAll('.chart-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.chart-toggle-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentChartType = e.currentTarget.getAttribute('data-type');
        chartService.renderCategoryChart(this.transactions, this.currentChartType);
      });
    });

    // --- 9. Quản lý Danh Mục (Category Modal Events) ---
    document.querySelectorAll('.cat-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.cat-tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        uiService.activeCatTab = e.currentTarget.getAttribute('data-tab');
        this.showCategoryListView();
      });
    });

    document.getElementById('btnShowAddCategoryForm')?.addEventListener('click', () => {
      this.showCategoryFormView();
    });

    document.getElementById('btnBackToCatList')?.addEventListener('click', () => {
      this.showCategoryListView();
    });

    document.getElementById('categoryForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      this.handleSaveCategory(formData);
    });

    document.getElementById('btnResetCategories')?.addEventListener('click', () => {
      this.handleResetCategories();
    });

    // Khi chọn màu từ input custom color
    document.getElementById('catColorInput')?.addEventListener('input', (e) => {
      uiService.selectedCatColor = e.target.value;
      document.querySelectorAll('.color-picker-item').forEach(b => b.classList.remove('active'));
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
  window.app.init();
});
