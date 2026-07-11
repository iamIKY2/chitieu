/**
 * SPEND MANAGER - CONFIGURATION & CONSTANTS
 * Quản lý cấu hình API, danh mục chi tiêu, màu sắc và thiết lập mặc định
 */

const CONFIG = {
  // Đường dẫn API Google Apps Script của bạn
  API_URL: 'https://script.google.com/macros/s/AKfycbyK6MP86Twyh4UAGqACHmYmxgdxh_5Zhi7RGrqfsQozEsKZFs6ZUwquHA-yZuiv_TDZ/exec',
  
  // Ngân sách tháng mặc định (VND)
  DEFAULT_BUDGET: 10000000,
  
  // Các khóa lưu trữ trong LocalStorage
  STORAGE_KEYS: {
    TRANSACTIONS: 'spend_mgr_transactions_v1',
    CATEGORIES: 'spend_mgr_categories_v1',
    BUDGET: 'spend_mgr_budget_v1',
    THEME: 'spend_mgr_theme_v1',
    DEMO_MODE: 'spend_mgr_demo_mode_v1',
    USER_NAME: 'spend_mgr_username_v1',
    LAST_SYNC: 'spend_mgr_last_sync_v1'
  },
  
  // Định dạng tiền tệ
  CURRENCY: {
    symbol: '₫',
    locale: 'vi-VN'
  },

  // Danh mục chi tiêu (Expenses) & Thu nhập (Income)
  CATEGORIES: {
    // Chi tiêu
    food: {
      id: 'food',
      name: 'Ăn uống',
      type: 'expense',
      icon: 'utensils',
      color: '#FF6B6B',
      bgColor: 'rgba(255, 107, 107, 0.15)'
    },
    shopping: {
      id: 'shopping',
      name: 'Mua sắm',
      type: 'expense',
      icon: 'shopping-bag',
      color: '#4ECDC4',
      bgColor: 'rgba(78, 205, 196, 0.15)'
    },
    transport: {
      id: 'transport',
      name: 'Di chuyển',
      type: 'expense',
      icon: 'car',
      color: '#45B7D1',
      bgColor: 'rgba(69, 183, 209, 0.15)'
    },
    bills: {
      id: 'bills',
      name: 'Hóa đơn & Điện nước',
      type: 'expense',
      icon: 'zap',
      color: '#F9A826',
      bgColor: 'rgba(249, 168, 38, 0.15)'
    },
    entertainment: {
      id: 'entertainment',
      name: 'Giải trí',
      type: 'expense',
      icon: 'film',
      color: '#9B51E0',
      bgColor: 'rgba(155, 81, 224, 0.15)'
    },
    health: {
      id: 'health',
      name: 'Sức khỏe & Y tế',
      type: 'expense',
      icon: 'heart',
      color: '#EB5757',
      bgColor: 'rgba(235, 87, 87, 0.15)'
    },
    education: {
      id: 'education',
      name: 'Học tập & Sách',
      type: 'expense',
      icon: 'book-open',
      color: '#2D9CDB',
      bgColor: 'rgba(45, 156, 219, 0.15)'
    },
    other_expense: {
      id: 'other_expense',
      name: 'Chi tiêu khác',
      type: 'expense',
      icon: 'more-horizontal',
      color: '#828282',
      bgColor: 'rgba(130, 130, 130, 0.15)'
    },

    // Thu nhập
    salary: {
      id: 'salary',
      name: 'Tiền lương',
      type: 'income',
      icon: 'dollar-sign',
      color: '#27AE60',
      bgColor: 'rgba(39, 174, 96, 0.15)'
    },
    bonus: {
      id: 'bonus',
      name: 'Thưởng & Quà tặng',
      type: 'income',
      icon: 'gift',
      color: '#F2994A',
      bgColor: 'rgba(242, 153, 74, 0.15)'
    },
    investment: {
      id: 'investment',
      name: 'Đầu tư & Kinh doanh',
      type: 'income',
      icon: 'trending-up',
      color: '#2F80ED',
      bgColor: 'rgba(47, 128, 237, 0.15)'
    },
    other_income: {
      id: 'other_income',
      name: 'Thu nhập khác',
      type: 'income',
      icon: 'plus-circle',
      color: '#6FCF97',
      bgColor: 'rgba(111, 207, 151, 0.15)'
    }
  },

  // Dữ liệu mẫu (Demo Data) để người dùng có thể test ngay lập tức các hiệu ứng và biểu đồ
  DEMO_TRANSACTIONS: [
    {
      id: 'DEMO_1',
      date: new Date().toISOString().split('T')[0],
      type: 'expense',
      category: 'food',
      amount: 85000,
      note: 'Ăn trưa cùng đồng nghiệp',
      createdAt: new Date().toISOString()
    },
    {
      id: 'DEMO_2',
      date: new Date().toISOString().split('T')[0],
      type: 'expense',
      category: 'shopping',
      amount: 450000,
      note: 'Mua áo thun mới',
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'DEMO_3',
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      type: 'expense',
      category: 'transport',
      amount: 50000,
      note: 'Grab đi làm',
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 'DEMO_4',
      date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
      type: 'income',
      category: 'salary',
      amount: 15000000,
      note: 'Lương tháng này',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'DEMO_5',
      date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
      type: 'expense',
      category: 'bills',
      amount: 650000,
      note: 'Tiền điện & internet',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
    },
    {
      id: 'DEMO_6',
      date: new Date(Date.now() - 86400000 * 4).toISOString().split('T')[0],
      type: 'expense',
      category: 'entertainment',
      amount: 210000,
      note: 'Xem phim cuối tuần',
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString()
    },
    {
      id: 'DEMO_7',
      date: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0],
      type: 'income',
      category: 'bonus',
      amount: 2000000,
      note: 'Thưởng dự án hoàn thành tốt',
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString()
    }
  ],

  // Các hàm tiện ích dùng chung trong ứng dụng
  utils: {
    /**
     * Lấy chuỗi ngày YYYY-MM-DD theo múi giờ địa phương
     * @param {Date} dateObj Đối tượng Date (mặc định là hiện tại)
     */
    getLocalDateString(dateObj = new Date()) {
      const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
      if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${date}`;
    },

    /**
     * Lấy chuỗi tháng YYYY-MM theo múi giờ địa phương
     * @param {Date} dateObj Đối tượng Date (mặc định là hiện tại)
     */
    getLocalMonthString(dateObj = new Date()) {
      const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
      if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 7);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    },

    /**
     * Chuẩn hóa ngày tháng về dạng YYYY-MM-DD
     * Hỗ trợ chuẩn hóa định dạng ngày dài trả về từ Apps Script/Google Sheets
     */
    normalizeDate(dateVal) {
      if (!dateVal) return this.getLocalDateString();
      
      // Nếu đã đúng định dạng YYYY-MM-DD
      if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        return dateVal;
      }
      
      let cleanDateVal = dateVal;
      if (typeof dateVal === 'string') {
        // Loại bỏ phần tên múi giờ trong ngoặc ở cuối (ví dụ: " (Indochina Time)" hoặc " (ICT)")
        cleanDateVal = dateVal.replace(/\s*\([^)]+\)$/, '');
      }

      // Bản đồ chuyển đổi tháng tiếng Anh sang số
      const monthMap = {
        Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
        Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
      };

      // 1. Phân tích chuỗi ngày định dạng của Google Apps Script (ví dụ: "Mon Jul 06 2026 00:00:00 GM...")
      if (typeof cleanDateVal === 'string') {
        const match = cleanDateVal.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/);
        if (match) {
          const monthStr = monthMap[match[1]];
          const dayStr = match[2].padStart(2, '0');
          const yearStr = match[3];
          if (monthStr) {
            return `${yearStr}-${monthStr}-${dayStr}`;
          }
        }
      }

      // 2. Fallback dùng hàm Date tiêu chuẩn của JS
      try {
        // Hỗ trợ cụt đuôi do split('T') ở Apps Script cũ (ví dụ: "... 00:00:00 GM" thành "... 00:00:00 GMT")
        let parseTarget = cleanDateVal;
        if (typeof parseTarget === 'string' && parseTarget.endsWith(' GM')) {
          parseTarget = parseTarget + 'T';
        }
        const d = new Date(parseTarget);
        if (!isNaN(d.getTime())) {
          return this.getLocalDateString(d);
        }
      } catch (e) {
        console.warn("Lỗi chuyển đổi ngày:", dateVal, e);
      }
      
      // Fallback nếu có chữ T (dạng ISO)
      if (typeof dateVal === 'string' && dateVal.includes('T')) {
        return dateVal.split('T')[0];
      }
      
      return String(dateVal);
    }
  }
};

// Expose ra global scope cho trình duyệt
window.CONFIG = CONFIG;
