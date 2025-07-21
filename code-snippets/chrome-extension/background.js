// background.js - Chrome Extension 백그라운드 서비스 워커
class CoupangAnalysisManager {
  constructor() {
    this.analysisData = new Map();
    this.trends = new Map();
    this.init();
  }

  init() {
    console.log('🚀 쿠팡 분석 매니저 시작');
    
    // 메시지 리스너 등록
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // 비동기 응답을 위해 true 반환
    });

    // Extension 설치/업데이트 시 실행
    chrome.runtime.onInstalled.addListener(() => {
      console.log('쿠팡 분석 도구가 설치되었습니다.');
      this.setupDefaultSettings();
    });

    // 주기적 데이터 정리
    this.scheduleCleanup();
  }

  // 메시지 처리
  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'saveAnalysisData':
          await this.saveAnalysisData(message.data);
          sendResponse({ success: true });
          break;

        case 'getAnalysisData':
          const data = await this.getAnalysisData(message.keyword);
          sendResponse({ data });
          break;

        case 'openDashboard':
          this.openDashboard(message.data);
          sendResponse({ success: true });
          break;

        case 'getMarketInsights':
          const insights = await this.generateMarketInsights(message.keyword);
          sendResponse({ insights });
          break;

        case 'exportData':
          const exportData = await this.exportAnalysisData();
          sendResponse({ data: exportData });
          break;

        default:
          sendResponse({ error: '알 수 없는 액션입니다.' });
      }
    } catch (error) {
      console.error('메시지 처리 오류:', error);
      sendResponse({ error: error.message });
    }
  }

  // 분석 데이터 저장
  async saveAnalysisData(data) {
    try {
      const storageKey = `analysis_${data.keyword}_${Date.now()}`;
      
      // Chrome Storage에 저장
      await chrome.storage.local.set({
        [storageKey]: {
          ...data,
          id: storageKey,
          createdAt: new Date().toISOString()
        }
      });

      // 트렌드 데이터 업데이트
      await this.updateTrends(data);

      console.log(`✅ 분석 데이터 저장 완료: ${storageKey}`);
    } catch (error) {
      console.error('데이터 저장 오류:', error);
      throw error;
    }
  }

  // 분석 데이터 조회
  async getAnalysisData(keyword) {
    try {
      const allData = await chrome.storage.local.get();
      const filteredData = Object.entries(allData)
        .filter(([key]) => key.startsWith(`analysis_${keyword}_`))
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return filteredData;
    } catch (error) {
      console.error('데이터 조회 오류:', error);
      return [];
    }
  }

  // 트렌드 데이터 업데이트
  async updateTrends(data) {
    try {
      const trendKey = `trends_${data.keyword}`;
      const existingTrends = await chrome.storage.local.get(trendKey);
      
      const trends = existingTrends[trendKey] || {
        keyword: data.keyword,
        history: [],
        insights: {}
      };

      // 현재 데이터를 히스토리에 추가
      trends.history.push({
        timestamp: new Date().toISOString(),
        productCount: data.products.length,
        avgPrice: this.calculateAveragePrice(data.products),
        avgReviews: this.calculateAverageReviews(data.products),
        topSellers: this.getTopSellers(data.products)
      });

      // 최근 30일 데이터만 유지
      trends.history = trends.history
        .filter(item => {
          const itemDate = new Date(item.timestamp);
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          return itemDate > thirtyDaysAgo;
        })
        .slice(-100); // 최대 100개 기록만 유지

      // 인사이트 업데이트
      trends.insights = this.generateTrendInsights(trends.history);

      await chrome.storage.local.set({ [trendKey]: trends });
    } catch (error) {
      console.error('트렌드 업데이트 오류:', error);
    }
  }

  // 시장 인사이트 생성
  async generateMarketInsights(keyword) {
    try {
      const analysisData = await this.getAnalysisData(keyword);
      
      if (analysisData.length === 0) {
        return { message: '분석할 데이터가 없습니다.' };
      }

      const latestData = analysisData[0];
      const products = latestData.products || [];

      const insights = {
        marketOverview: {
          totalProducts: products.length,
          avgPrice: this.calculateAveragePrice(products),
          avgReviews: this.calculateAverageReviews(products),
          competitionLevel: this.assessCompetitionLevel(products)
        },
        
        entryBarriers: {
          minReviewsFor1stPage: this.getMinReviewsForFirstPage(products),
          priceRange: this.getPriceRange(products),
          dominantSellers: this.getDominantSellers(products)
        },
        
        opportunities: {
          lowCompetitionNiches: this.findLowCompetitionNiches(products),
          priceGaps: this.findPriceGaps(products),
          reviewGaps: this.findReviewGaps(products)
        },
        
        recommendations: this.generateRecommendations(products)
      };

      return insights;
    } catch (error) {
      console.error('인사이트 생성 오류:', error);
      return { error: error.message };
    }
  }

  // 대시보드 열기
  openDashboard(data) {
    const dashboardUrl = chrome.runtime.getURL('dashboard.html');
    
    chrome.tabs.create({
      url: `${dashboardUrl}?data=${encodeURIComponent(JSON.stringify(data))}`
    });
  }

  // 계산 헬퍼 함수들
  calculateAveragePrice(products) {
    if (products.length === 0) return 0;
    const total = products.reduce((sum, product) => sum + (product.price || 0), 0);
    return Math.round(total / products.length);
  }

  calculateAverageReviews(products) {
    if (products.length === 0) return 0;
    const total = products.reduce((sum, product) => sum + (product.reviews || 0), 0);
    return Math.round(total / products.length);
  }

  getTopSellers(products) {
    const sellerCount = {};
    products.forEach(product => {
      if (product.seller) {
        sellerCount[product.seller] = (sellerCount[product.seller] || 0) + 1;
      }
    });
    
    return Object.entries(sellerCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([seller, count]) => ({ seller, count }));
  }

  // 경쟁 수준 평가
  assessCompetitionLevel(products) {
    const avgReviews = this.calculateAverageReviews(products);
    const rocketRatio = products.filter(p => p.isRocket).length / products.length;
    
    if (avgReviews > 1000 && rocketRatio > 0.7) return '매우 높음';
    if (avgReviews > 500 && rocketRatio > 0.5) return '높음';
    if (avgReviews > 100 && rocketRatio > 0.3) return '보통';
    return '낮음';
  }

  // 1페이지 진입 최소 리뷰수
  getMinReviewsForFirstPage(products) {
    const reviews = products.map(p => p.reviews || 0).sort((a, b) => b - a);
    const firstPageProducts = reviews.slice(0, Math.min(20, reviews.length));
    return Math.min(...firstPageProducts) || 0;
  }

  // 가격 범위 분석
  getPriceRange(products) {
    const prices = products.map(p => p.price || 0).filter(p => p > 0);
    if (prices.length === 0) return { min: 0, max: 0, median: 0 };
    
    prices.sort((a, b) => a - b);
    return {
      min: prices[0],
      max: prices[prices.length - 1],
      median: prices[Math.floor(prices.length / 2)]
    };
  }

  // 낮은 경쟁 틈새시장 찾기
  findLowCompetitionNiches(products) {
    return products
      .filter(product => {
        return (product.reviews || 0) < 100 && 
               (product.rating || 0) < 4.5 &&
               !product.isRocket;
      })
      .slice(0, 10)
      .map(product => ({
        name: product.name,
        reviews: product.reviews,
        rating: product.rating,
        price: product.price,
        rank: product.rank
      }));
  }

  // 추천사항 생성
  generateRecommendations(products) {
    const recommendations = [];
    
    const lowCompetition = this.findLowCompetitionNiches(products);
    if (lowCompetition.length > 0) {
      recommendations.push({
        type: '낮은 경쟁',
        message: `${lowCompetition.length}개의 낮은 경쟁 상품을 발견했습니다.`,
        action: '이 상품들과 유사한 제품으로 진입을 고려해보세요.'
      });
    }

    const priceRange = this.getPriceRange(products);
    if (priceRange.min > 0 && priceRange.max > priceRange.min * 3) {
      recommendations.push({
        type: '가격 전략',
        message: `가격 분포가 넓습니다 (${priceRange.min.toLocaleString()}원 ~ ${priceRange.max.toLocaleString()}원)`,
        action: '중간 가격대에서 차별화된 제품으로 진입해보세요.'
      });
    }

    return recommendations;
  }

  // 기본 설정 초기화
  setupDefaultSettings() {
    chrome.storage.local.set({
      settings: {
        autoAnalysis: true,
        dataRetentionDays: 30,
        alertThreshold: {
          minReviews: 50,
          maxCompetitors: 10
        }
      }
    });
  }

  // 주기적 데이터 정리
  scheduleCleanup() {
    // 24시간마다 실행
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000);
  }

  // 오래된 데이터 정리
  async cleanupOldData() {
    try {
      const allData = await chrome.storage.local.get();
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      const keysToRemove = Object.keys(allData).filter(key => {
        if (key.startsWith('analysis_')) {
          const timestamp = key.split('_').pop();
          return parseInt(timestamp) < thirtyDaysAgo;
        }
        return false;
      });

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.log(`🗑️ ${keysToRemove.length}개의 오래된 데이터를 정리했습니다.`);
      }
    } catch (error) {
      console.error('데이터 정리 오류:', error);
    }
  }

  // 데이터 내보내기
  async exportAnalysisData() {
    try {
      const allData = await chrome.storage.local.get();
      const analysisData = Object.entries(allData)
        .filter(([key]) => key.startsWith('analysis_'))
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});

      return {
        exportDate: new Date().toISOString(),
        dataCount: Object.keys(analysisData).length,
        data: analysisData
      };
    } catch (error) {
      console.error('데이터 내보내기 오류:', error);
      throw error;
    }
  }
}

// 서비스 워커 시작
const analysisManager = new CoupangAnalysisManager();