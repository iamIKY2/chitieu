/**
 * SPEND MANAGER - API & STORAGE SERVICE
 * Quản lý kết nối Google Sheets API, LocalStorage Cache và Chế độ Demo
 */

class ApiService {
  constructor() {
    this.apiUrl = CONFIG.API_URL;
    this.isDemo = window.IS_DEMO_PAGE === true;
    
    // Sao chép và thêm tiền tố demo_ cho các key lưu trữ nếu là trang demo
    this.keys = { ...CONFIG.STORAGE_KEYS };
    if (this.isDemo) {
      for (const key in this.keys) {
        this.keys[key] = 'demo_' + this.keys[key];
      }
    }
    
    this.init();
  }

  init() {
    // Khởi tạo dữ liệu mặc định
    if (this.isDemo) {
      // Trong trang Demo, mặc định nạp dữ liệu Demo ban đầu để người dùng thấy ngay trải nghiệm
      if (!localStorage.getItem(this.keys.TRANSACTIONS)) {
        localStorage.setItem(this.keys.TRANSACTIONS, JSON.stringify(CONFIG.DEMO_TRANSACTIONS));
      }
    } else {
      // Trong trang chính thức, khởi tạo mảng rỗng nếu chưa có dữ liệu giao dịch
      if (!localStorage.getItem(this.keys.TRANSACTIONS)) {
        localStorage.setItem(this.keys.TRANSACTIONS, JSON.stringify([]));
      }
    }
    
    if (!localStorage.getItem(this.keys.BUDGET)) {
      localStorage.setItem(this.keys.BUDGET, CONFIG.DEFAULT_BUDGET.toString());
    }
    if (!localStorage.getItem(this.keys.USER_NAME)) {
      localStorage.setItem(this.keys.USER_NAME, this.isDemo ? 'Khách Demo' : 'Bạn');
    }
    if (!localStorage.getItem(this.keys.CATEGORIES)) {
      localStorage.setItem(this.keys.CATEGORIES, JSON.stringify(CONFIG.CATEGORIES));
    }
  }

  // --- QUẢN LÝ CHẾ ĐỘ DEMO & CÀI ĐẶT ---
  isDemoMode() {
    return this.isDemo;
  }

  setDemoMode(isDemo) {
    // Giữ nguyên phương thức rỗng để tương thích ngược nếu cần thiết
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
    const savedCat = {
      id: id,
      name: cat.name || 'Danh mục mới',
      type: cat.type || 'expense',
      icon: cat.icon || 'tag',
      color: cat.color || '#6366F1',
      bgColor: bgColor
    };
    cats[id] = savedCat;
    localStorage.setItem(this.keys.CATEGORIES, JSON.stringify(cats));

    // Đồng bộ API Google Sheet ngầm (nếu không phải Demo)
    if (!this.isDemoMode()) {
      const params = new URLSearchParams({
        action: 'saveCategory',
        id: id,
        name: savedCat.name,
        type: savedCat.type,
        icon: savedCat.icon,
        color: savedCat.color,
        bgColor: savedCat.bgColor
      });
      const getUrl = `${this.apiUrl}?${params.toString()}`;
      
      // Thử gọi API với redirect: 'follow' để kiểm tra xem Apps Script đã nhận lệnh hay chưa
      return fetch(getUrl, { method: 'GET', redirect: 'follow' })
        .then(async (res) => {
          try {
            const result = await res.json();
            if (result && result.status === 'success') {
              console.log('✅ Đã đồng bộ danh mục lên Google Sheets thành công:', id);
            } else if (result && (result.status === 'error' || result.message)) {
              console.warn('⚠️ Google Sheets API không thể lưu danh mục:', result.message);
              if (result.message && result.message.includes('Invalid action')) {
                if (window.uiService) {
                  window.uiService.showToast('⚠️ Google Apps Script chưa được tạo Bản triển khai mới (New Deployment)! Vui lòng xem hướng dẫn New Deployment.', 'error');
                }
              }
            }
          } catch (e) {
            console.log('Đã gửi yêu cầu lưu danh mục lên Google Sheets');
          }
          return savedCat;
        })
        .catch(err => {
          // Fallback dùng no-cors nếu trình duyệt cản trở bởi CORS
          fetch(getUrl, { method: 'GET', mode: 'no-cors' }).catch(e => console.warn(e));
          console.warn('Lỗi đồng bộ danh mục lên Google Sheets (đang dùng fallback):', err);
          return savedCat;
        });
    }

    return Promise.resolve(savedCat);
  }

  deleteCategory(id) {
    const cats = this.getCategories();
    if (!cats[id]) return Promise.resolve(false);
    
    // Đảm bảo không xóa danh mục mặc định cuối cùng của chi tiêu / thu nhập
    const type = cats[id].type;
    const sameTypeCount = Object.values(cats).filter(c => c.type === type).length;
    if (sameTypeCount <= 1) {
      return Promise.reject(new Error('Bạn cần giữ lại ít nhất 1 danh mục cho phần ' + (type === 'income' ? 'Thu nhập' : 'Chi tiêu')));
    }

    delete cats[id];
    localStorage.setItem(this.keys.CATEGORIES, JSON.stringify(cats));

    // Đồng bộ xóa danh mục lên Google Sheet ngầm
    if (!this.isDemoMode()) {
      const getUrl = `${this.apiUrl}?action=deleteCategory&id=${encodeURIComponent(id)}`;
      return fetch(getUrl, { method: 'GET', redirect: 'follow' })
        .then(async (res) => {
          try {
            const result = await res.json();
            if (result && result.status === 'success') {
              console.log('✅ Đã đồng bộ xóa danh mục trên Google Sheets:', id);
            } else if (result && result.message && result.message.includes('Invalid action')) {
              if (window.uiService) {
                window.uiService.showToast('⚠️ Google Apps Script chưa tạo Bản triển khai mới (New Deployment)!', 'error');
              }
            }
          } catch (e) {
            console.log('Đã gửi yêu cầu xóa danh mục lên Google Sheets');
          }
          return true;
        })
        .catch(err => {
          fetch(getUrl, { method: 'GET', mode: 'no-cors' }).catch(e => console.warn(e));
          console.warn('Lỗi đồng bộ xóa danh mục:', err);
          return true;
        });
    }

    return Promise.resolve(true);
  }

  resetCategories() {
    localStorage.setItem(this.keys.CATEGORIES, JSON.stringify(CONFIG.CATEGORIES));

    // Đồng bộ reset danh mục lên Google Sheet ngầm
    if (!this.isDemoMode()) {
      const getUrl = `${this.apiUrl}?action=resetCategories`;
      return fetch(getUrl, { method: 'GET', redirect: 'follow' })
        .then(async (res) => {
          try {
            const result = await res.json();
            if (result && result.status === 'success') {
              console.log('✅ Đã reset danh mục trên Google Sheets');
            } else if (result && result.message && result.message.includes('Invalid action')) {
              if (window.uiService) {
                window.uiService.showToast('⚠️ Google Apps Script chưa tạo Bản triển khai mới (New Deployment)!', 'error');
              }
            }
          } catch (e) {}
          return CONFIG.CATEGORIES;
        })
        .catch(err => {
          fetch(getUrl, { method: 'GET', mode: 'no-cors' }).catch(e => console.warn(e));
          console.warn('Lỗi đồng bộ reset danh mục:', err);
          return CONFIG.CATEGORIES;
        });
    }

    return Promise.resolve(CONFIG.CATEGORIES);
  }

  /**
   * Đồng bộ danh mục ngầm từ Google Sheets
   * @param {Function} onSyncSuccess Callback khi đồng bộ thành công
   */
  async syncCategories(onSyncSuccess = null) {
    if (this.isDemoMode()) return null;

    return this.syncCategoriesFromGoogleSheets()
      .then((remoteCats) => {
        if (remoteCats && typeof remoteCats === 'object' && Object.keys(remoteCats).length > 0) {
          localStorage.setItem(this.keys.CATEGORIES, JSON.stringify(remoteCats));
          if (onSyncSuccess && typeof onSyncSuccess === 'function') {
            onSyncSuccess(remoteCats);
          }
          return remoteCats;
        }
        return null;
      })
      .catch((err) => {
        console.warn('Google Sheets categories sync background warning:', err);
        return null;
      });
  }

  async syncCategoriesFromGoogleSheets() {
    try {
      const url = `${this.apiUrl}?action=getCategories&t=${Date.now()}`;
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow'
      });
      const result = await response.json();
      if (result && result.status === 'success' && result.categories) {
        return result.categories;
      }
      return null;
    } catch (error) {
      console.error('Lỗi khi tải danh mục từ Google Sheets:', error);
      throw error;
    }
  }

  // --- QUẢN LÝ GIAO DỊCH (TRANSACTIONS) ---

  /**
   * Chuẩn hóa danh sách giao dịch về định dạng sạch sẽ
   */
  normalizeTransactionsList(transactions) {
    if (!Array.isArray(transactions)) return [];
    return transactions.map(tx => ({
      ...tx,
      date: CONFIG.utils.normalizeDate(tx.date),
      amount: Number(tx.amount) || 0
    }));
  }

  /**
   * Lấy danh sách giao dịch từ LocalStorage lập tức, sau đó đồng bộ ngầm từ Google Sheet
   * @param {Function} onSyncSuccess Callback khi đồng bộ Google Sheet về thành công
   */
  async getTransactions(onSyncSuccess = null) {
    // 1. Lấy dữ liệu lập tức từ LocalStorage để hiển thị UI ngay (0ms latency)
    const localDataStr = localStorage.getItem(this.keys.TRANSACTIONS);
    let transactions = localDataStr ? JSON.parse(localDataStr) : [];
    transactions = this.normalizeTransactionsList(transactions);

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
        return this.normalizeTransactionsList(result.transactions);
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
      date: CONFIG.utils.normalizeDate(tx.date) || CONFIG.utils.getLocalDateString(),
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
