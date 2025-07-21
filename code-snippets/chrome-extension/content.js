// content.js - 쿠팡 페이지에서 데이터 추출
class CoupangAnalyzer {
  constructor() {
    this.isSearchPage = window.location.pathname.includes('/np/search');
    this.isProductPage = window.location.pathname.includes('/vp/products');
    this.data = {
      keyword: '',
      products: [],
      timestamp: new Date().toISOString()
    };
    
    this.init();
  }

  init() {
    console.log('🚀 쿠팡 분석 도구 시작');
    
    if (this.isSearchPage) {
      this.analyzeSearchPage();
    } else if (this.isProductPage) {
      this.analyzeProductPage();
    }
    
    this.addAnalysisUI();
  }

  // 검색 페이지 분석
  analyzeSearchPage() {
    console.log('📊 검색 페이지 분석 중...');
    
    // 검색 키워드 추출
    const urlParams = new URLSearchParams(window.location.search);
    this.data.keyword = urlParams.get('q') || '';
    
    // 상품 리스트 추출
    const productItems = document.querySelectorAll('#productList li[id^="product_"]');
    
    productItems.forEach((item, index) => {
      const productData = this.extractProductData(item, index + 1);
      if (productData) {
        this.data.products.push(productData);
      }
    });
    
    console.log(`✅ ${this.data.products.length}개 상품 데이터 추출 완료`);
    this.saveData();
  }

  // 개별 상품 데이터 추출
  extractProductData(element, rank) {
    try {
      // 기본 정보
      const nameElement = element.querySelector('.name');
      const priceElement = element.querySelector('.price-value');
      const linkElement = element.querySelector('a');
      const imageElement = element.querySelector('img');
      
      // 리뷰 정보
      const reviewElement = element.querySelector('.rating-total-count');
      const ratingElement = element.querySelector('.star');
      
      // 배송 정보  
      const rocketElement = element.querySelector('.badge.rocket');
      const freeShipElement = element.querySelector('.free-shipping');
      
      // 판매자 정보
      const sellerElement = element.querySelector('.sold-by');
      
      return {
        rank: rank,
        name: nameElement?.textContent?.trim() || '',
        price: this.extractPrice(priceElement?.textContent),
        url: linkElement?.href || '',
        image: imageElement?.src || '',
        reviews: this.extractNumber(reviewElement?.textContent),
        rating: this.extractRating(ratingElement),
        isRocket: !!rocketElement,
        isFreeShipping: !!freeShipElement,
        seller: sellerElement?.textContent?.trim() || '',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('상품 데이터 추출 오류:', error);
      return null;
    }
  }

  // 상품 상세 페이지 분석
  analyzeProductPage() {
    console.log('📝 상품 상세 페이지 분석 중...');
    
    const productData = {
      name: document.querySelector('.prod-buy-header__title')?.textContent?.trim(),
      price: this.extractPrice(document.querySelector('.total-price')?.textContent),
      reviews: this.extractNumber(document.querySelector('.count')?.textContent),
      rating: this.extractRating(document.querySelector('.rating-star-num')),
      options: this.extractOptions(),
      seller: document.querySelector('.prod-sale-vendor-name')?.textContent?.trim(),
      delivery: document.querySelector('.prod-shipping-fee-message')?.textContent?.trim()
    };
    
    console.log('상품 상세 정보:', productData);
    this.saveProductDetail(productData);
  }

  // 옵션 정보 추출
  extractOptions() {
    const options = [];
    const optionSelects = document.querySelectorAll('.prod-option__item select');
    
    optionSelects.forEach(select => {
      const optionData = {
        name: select.getAttribute('title') || '',
        values: []
      };
      
      const optionElements = select.querySelectorAll('option[value]:not([value=""])');
      optionElements.forEach(option => {
        optionData.values.push({
          text: option.textContent.trim(),
          value: option.value,
          disabled: option.disabled
        });
      });
      
      if (optionData.values.length > 0) {
        options.push(optionData);
      }
    });
    
    return options;
  }

  // 숫자 추출 헬퍼
  extractNumber(text) {
    if (!text) return 0;
    const matches = text.match(/[\d,]+/);
    return matches ? parseInt(matches[0].replace(/,/g, '')) : 0;
  }

  // 가격 추출 헬퍼
  extractPrice(text) {
    if (!text) return 0;
    const matches = text.match(/[\d,]+/);
    return matches ? parseInt(matches[0].replace(/,/g, '')) : 0;
  }

  // 평점 추출 헬퍼
  extractRating(element) {
    if (!element) return 0;
    const text = element.textContent || element.getAttribute('data-rating') || '';
    const matches = text.match(/[\d.]+/);
    return matches ? parseFloat(matches[0]) : 0;
  }

  // 분석 UI 추가
  addAnalysisUI() {
    // 분석 결과를 보여줄 플로팅 버튼 추가
    const floatingBtn = document.createElement('div');
    floatingBtn.id = 'coupang-analyzer-btn';
    floatingBtn.innerHTML = '📊';
    floatingBtn.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      background: #ff6b35;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10000;
      font-size: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    
    floatingBtn.addEventListener('click', () => {
      this.showAnalysisResults();
    });
    
    document.body.appendChild(floatingBtn);
  }

  // 분석 결과 표시
  showAnalysisResults() {
    chrome.runtime.sendMessage({
      action: 'openDashboard',
      data: this.data
    });
  }

  // 데이터 저장
  saveData() {
    chrome.storage.local.set({
      [`analysis_${this.data.keyword}_${Date.now()}`]: this.data
    }, () => {
      console.log('✅ 분석 데이터 저장 완료');
    });
  }

  // 상품 상세 정보 저장
  saveProductDetail(productData) {
    chrome.storage.local.set({
      [`product_detail_${Date.now()}`]: productData
    }, () => {
      console.log('✅ 상품 상세 정보 저장 완료');
    });
  }
}

// 페이지 로드 완료 후 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new CoupangAnalyzer();
  });
} else {
  new CoupangAnalyzer();
}