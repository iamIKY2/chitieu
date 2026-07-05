/**
 * SPEND MANAGER - CHARTS & VISUALIZATION SERVICE
 * Quản lý vẽ biểu đồ trực quan (Chart.js) với hiệu ứng chuyển động mượt mà và tương thích Light/Dark Mode
 */

class ChartService {
  constructor() {
    this.categoryChart = null;
    this.trendChart = null;
    this.currentTheme = 'dark';
  }

  /**
   * Lấy cấu hình màu sắc font và grid theo Theme Sáng/Tối
   */
  getThemeConfig() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || 
                   !document.documentElement.hasAttribute('data-theme');
    
    return {
      textColor: isDark ? '#E2E8F0' : '#334155',
      mutedColor: isDark ? '#94A3B8' : '#64748B',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
      tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
      tooltipText: isDark ? '#F8FAFC' : '#0F172A'
    };
  }

  /**
   * Khởi tạo hoặc cập nhật Biểu đồ cơ cấu chi tiêu (Doughnut Chart)
   * @param {Array} transactions Danh sách giao dịch
   * @param {String} typeFilter 'expense' hoặc 'income'
   */
  renderCategoryChart(transactions = [], typeFilter = 'expense') {
    const canvas = document.getElementById('categoryChartCanvas');
    if (!canvas || !window.Chart) return;

    const ctx = canvas.getContext('2d');
    const theme = this.getThemeConfig();

    // Lọc giao dịch theo loại và tổng hợp theo danh mục
    const filteredTx = transactions.filter(tx => tx.type === typeFilter);
    const categoryTotals = {};
    
    filteredTx.forEach(tx => {
      const catId = tx.category || 'other_expense';
      categoryTotals[catId] = (categoryTotals[catId] || 0) + Number(tx.amount || 0);
    });

    const categories = Object.keys(categoryTotals);
    
    // Nếu không có dữ liệu
    if (categories.length === 0) {
      this.renderEmptyChart(ctx, this.categoryChart, 'Chưa có dữ liệu ' + (typeFilter === 'expense' ? 'chi tiêu' : 'thu nhập'));
      return;
    }

    const labels = [];
    const data = [];
    const backgroundColors = [];
    const borderColors = [];

    const allCats = apiService.getCategories();
    categories.forEach(catId => {
      const catInfo = allCats[catId] || { name: 'Khác', color: '#828282' };
      labels.push(catInfo.name);
      data.push(categoryTotals[catId]);
      backgroundColors.push(catInfo.color);
      borderColors.push(theme.tooltipBg);
    });

    if (this.categoryChart) {
      this.categoryChart.destroy();
    }

    this.categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 2,
          hoverOffset: 8,
          borderRadius: 6,
          spacing: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        animation: {
          animateScale: true,
          animateRotate: true,
          duration: 1000,
          easing: 'easeOutQuart'
        },
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: theme.textColor,
              font: {
                family: "'Plus Jakarta Sans', sans-serif",
                size: 12,
                weight: '500'
              },
              padding: 16,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              label: function(context) {
                const value = context.raw || 0;
                const total = context.chart._metasets[0].total || 1;
                const percentage = ((value / total) * 100).toFixed(1) + '%';
                return ` ${context.label}: ${value.toLocaleString('vi-VN')} ₫ (${percentage})`;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Khởi tạo hoặc cập nhật Biểu đồ xu hướng thu chi theo thời gian (Area/Bar Chart)
   * @param {Array} transactions Danh sách giao dịch
   */
  renderTrendChart(transactions = []) {
    const canvas = document.getElementById('trendChartCanvas');
    if (!canvas || !window.Chart) return;

    const ctx = canvas.getContext('2d');
    const theme = this.getThemeConfig();

    // Nhóm giao dịch theo ngày (trong 7-14 ngày gần nhất có giao dịch, hoặc theo tháng)
    // Để biểu đồ sinh động, ta sẽ lấy 6 tháng gần nhất hoặc 7 ngày gần nhất
    const dateMap = {};
    const today = new Date();
    
    // Tạo 7 ngày gần đây nhất
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      dateMap[dateStr] = { label: displayStr, income: 0, expense: 0 };
    }

    // Đổ dữ liệu vào
    transactions.forEach(tx => {
      const dateStr = tx.date;
      if (dateMap[dateStr]) {
        if (tx.type === 'income') {
          dateMap[dateStr].income += Number(tx.amount || 0);
        } else {
          dateMap[dateStr].expense += Number(tx.amount || 0);
        }
      } else {
        // Nếu có giao dịch ngoài 7 ngày, ta có thể tự động bổ sung vào sơ đồ nếu ít hơn 10 mốc
        // (Để đơn giản và đẹp mắt, hiển thị 7 mốc ngày chuẩn)
      }
    });

    const labels = Object.values(dateMap).map(item => item.label);
    const incomeData = Object.values(dateMap).map(item => item.income);
    const expenseData = Object.values(dateMap).map(item => item.expense);

    // Tạo gradient đẹp mắt cho Area Chart
    const incomeGradient = ctx.createLinearGradient(0, 0, 0, 300);
    incomeGradient.addColorStop(0, 'rgba(39, 174, 96, 0.4)');
    incomeGradient.addColorStop(1, 'rgba(39, 174, 96, 0.0)');

    const expenseGradient = ctx.createLinearGradient(0, 0, 0, 300);
    expenseGradient.addColorStop(0, 'rgba(255, 107, 107, 0.4)');
    expenseGradient.addColorStop(1, 'rgba(255, 107, 107, 0.0)');

    if (this.trendChart) {
      this.trendChart.destroy();
    }

    this.trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Thu nhập',
            data: incomeData,
            borderColor: '#27AE60',
            backgroundColor: incomeGradient,
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#27AE60',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 7
          },
          {
            label: 'Chi tiêu',
            data: expenseData,
            borderColor: '#FF6B6B',
            backgroundColor: expenseGradient,
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#FF6B6B',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        animation: {
          duration: 1200,
          easing: 'easeOutQuart'
        },
        scales: {
          x: {
            grid: {
              color: theme.gridColor,
              drawBorder: false
            },
            ticks: {
              color: theme.mutedColor,
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 }
            }
          },
          y: {
            grid: {
              color: theme.gridColor,
              drawBorder: false
            },
            ticks: {
              color: theme.mutedColor,
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
              callback: function(value) {
                if (value >= 1000000) return (value / 1000000) + 'M';
                if (value >= 1000) return (value / 1000) + 'k';
                return value;
              }
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: theme.textColor,
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: '500' },
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: function(context) {
                return ` ${context.dataset.label}: ${context.raw.toLocaleString('vi-VN')} ₫`;
              }
            }
          }
        }
      }
    });
  }

  renderEmptyChart(ctx, chartRef, message) {
    if (chartRef) chartRef.destroy();
    // Chart.js clear
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  /**
   * Cập nhật lại màu sắc biểu đồ khi đổi Light/Dark mode
   */
  updateChartsTheme(transactions, currentCategoryType = 'expense') {
    this.renderCategoryChart(transactions, currentCategoryType);
    this.renderTrendChart(transactions);
  }
}

// Global instance
window.chartService = new ChartService();
