/**
 * SPEND MANAGER - API & STORAGE SERVICE
 * Quản lý kết nối Google Sheets API, LocalStorage Cache và Chế độ Demo
 */

class ApiService {
  constructor() {
    this.apiUrl = CONFIG.API_URL;
    this.keys = CONFIG.STORAGE_KEYS;
    this.init();
  }

  init() {
    // Nếu chưa có dữ liệu trong localStorage, khởi tạo mặc định
    if (!localStorage.getItem(this.keys.TRANSACTIONS)) {
      // Mặc định nạp dữ liệu Demo ban đầu để người dùng thấy ngay trải nghiệm
      localStorage.setItem(this.keys.TRANSACTIONS, JSON.stringify(CONFIG.DEMO_TRANSACTIONS));
      localStorage.setItem(this.keys.DEMO_MODE, 'true');
    }
    if (!localStorage.getItem(this.keys.BUDGET)) {
      localStorage.setItem(this.keys.BUDGET, CONFIG.DEFAULT_BUDGET.toString());
    }
    if (!localStorage.getItem(this.keys.USER_NAME)) {
      localStorage.setItem(this.keys.USER_NAME, 'Bạn');
    }
    if (!localStorage.getItem(this.keys.CATEGORIES)) {
      localStorage.setItem(this.keys.CATEGORIES, JSON.stringify(CONFIG.CATEGORIES));
    }
  }

  // --- QUẢN LÝ CHẾ ĐỘ DEMO & CÀI ĐẶT ---
  isDemoMode() {
    return localStorage.getItem(this.keys.DEMO_MODE) === 'true';
  }

  setDemoMode(isDemo) {
    localStorage.setItem(this.keys.DEMO_MODE, isDemo ? 'true' : 'false');
    if (isDemo) {
      // Nạp lại dữ liệu demo vào cache nếu bật chế độ demo
      localStorage.setItem(this.keys.TRANSACTIONS, JSON.stringify(CONFIG.DEMO_TRANSACTIONS));
    }
  }

  getBudget() {
    return Number(localStorage.getItem(this.keys.BUDGET)) || CONFIG.DEFAULT_BUDGET;
  }

  setBudget(amount) {
    localStorage.setItem(this.keys.BUDGET, amount.toString());
  }

  getUserName() {
    return localStorage.getItem(this.keys.USER_NAME) || 'Bạn';
  }

  setUserName(name) {
    localStorage.setItem(this.keys.USER_NAME, name);
  }

  getTheme() {
    return localStorage.getItem(this.keys.THEME) || 'dark'; // Mặc định Dark Mode Glassmorphism
  }

  setTheme(theme) {
    localStorage.setItem(this.keys.THEME, theme);
  }

  // --- QUẢN LÝ DANH MỤC (CATEGORIES) ---
  getCategories() {
    const dataStr = localStorage.getItem(this.keys.CATEGORIES);
    if (!dataStr) {
      localStorage.setItem(this.keys.CATEGORIES, JSON.stringify(CONFIG.CATEGORIES));
      return CONFIG.CATEGORIES;
    }
    try {
      return JSON.parse(dataStr);
    } catch (e) {
      return CONFIG.CATEGORIES;
    }
  }

  saveCategory(cat) {
    const cats = this.getCategories();
    // Tự động tính màu nền nhạt từ mã hex color (nếu chưa có bgColor)
    let bgColor = cat.bgColor;
    if (!bgColor || bgColor === '') {
      // Chuyển hex sang rgba 0.15
      const hex = cat.color.replace('#', '');
      if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        bgColor = `rgba(${r}, ${g}, ${b}, 0.15)`;
      } else {
        bgColor = 'rgba(99, 102, 241, 0.15)';
      }
    }

    const id = cat.id || ('cat_' + Date.now());
    cats[id] = {
      id: id,
      name: cat.name || 'Danh mục mới',
      type: cat.type || 'expense',
      icon: cat.icon || 'tag',
      color: cat.color || '#6366F1',
      bgColor: bgColor
    };
    localStorage.setItem(this.keys.CATEGORIES, JSON.stringify(cats));
    return cats[id];
  }

  deleteCategory(id) {
    const cats = this.getCategories();
    if (!cats[id]) return false;
    
    // Đảm bảo không xóa danh mục mặc định cuối cùng của chi tiêu / thu nhập
    const type = cats[id].type;
    const sameTypeCount = Object.values(cats).filter(c => c.type === type).length;
    if (sameTypeCount <= 1) {
      throw new Error('Bạn cần giữ lại ít nhất 1 danh mục cho phần ' + (type === 'income' ? 'Thu nhập' : 'Chi tiêu'));
    }

    delete cats[id];
    localStorage.setItem(this.keys.CATEGORIES, JSON.stringify(cats));
    return true;
  }

  resetCategories() {
    localStorage.setItem(this.keys.CATEGORIES, JSON.stringify(CONFIG.CATEGORIES));
    return CONFIG.CATEGORIES;
  }

  // --- QUẢN LÝ GIAO DỊCH (TRANSACTIONS) ---

  /**
   * Lấy danh sách giao dịch từ LocalStorage lập tức, sau đó đồng bộ ngầm từ Google Sheet
   * @param {Function} onSyncSuccess Callback khi đồng bộ Google Sheet về thành công
   */
  async getTransactions(onSyncSuccess = null) {
    // 1. Lấy dữ liệu lập tức từ LocalStorage để hiển thị UI ngay (0ms latency)
    const localDataStr = localStorage.getItem(this.keys.TRANSACTIONS);
    let transactions = localDataStr ? JSON.parse(localDataStr) : [];

    // Nếu đang ở chế độ Demo, chỉ dùng LocalStorage
    if (this.isDemoMode()) {
      return { transactions, isFromCache: true, status: 'demo' };
    }

    // 2. Đồng bộ ngầm từ Google Sheets (Background Sync)
    this.syncFromGoogleSheets()
      .then((remoteTx) => {
        if (remoteTx && Array.isArray(remoteTx)) {
          // Cập nhật lại cache local
          localStorage.setItem(this.keys.TRANSACTIONS, JSON.stringify(remoteTx));
          localStorage.setItem(this.keys.LAST_SYNC, new Date().toLocaleTimeString('vi-VN'));
          if (onSyncSuccess && typeof onSyncSuccess === 'function') {
            onSyncSuccess(remoteTx);
          }
        }
      })
      .catch((err) => {
        console.warn('Google Sheets sync background warning:', err);
      });

    return { transactions, isFromCache: true, status: 'success' };
  }

  /**
   * Đồng bộ trực tiếp từ Google Sheets API
   */
  async syncFromGoogleSheets() {
    try {
      const url = `${this.apiUrl}?action=getTransactions&t=${Date.now()}`;
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow'
      });
      const result = await response.json();
      if (result && result.status === 'success' && Array.isArray(result.transactions)) {
        return result.transactions;
      }
      return null;
    } catch (error) {
      console.error('Lỗi khi tải từ Google Sheets:', error);
      if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
        console.warn('⚠️ Gợi ý CORS: Hãy đảm bảo Google Apps Script đã Deploy với quyền "Who has access" là "Anyone" (Bất kỳ ai).');
      }
      throw error;
    }
  }

  /**
   * Thêm giao dịch mới
   */
  async addTransaction(tx) {
    // 1. Tạo đối tượng hoàn chỉnh
    const newTx = {
      id: tx.id || ('TR_' + Date.now()),
      date: tx.date || new Date().toISOString().split('T')[0],
      type: tx.type || 'expense',
      category: tx.category || 'other_expense',
      amount: Number(tx.amount) || 0,
      note: tx.note || '',
      createdAt: new Date().toISOString()
    };

    // 2. Cập nhật lập tức vào LocalStorage
    const localDataStr = localStorage.getItem(this.keys.TRANSACTIONS);
    const transactions = localDataStr ? JSON.parse(localDataStr) : [];
    transactions.unshift(newTx); // Thêm vào đầu danh sách
    localStorage.setItem(this.keys.TRANSACTIONS, JSON.stringify(transactions));

    // Nếu chế độ Demo, trả về luôn không gọi API
    if (this.isDemoMode()) {
      return { status: 'success', transaction: newTx, isDemo: true };
    }

    // 3. Gửi request lên Google Sheets API (Background/Async)
    try {
      // Sử dụng cả GET fallback để tránh lỗi CORS phức tạp trên một số trình duyệt
      const params = new URLSearchParams({
        action: 'add',
        id: newTx.id,
        date: newTx.date,
        type: newTx.type,
        category: newTx.category,
        amount: newTx.amount,
        note: newTx.note
      });

      const getUrl = `${this.apiUrl}?${params.toString()}`;
      
      // Gửi ngầm qua GET/POST (no-cors hoặc follow redirect)
      fetch(getUrl, { method: 'GET', mode: 'no-cors' })
        .then(() => {
          console.log('Đã gửi dữ liệu đồng bộ lên Google Sheets thành công (GET no-cors)');
        })
        .catch(err => console.warn('Lỗi gửi API Google Sheet:', err));

      return { status: 'success', transaction: newTx, synced: true };
    } catch (error) {
      console.error('Lỗi kết nối API Google Sheet:', error);
      return { status: 'success', transaction: newTx, synced: false, error: error.message };
    }
  }

  /**
   * Xóa giao dịch theo ID
   */
  async deleteTransaction(id) {
    // 1. Xóa lập tức trong LocalStorage
    const localDataStr = localStorage.getItem(this.keys.TRANSACTIONS);
    let transactions = localDataStr ? JSON.parse(localDataStr) : [];
    transactions = transactions.filter(tx => String(tx.id) !== String(id));
    localStorage.setItem(this.keys.TRANSACTIONS, JSON.stringify(transactions));

    if (this.isDemoMode()) {
      return { status: 'success', id, isDemo: true };
    }

    // 2. Gửi request xóa lên Google Sheet
    try {
      const getUrl = `${this.apiUrl}?action=delete&id=${encodeURIComponent(id)}`;
      fetch(getUrl, { method: 'GET', mode: 'no-cors' })
        .then(() => console.log('Đã gửi yêu cầu xóa lên Google Sheets:', id))
        .catch(err => console.warn('Lỗi gửi yêu cầu xóa:', err));

      return { status: 'success', id, synced: true };
    } catch (error) {
      return { status: 'success', id, synced: false };
    }
  }

  /**
   * Kiểm tra kết nối với Google Sheet API
   */
  async testConnection() {
    try {
      const startTime = Date.now();
      const url = `${this.apiUrl}?action=getTransactions&t=${Date.now()}`;
      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      const result = await response.json();
      const latency = Date.now() - startTime;
      
      if (result && result.status === 'success') {
        return { success: true, latency, count: result.transactions ? result.transactions.length : 0 };
      }
      return { success: false, message: result ? result.message : 'Dữ liệu trả về không hợp lệ' };
    } catch (error) {
      console.error('Test connection failed:', error);
      let msg = error.message || 'Không thể kết nối đến Google Script URL';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS') || error.name === 'TypeError') {
        msg = 'Lỗi Quyền truy cập (CORS): Trên Apps Script, mục "Who has access" (Ai có quyền truy cập) BẮT BUỘC phải chọn là "Anyone" (Bất kỳ ai) và phải chọn New Deployment!';
      }
      return { success: false, message: msg };
    }
  }
}

// Khởi tạo instance global
window.apiService = new ApiService();
