// ページ読み込み時の初期化処理
document.addEventListener('DOMContentLoaded', () => {
  // Cesiumの初期化
  initializeCesium();
  
  // UIのセットアップ
  setupUIEventListeners();
  
  // 画面サイズ調整
  adjustUIForScreenSize();
  window.addEventListener('resize', adjustUIForScreenSize);
  
  // 初期モードのデータ読み込み
  loadRestaurantData();
});

// UI要素のイベントリスナーをセットアップ
function setupUIEventListeners() {
  // 飲食店モードへの切り替え
  document.getElementById('restaurant-mode').addEventListener('click', event => {
    event.preventDefault();
    switchMode('restaurant');
  });
  
  // 避難所モードへの切り替え
  document.getElementById('evacuation-mode').addEventListener('click', event => {
    event.preventDefault();
    switchMode('evacuation');
  });
  
  // モード切り替えボタン
  document.getElementById('switchToEvacuationBtn').addEventListener('click', () => {
    // 現在地がある場合はその位置から避難所を探す
    if (currentLocation) {
      switchToEvacuation(currentLocation.longitude, currentLocation.latitude);
    } else {
      switchMode('evacuation');
    }
  });
  
  document.getElementById('switchToRestaurantBtn').addEventListener('click', () => {
    // 現在地がある場合はその位置から飲食店を探す
    if (currentLocation) {
      switchToRestaurant(currentLocation.longitude, currentLocation.latitude);
    } else {
      switchMode('restaurant');
    }
  });
  
  // 飲食店モードの現在地取得ボタン
  document.getElementById('getCurrentLocationRestaurantBtn').addEventListener('click', () => {
    getCurrentLocation().then(location => {
      showCurrentLocationMarker(location.longitude, location.latitude);
    });
  });
  
  // 飲食店モードの最寄り飲食店検索ボタン
  const findNearestRestaurantBtn = document.getElementById('findNearestRestaurantBtn');
  if (findNearestRestaurantBtn) {
    findNearestRestaurantBtn.addEventListener('click', () => {
      // restaurant.jsでfindNearestRestaurant関数が定義されていることを確認
      if (typeof findNearestRestaurant === 'function') {
        findNearestRestaurant();
      } else {
        console.error('findNearestRestaurant関数が定義されていません');
        alert('最寄り飲食店検索機能が利用できません。システム管理者にお問い合わせください。');
      }
    });
  }
  
  // 飲食店モードの表示リセットボタン
  document.getElementById('resetViewRestaurantBtn').addEventListener('click', resetView);
}

// アラート付きのルート検索失敗ハンドラ
function handleRouteError(error) {
  console.error('ルート検索に失敗しました:', error);
  alert(`ルート検索に失敗しました: ${error.message || '不明なエラー'}`);
}

// 画像ファイルの事前読み込み（実際にはtry-catchでエラーハンドリングすべき）
function preloadImages() {
  try {
    const imagePaths = [
      './img/current-location.png',
      './img/restaurant-icon.png',
      './img/shelter-icon.png'
    ];
    
    imagePaths.forEach(path => {
      const img = new Image();
      img.src = path;
    });
    console.log('画像の事前読み込みを実行しました');
  } catch (error) {
    console.warn('画像の事前読み込み中にエラーが発生しました:', error);
  }
}

// ページ初期化時に画像を事前読み込み
preloadImages();