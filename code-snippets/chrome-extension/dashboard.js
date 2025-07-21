// dashboard.js - 쿠팡 셀러 분석 대시보드 로직
class CoupangDashboard {
  constructor() {
    this.currentKeyword = 'all';
    this.analysisData = [];
    this.filteredData = [];
    this.insights = {};
    this.charts = {};
    
    this.init();
  }

  async init() {
    console.log('🚀 대시보드 초기화 시작');
    
    // DOM 요소 참조
    this.elements = {
      loadingOverlay: document.getElementById('loadingOverlay'),
      keywordTags: document.getElementById('keywordTags'),
      statsGrid: document.getElementById('statsGrid'),
      topProductsTableBody: document.getElementById('topProductsTableBody'),
      topSellersTableBody: document.getElementById('topSellersTableBody'),
      insightsGrid: document.getElementById('insightsGrid'),
      priceChart: document.getElementById('priceChart'),
      reviewsChart: document.getElementById('reviewsChart')
    };

    // 이벤트 리스너 설정
    this.setupEventListeners();
    
    // URL 파라미터에서 데이터 확인
    await this.loadInitialData();
    
    // 대시보드 데이터 로드
    await this.loadDashboardData();
    
    // 로딩 완료
    this.hideLoading();
    
    console.log('✅ 대시보드 초기화 완료');
  }

  setupEventListeners() {
    // 탭 버튼들
    const tabButtons = document.querySelectorAll('.control-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.handleTabSwitch(e.target.id);
      });
    });

    // 키워드 태그 클릭
    this.elements.keywordTags.addEventListener('click', (e) => {
      if (e.target.classList.contains('keyword-tag')) {
        this.filterByKeyword(e.target.dataset.keyword);
      }
    });

    // 새로고침 버튼들
    document.getElementById('refreshStatsBtn')?.addEventListener('click', () => {
      this.refreshStats();
    });

    document.getElementById('refreshInsightsBtn')?.addEventListener('click', () => {
      this.generateInsights();
    });

    // 내보내기 버튼
    document.getElementById('exportBtn')?.addEventListener('click', () => {
      this.exportData();
    });

    // 전체 상품 보기 버튼
    document.getElementById('viewAllProductsBtn')?.addEventListener('click', () => {
      this.showAllProducts();
    });
  }

  // 초기 데이터 로드
  async loadInitialData() {
    try {
      // URL 파라미터에서 데이터 확인
      const urlParams = new URLSearchParams(window.location.search);
      const dataParam = urlParams.get('data');
      const keywordParam = urlParams.get('keyword');

      if (dataParam) {
        // URL에서 직접 전달된 데이터
        const data = JSON.parse(decodeURIComponent(dataParam));
        this.analysisData = [data];
      } else {
        // Chrome Storage에서 데이터 로드
        const response = await chrome.runtime.sendMessage({
          action: 'getAllAnalysisData'
        });
        
        this.analysisData = response.data || [];
      }

      if (keywordParam) {
        this.currentKeyword = keywordParam;
      }

    } catch (error) {
      console.error('초기 데이터 로드 오류:', error);
      this.analysisData = [];
    }
  }

  // 대시보드 데이터 로드
  async loadDashboardData() {
    try {
      // 키워드 태그 생성
      this.createKeywordTags();
      
      // 데이터 필터링
      this.filterData();
      
      // 통계 업데이트
      this.updateStats();
      
      // 테이블 업데이트
      this.updateProductsTable();
      this.updateSellersTable();
      
      // 차트 생성
      this.createCharts();
      
      // 인사이트 생성
      this.generateInsights();

    } catch (error) {
      console.error('대시보드 데이터 로드 오류:', error);
      this.showError('데이터를 불러오는 중 오류가 발생했습니다.');
    }
  }

  // 키워드 태그 생성
  createKeywordTags() {
    const keywords = ['all', ...new Set(this.analysisData.map(data => data.keyword).filter(k => k))];
    
    const tagsHtml = keywords.map(keyword => `
      <div class="keyword-tag ${keyword === this.currentKeyword ? 'active' : ''}" 
           data-keyword="${keyword}">
        ${keyword === 'all' ? '전체' : keyword}
      </div>
    `).join('');
    
    this.elements.keywordTags.innerHTML = tagsHtml;
  }

  // 키워드로 필터링
  filterByKeyword(keyword) {
    this.currentKeyword = keyword;
    
    // 태그 활성화 상태 업데이트
    document.querySelectorAll('.keyword-tag').forEach(tag => {
      tag.classList.toggle('active', tag.dataset.keyword === keyword);
    });
    
    // 데이터 다시 필터링 및 업데이트
    this.filterData();
    this.updateStats();
    this.updateProductsTable();
    this.updateSellersTable();
    this.createCharts();
    this.generateInsights();
  }

  // 데이터 필터링
  filterData() {
    if (this.currentKeyword === 'all') {
      this.filteredData = this.analysisData;
    } else {
      this.filteredData = this.analysisData.filter(data => 
        data.keyword === this.currentKeyword
      );
    }
  }

  // 통계 업데이트
  updateStats() {
    const allProducts = this.filteredData.flatMap(data => data.products || []);
    
    if (allProducts.length === 0) {
      this.showEmptyStats();
      return;
    }

    // 기본 통계 계산
    const stats = {
      totalProducts: allProducts.length,
      avgReviews: Math.round(allProducts.reduce((sum, p) => sum + (p.reviews || 0), 0) / allProducts.length),
      avgPrice: Math.round(allProducts.reduce((sum, p) => sum + (p.price || 0), 0) / allProducts.length),
      competitionLevel: this.calculateCompetitionLevel(allProducts),
      opportunities: this.findOpportunities(allProducts).length,
      minReviewsFor1stPage: this.getMinReviewsForFirstPage(allProducts)
    };

    // DOM 업데이트
    document.getElementById('totalProductsCount').textContent = stats.totalProducts.toLocaleString();
    document.getElementById('avgReviewsCount').textContent = stats.avgReviews.toLocaleString();
    document.getElementById('avgPriceCount').textContent = `${stats.avgPrice.toLocaleString()}원`;
    document.getElementById('competitionLevel').textContent = stats.competitionLevel;
    document.getElementById('opportunitiesCount').textContent = stats.opportunities;
    document.getElementById('minReviewsFor1stPage').textContent = stats.minReviewsFor1stPage.toLocaleString();

    // 변화율 계산 및 표시 (이전 데이터와 비교)
    this.updateChangeIndicators(stats);
  }

  // 변화율 표시
  updateChangeIndicators(currentStats) {
    // 실제 구현에서는 이전 데이터와 비교
    const changes = {
      products: '+12%',
      reviews: '+8%',
      price: '-3%',
      opportunities: '+5'
    };

    document.getElementById('productsChange').textContent = changes.products;
    document.getElementById('reviewsChange').textContent = changes.reviews;
    document.getElementById('priceChange').textContent = changes.price;
    document.getElementById('opportunitiesChange').textContent = changes.opportunities;
  }

  // 상품 테이블 업데이트
  updateProductsTable() {
    const allProducts = this.filteredData.flatMap(data => data.products || []);
    
    if (allProducts.length === 0) {
      this.elements.topProductsTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: #666; padding: 40px;">
            분석된 상품이 없습니다
          </td>
        </tr>
      `;
      return;
    }

    // 상위 10개 상품만 표시
    const topProducts = allProducts
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))
      .slice(0, 10);

    const tableHtml = topProducts.map(product => `
      <tr>
        <td><span class="rank-badge">${product.rank || '-'}</span></td>
        <td>
          <div class="product-name" title="${product.name || '알 수 없음'}">
            ${this.truncateText(product.name || '알 수 없음', 30)}
          </div>
        </td>
        <td>${(product.reviews || 0).toLocaleString()}</td>
        <td>${(product.price || 0).toLocaleString()}원</td>
        <td>
          <span class="competition-level ${this.getCompetitionClass(product)}">
            ${this.getCompetitionLevel(product)}
          </span>
        </td>
      </tr>
    `).join('');

    this.elements.topProductsTableBody.innerHTML = tableHtml;
  }

  // 셀러 테이블 업데이트
  updateSellersTable() {
    const allProducts = this.filteredData.flatMap(data => data.products || []);
    
    if (allProducts.length === 0) {
      this.elements.topSellersTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: #666; padding: 40px;">
            분석된 데이터가 없습니다
          </td>
        </tr>
      `;
      return;
    }

    // 셀러별 통계 계산
    const sellerStats = this.calculateSellerStats(allProducts);
    const topSellers = Object.entries(sellerStats)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 5);

    const tableHtml = topSellers.map(([seller, stats]) => `
      <tr>
        <td>${this.truncateText(seller || '알 수 없음', 20)}</td>
        <td>${stats.count}</td>
        <td>${((stats.count / allProducts.length) * 100).toFixed(1)}%</td>
        <td>${Math.round(stats.avgReviews).toLocaleString()}</td>
      </tr>
    `).join('');

    this.elements.topSellersTableBody.innerHTML = tableHtml;
  }

  // 차트 생성
  createCharts() {
    const allProducts = this.filteredData.flatMap(data => data.products || []);
    
    if (allProducts.length === 0) {
      this.elements.priceChart.innerHTML = '<div class="chart-placeholder">데이터가 없습니다</div>';
      this.elements.reviewsChart.innerHTML = '<div class="chart-placeholder">데이터가 없습니다</div>';
      return;
    }

    // 가격 분포 차트 (간단한 히스토그램)
    this.createPriceChart(allProducts);
    
    // 리뷰수 분포 차트
    this.createReviewsChart(allProducts);
  }

  // 가격 분포 차트 생성
  createPriceChart(products) {
    const prices = products.map(p => p.price || 0).filter(p => p > 0);
    if (prices.length === 0) return;

    const priceRanges = this.createPriceRanges(prices);
    const chartHtml = this.createSimpleBarChart(priceRanges, '가격 분포');
    
    this.elements.priceChart.innerHTML = chartHtml;
  }

  // 리뷰수 분포 차트 생성
  createReviewsChart(products) {
    const reviews = products.map(p => p.reviews || 0);
    const reviewRanges = this.createReviewRanges(reviews);
    const chartHtml = this.createSimpleBarChart(reviewRanges, '리뷰수 분포');
    
    this.elements.reviewsChart.innerHTML = chartHtml;
  }

  // 간단한 바 차트 생성
  createSimpleBarChart(data, title) {
    const maxValue = Math.max(...data.map(d => d.count));
    
    const barsHtml = data.map(item => {
      const height = (item.count / maxValue) * 100;
      return `
        <div style="display: flex; flex-direction: column; align-items: center; margin: 0 5px;">
          <div style="height: 150px; display: flex; align-items: flex-end;">
            <div style="
              width: 40px; 
              height: ${height}%; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 4px 4px 0 0;
              position: relative;
            ">
              <div style="
                position: absolute;
                top: -20px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 10px;
                color: #666;
              ">${item.count}</div>
            </div>
          </div>
          <div style="font-size: 11px; color: #666; margin-top: 5px; text-align: center;">
            ${item.label}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div style="text-align: center; margin-bottom: 10px; font-size: 14px; font-weight: 600; color: #666;">
        ${title}
      </div>
      <div style="display: flex; justify-content: center; align-items: flex-end; height: 200px; padding: 20px;">
        ${barsHtml}
      </div>
    `;
  }

  // 인사이트 생성
  generateInsights() {
    const allProducts = this.filteredData.flatMap(data => data.products || []);
    
    if (allProducts.length === 0) {
      this.showEmptyInsights();
      return;
    }

    const insights = [
      this.generateEntryOpportunityInsight(allProducts),
      this.generatePricingInsight(allProducts),
      this.generateCompetitionInsight(allProducts)
    ];

    const insightsHtml = insights.map(insight => `
      <div class="insight-card">
        <div class="insight-title">${insight.icon} ${insight.title}</div>
        <div class="insight-content">${insight.content}</div>
        <button class="insight-action" onclick="dashboard.handleInsightAction('${insight.action}')">
          ${insight.actionText}
        </button>
      </div>
    `).join('');

    this.elements.insightsGrid.innerHTML = insightsHtml;
  }

  // 진입 기회 인사이트
  generateEntryOpportunityInsight(products) {
    const opportunities = this.findOpportunities(products);
    const lowCompetitionCount = opportunities.length;
    
    return {
      icon: '🎯',
      title: '진입 기회',
      content: `${lowCompetitionCount}개의 낮은 경쟁 상품을 발견했습니다. 평균 리뷰수가 ${Math.round(opportunities.reduce((sum, p) => sum + (p.reviews || 0), 0) / Math.max(opportunities.length, 1))}개 이하인 상품들로 진입하기 좋은 기회입니다.`,
      action: 'showOpportunities',
      actionText: '기회 보기'
    };
  }

  // 가격 전략 인사이트
  generatePricingInsight(products) {
    const prices = products.map(p => p.price || 0).filter(p => p > 0).sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)];
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    
    return {
      icon: '💰',
      title: '가격 전략',
      content: `시장 가격 분포가 ${min.toLocaleString()}원 ~ ${max.toLocaleString()}원입니다. 중간 가격대인 ${median.toLocaleString()}원 근처에서 차별화된 제품으로 진입을 고려해보세요.`,
      action: 'showPricing',
      actionText: '전략 보기'
    };
  }

  // 경쟁 분석 인사이트
  generateCompetitionInsight(products) {
    const competitionLevel = this.calculateCompetitionLevel(products);
    const avgReviews = Math.round(products.reduce((sum, p) => sum + (p.reviews || 0), 0) / products.length);
    
    return {
      icon: '📊',
      title: '경쟁 분석',
      content: `현재 경쟁 수준은 "${competitionLevel}"입니다. 1페이지 진입을 위해서는 최소 ${this.getMinReviewsForFirstPage(products)}개의 리뷰가 필요하며, 평균 ${avgReviews}개 수준의 경쟁자들과 경쟁해야 합니다.`,
      action: 'showCompetition',
      actionText: '분석 보기'
    };
  }

  // 유틸리티 함수들
  calculateCompetitionLevel(products) {
    const avgReviews = products.reduce((sum, p) => sum + (p.reviews || 0), 0) / Math.max(products.length, 1);
    const rocketRatio = products.filter(p => p.isRocket).length / Math.max(products.length, 1);
    
    if (avgReviews > 1000 && rocketRatio > 0.7) return '매우 높음';
    if (avgReviews > 500 && rocketRatio > 0.5) return '높음';
    if (avgReviews > 100 && rocketRatio > 0.3) return '보통';
    return '낮음';
  }

  findOpportunities(products) {
    return products.filter(product => {
      return (product.reviews || 0) < 100 && 
             (product.rating || 0) < 4.5 &&
             !product.isRocket;
    });
  }

  getMinReviewsForFirstPage(products) {
    const reviews = products.map(p => p.reviews || 0).sort((a, b) => b - a);
    const firstPageProducts = reviews.slice(0, Math.min(20, reviews.length));
    return Math.min(...firstPageProducts) || 0;
  }

  calculateSellerStats(products) {
    const stats = {};
    products.forEach(product => {
      const seller = product.seller || '알 수 없음';
      if (!stats[seller]) {
        stats[seller] = { count: 0, totalReviews: 0, avgReviews: 0 };
      }
      stats[seller].count++;
      stats[seller].totalReviews += (product.reviews || 0);
    });
    
    Object.keys(stats).forEach(seller => {
      stats[seller].avgReviews = stats[seller].totalReviews / stats[seller].count;
    });
    
    return stats;
  }

  createPriceRanges(prices) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min;
    const step = range / 5;
    
    const ranges = [];
    for (let i = 0; i < 5; i++) {
      const start = Math.round(min + (step * i));
      const end = Math.round(min + (step * (i + 1)));
      const count = prices.filter(p => p >= start && p < end).length;
      
      ranges.push({
        label: `${start.toLocaleString()}~${end.toLocaleString()}`,
        count: count
      });
    }
    
    return ranges;
  }

  createReviewRanges(reviews) {
    const ranges = [
      { label: '0-50', min: 0, max: 50 },
      { label: '51-100', min: 51, max: 100 },
      { label: '101-500', min: 101, max: 500 },
      { label: '501-1000', min: 501, max: 1000 },
      { label: '1000+', min: 1001, max: Infinity }
    ];
    
    return ranges.map(range => ({
      label: range.label,
      count: reviews.filter(r => r >= range.min && r <= range.max).length
    }));
  }

  getCompetitionClass(product) {
    const reviews = product.reviews || 0;
    if (reviews < 100) return 'competition-low';
    if (reviews < 500) return 'competition-medium';
    return 'competition-high';
  }

  getCompetitionLevel(product) {
    const reviews = product.reviews || 0;
    if (reviews < 100) return '낮음';
    if (reviews < 500) return '보통';
    return '높음';
  }

  truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  // 탭 전환 처리
  handleTabSwitch(tabId) {
    // 모든 탭 버튼 비활성화
    document.querySelectorAll('.control-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // 클릭된 탭 활성화
    document.getElementById(tabId).classList.add('active');
    
    // 탭별 내용 전환 (실제 구현에서는 각 탭의 내용을 보여주도록)
    console.log(`탭 전환: ${tabId}`);
  }

  // 인사이트 액션 처리
  handleInsightAction(action) {
    switch (action) {
      case 'showOpportunities':
        this.showOpportunities();
        break;
      case 'showPricing':
        this.showPricing();
        break;
      case 'showCompetition':
        this.showCompetition();
        break;
    }
  }

  // 데이터 내보내기
  async exportData() {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        keyword: this.currentKeyword,
        totalProducts: this.filteredData.flatMap(d => d.products || []).length,
        data: this.filteredData
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], 
        { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `coupang-analysis-${this.currentKeyword}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('✅ 데이터 내보내기 완료');
    } catch (error) {
      console.error('데이터 내보내기 오류:', error);
      alert('데이터 내보내기 중 오류가 발생했습니다.');
    }
  }

  // 통계 새로고침
  async refreshStats() {
    this.showLoading();
    await this.loadDashboardData();
    this.hideLoading();
  }

  // 로딩 표시/숨김
  showLoading() {
    this.elements.loadingOverlay.style.display = 'flex';
  }

  hideLoading() {
    this.elements.loadingOverlay.style.display = 'none';
  }

  // 빈 데이터 상태 표시
  showEmptyStats() {
    document.getElementById('totalProductsCount').textContent = '0';
    document.getElementById('avgReviewsCount').textContent = '0';
    document.getElementById('avgPriceCount').textContent = '0원';
    document.getElementById('competitionLevel').textContent = '-';
    document.getElementById('opportunitiesCount').textContent = '0';
    document.getElementById('minReviewsFor1stPage').textContent = '0';
  }

  showEmptyInsights() {
    this.elements.insightsGrid.innerHTML = `
      <div class="insight-card">
        <div class="insight-title">📊 데이터 없음</div>
        <div class="insight-content">
          분석할 데이터가 없습니다. 쿠팡에서 검색을 한 후 Extension을 사용해 데이터를 수집해주세요.
        </div>
        <button class="insight-action" onclick="window.open('https://www.coupang.com', '_blank')">
          쿠팡으로 이동
        </button>
      </div>
    `;
  }

  // 오류 표시
  showError(message) {
    console.error('대시보드 오류:', message);
    
    const errorHtml = `
      <div style="text-align: center; padding: 40px; color: #666;">
        <h3>⚠️ 오류 발생</h3>
        <p style="margin: 10px 0;">${message}</p>
        <button onclick="location.reload()" style="
          background: #ff6b35; 
          color: white; 
          border: none; 
          border-radius: 6px; 
          padding: 12px 20px; 
          cursor: pointer;
          margin-top: 10px;
        ">다시 시도</button>
      </div>
    `;
    
    document.querySelector('.dashboard-container').innerHTML = errorHtml;
  }

  // 기회 상품들 상세 보기
  showOpportunities() {
    const allProducts = this.filteredData.flatMap(data => data.products || []);
    const opportunities = this.findOpportunities(allProducts);
    
    alert(`${opportunities.length}개의 기회 상품을 찾았습니다!\n\n상세한 분석 결과는 개발 중입니다.`);
  }

  // 가격 전략 상세 보기
  showPricing() {
    alert('가격 전략 분석 기능은 개발 중입니다.');
  }

  // 경쟁 분석 상세 보기
  showCompetition() {
    alert('경쟁 분석 상세 기능은 개발 중입니다.');
  }

  // 전체 상품 보기
  showAllProducts() {
    alert('전체 상품 보기 기능은 개발 중입니다.');
  }
}

// 전역 대시보드 인스턴스
let dashboard;

// DOM 로드 완료 시 대시보드 초기화
document.addEventListener('DOMContentLoaded', () => {
  dashboard = new CoupangDashboard();
});

// 전역 함수들 (HTML에서 호출용)
window.dashboard = {
  handleInsightAction: (action) => dashboard.handleInsightAction(action)
};