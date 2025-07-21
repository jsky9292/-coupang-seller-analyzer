// popup.js - Extension 팝업 인터페이스 로직
class PopupManager {
  constructor() {
    this.currentTab = null;
    this.analysisData = null;
    this.isAnalyzing = false;
    
    this.init();
  }

  async init() {
    console.log('🚀 팝업 매니저 시작');
    
    // DOM 요소 참조
    this.elements = {
      pageStatus: document.getElementById('pageStatus'),
      pageInfo: document.getElementById('pageInfo'),
      analyzeBtn: document.getElementById('analyzeBtn'),
      quickStats: document.getElementById('quickStats'),
      productCount: document.getElementById('productCount'),
      avgReviews: document.getElementById('avgReviews'),
      loadingSection: document.getElementById('loadingSection'),
      keywordList: document.getElementById('keywordList'),
      settingsBtn: document.getElementById('settingsBtn'),
      dashboardBtn: document.getElementById('dashboardBtn')
    };

    // 이벤트 리스너 등록
    this.setupEventListeners();
    
    // 현재 탭 정보 로드
    await this.loadCurrentTab();
    
    // 최근 분석 데이터 로드
    await this.loadRecentAnalysis();
    
    // 페이지 상태 체크
    this.checkPageStatus();
  }

  setupEventListeners() {
    // 분석 버튼
    this.elements.analyzeBtn.addEventListener('click', () => {
      this.startAnalysis();
    });

    // 대시보드 버튼
    this.elements.dashboardBtn.addEventListener('click', () => {
      this.openDashboard();
    });

    // 설정 버튼
    this.elements.settingsBtn.addEventListener('click', () => {
      this.openSettings();
    });

    // 키워드 클릭 이벤트 (동적으로 추가되는 요소들을 위해 delegation 사용)
    this.elements.keywordList.addEventListener('click', (e) => {
      const keywordItem = e.target.closest('.keyword-item');
      if (keywordItem) {
        const keyword = keywordItem.dataset.keyword;
        this.openDashboardWithKeyword(keyword);
      }
    });
  }

  // 현재 탭 정보 로드
  async loadCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
      
      console.log('현재 탭:', tab.url);
    } catch (error) {
      console.error('탭 정보 로드 실패:', error);
    }
  }

  // 페이지 상태 체크
  checkPageStatus() {
    if (!this.currentTab) {
      this.updatePageStatus('inactive', '탭 정보를 불러올 수 없습니다');
      return;
    }

    const url = this.currentTab.url;
    
    if (!url.includes('coupang.com')) {
      this.updatePageStatus('inactive', '쿠팡 페이지가 아닙니다');
      this.elements.analyzeBtn.disabled = true;
      this.elements.analyzeBtn.textContent = '쿠팡 페이지에서 사용하세요';
      return;
    }

    if (url.includes('/np/search')) {
      this.updatePageStatus('active', '검색 페이지 - 분석 가능');
      this.elements.analyzeBtn.disabled = false;
      this.elements.analyzeBtn.textContent = '검색 결과 분석하기';
    } else if (url.includes('/vp/products')) {
      this.updatePageStatus('active', '상품 상세 페이지 - 분석 가능');
      this.elements.analyzeBtn.disabled = false;
      this.elements.analyzeBtn.textContent = '상품 정보 분석하기';
    } else {
      this.updatePageStatus('inactive', '쿠팡 검색/상품 페이지에서 사용하세요');
      this.elements.analyzeBtn.disabled = true;
      this.elements.analyzeBtn.textContent = '지원되지 않는 페이지';
    }
  }

  // 페이지 상태 업데이트
  updatePageStatus(status, message) {
    this.elements.pageStatus.className = `status-indicator status-${status}`;
    this.elements.pageInfo.textContent = message;
  }

  // 분석 시작
  async startAnalysis() {
    if (this.isAnalyzing) return;
    
    this.isAnalyzing = true;
    this.showLoading(true);
    
    try {
      // Content script에 분석 요청
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'startAnalysis'
      });

      if (response && response.success) {
        // 분석 완료 대기
        setTimeout(() => {
          this.loadAnalysisResults();
        }, 2000);
      } else {
        throw new Error('분석 요청 실패');
      }
    } catch (error) {
      console.error('분석 오류:', error);
      this.showError('분석 중 오류가 발생했습니다.');
    } finally {
      this.isAnalyzing = false;
      setTimeout(() => {
        this.showLoading(false);
      }, 3000);
    }
  }

  // 분석 결과 로드
  async loadAnalysisResults() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getLatestAnalysis',
        tabId: this.currentTab.id
      });

      if (response && response.data) {
        this.displayAnalysisResults(response.data);
        await this.loadRecentAnalysis(); // 최근 분석 목록 새로고침
      }
    } catch (error) {
      console.error('분석 결과 로드 오류:', error);
    }
  }

  // 분석 결과 표시
  displayAnalysisResults(data) {
    if (!data.products || data.products.length === 0) {
      this.showError('분석할 데이터가 없습니다.');
      return;
    }

    // 빠른 통계 업데이트
    this.elements.productCount.textContent = data.products.length;
    
    const avgReviews = Math.round(
      data.products.reduce((sum, p) => sum + (p.reviews || 0), 0) / data.products.length
    );
    this.elements.avgReviews.textContent = avgReviews.toLocaleString();
    
    // 통계 섹션 표시
    this.elements.quickStats.style.display = 'grid';
    
    console.log('✅ 분석 결과 표시 완료');
  }

  // 최근 분석 데이터 로드
  async loadRecentAnalysis() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getRecentAnalysis',
        limit: 5
      });

      if (response && response.data) {
        this.displayRecentKeywords(response.data);
      }
    } catch (error) {
      console.error('최근 분석 로드 오류:', error);
    }
  }

  // 최근 키워드 표시
  displayRecentKeywords(analysisData) {
    if (!analysisData || analysisData.length === 0) {
      this.elements.keywordList.innerHTML = `
        <div class="no-data">
          아직 분석된 키워드가 없습니다
        </div>
      `;
      return;
    }

    const keywordHtml = analysisData.map(item => {
      const timeAgo = this.getTimeAgo(item.createdAt);
      const productCount = item.products ? item.products.length : 0;
      
      return `
        <div class="keyword-item" data-keyword="${item.keyword || '알 수 없음'}">
          <div class="keyword-name">${item.keyword || '알 수 없음'}</div>
          <div class="keyword-meta">
            <div>${productCount}개 상품</div>
            <div class="keyword-time">${timeAgo}</div>
          </div>
        </div>
      `;
    }).join('');

    this.elements.keywordList.innerHTML = keywordHtml;
  }

  // 상대적 시간 계산
  getTimeAgo(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric'
    });
  }

  // 대시보드 열기
  openDashboard() {
    chrome.runtime.sendMessage({
      action: 'openDashboard',
      data: this.analysisData
    });
    
    window.close(); // 팝업 닫기
  }

  // 특정 키워드로 대시보드 열기
  openDashboardWithKeyword(keyword) {
    chrome.runtime.sendMessage({
      action: 'openDashboard',
      keyword: keyword
    });
    
    window.close();
  }

  // 설정 페이지 열기
  openSettings() {
    chrome.runtime.openOptionsPage();
    window.close();
  }

  // 로딩 상태 표시/숨김
  showLoading(show) {
    this.elements.loadingSection.style.display = show ? 'block' : 'none';
    this.elements.analyzeBtn.disabled = show;
    
    if (show) {
      this.updatePageStatus('analyzing', '페이지 분석 중...');
      this.elements.analyzeBtn.textContent = '분석 중...';
    } else {
      this.checkPageStatus(); // 원래 상태로 복원
    }
  }

  // 오류 메시지 표시
  showError(message) {
    this.elements.pageInfo.textContent = message;
    this.elements.pageStatus.className = 'status-indicator status-inactive';
    
    // 3초 후 원래 상태로 복원
    setTimeout(() => {
      this.checkPageStatus();
    }, 3000);
  }

  // 페이지 새로고침 감지
  detectPageChange() {
    let currentUrl = this.currentTab ? this.currentTab.url : '';
    
    setInterval(async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url !== currentUrl) {
          currentUrl = tab.url;
          this.currentTab = tab;
          this.checkPageStatus();
        }
      } catch (error) {
        // 탭이 닫히거나 권한이 없는 경우 무시
      }
    }, 1000);
  }
}

// DOM이 로드되면 PopupManager 시작
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});