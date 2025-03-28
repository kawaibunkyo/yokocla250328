// 飲食店モード用のグローバル変数
let allRestaurantData = [];
let displayedRestaurants = [];
let nearestRestaurantEntity = null;
let selectedPriceRanges = [];
let selectedRatings = [];
let currentLocation = null; // 現在地を保存するグローバル変数

// 飲食店データの読み込み
function loadRestaurantData() {
  // エンティティをクリア
  viewer.entities.removeAll();
  
  console.log('飲食店データ読み込み開始');
  
  // JSONファイルの読み込み
  fetch('yokohama_restaurant_1000_1km_2_1000.json')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP エラー: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('飲食店データ読み込み成功', data.length);
      allRestaurantData = data;
      displayedRestaurants = [...allRestaurantData];
      
      // 飲食店を表示
      displayRestaurants(displayedRestaurants);
      
      // 検索ボックスのセットアップ
      setupSearchFunctionality();
      
      // フィルターのセットアップ
      setupFilteringUI();
    })
    .catch(error => {
      console.error('飲食店データの読み込みに失敗しました:', error);
      alert('飲食店データの読み込みに失敗しました。ファイル名を確認してください。: ' + error.message);
    });
}

// 飲食店の表示
function displayRestaurants(restaurants) {
  // エンティティをクリア（現在地マーカーは残す）
  const currentLocationEntity = viewer.entities.getById('現在地');
  viewer.entities.removeAll();
  if (currentLocationEntity) {
    viewer.entities.add(currentLocationEntity);
  }
  
  console.log(`表示する飲食店数: ${restaurants.length}`);
  
  if (restaurants.length === 0) {
    console.warn('表示する飲食店データがありません');
    return;
  }
  
  // サンプルデータをコンソールに出力して確認
  if (restaurants.length > 0) {
    console.log('サンプル飲食店データ:', restaurants[0]);
  }
  
  // 表示カウンタ（処理の進捗確認用）
  let displayedCount = 0;
  
  // 一度に処理する最大件数（パフォーマンス対策）
  const batchSize = 100;
  
  // バッチ処理で飲食店を表示
  function displayBatch(startIndex) {
    const endIndex = Math.min(startIndex + batchSize, restaurants.length);
    
    for (let i = startIndex; i < endIndex; i++) {
      try {
        const item = restaurants[i];
        
        // データの存在確認
        if (!item || !item.geometry || !item.geometry.location) {
          console.error(`店舗 ${i} のデータ構造が不正です`, item);
          continue;
        }
        
        // 位置情報の取得
        const lng = parseFloat(item.geometry.location.lng);
        const lat = parseFloat(item.geometry.location.lat);
        
        // 数値チェック
        if (isNaN(lng) || isNaN(lat)) {
          console.error(`店舗 ${i} の座標が不正です`, item.geometry.location);
          continue;
        }
        
        // 評価に基づいて高さを変更（評価が高いほど高い）
        const baseHeight = 20; // 基本の高さ
        const ratingMultiplier = 100; // 評価1つあたりの高さ
        
        // 評価の取得と正規化（1〜5の範囲に）
        const rating = item.rating === "N/A" || !item.rating ? 1 : Math.min(Math.max(parseFloat(item.rating), 1), 5);
        
        // 高さの計算（評価1なら50、評価5なら250）
        const height = baseHeight + (rating - 1) * ratingMultiplier;
        
        // 価格帯の取得と正規化
        const priceLevel = item.price_level === "N/A" || !item.price_level ? 1 : Math.min(Math.max(parseInt(item.price_level, 10), 1), 4);
        
        // 価格帯に基づいた色相の計算（安い：緑、高い：赤紫）
        const hue = 120 - ((priceLevel - 1) / 3) * 160; // 120（緑）から-40（赤紫）へ
        const saturation = 60; // 彩度は固定
        const lightness = 50; // 明度も固定
        
        // HSL色の作成
        const colorHSL = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        const color = Cesium.Color.fromCssColorString(colorHSL);
        
        // 店名の取得（未定義の場合はデフォルト値を使用）
        const name = item.name || `店舗 ${i}`;
        
        // エンティティの説明（情報ウィンドウの内容）
        const description = `
            <table>
                <tr>
                    <th>店名</th>
                    <td>${name}</td>
                </tr>
                <tr>
                    <th>価格帯</th>
                    <td>${'¥'.repeat(priceLevel)}</td>
                </tr>
                <tr>
                    <th>評価</th>
                    <td>${rating} ★</td>
                </tr>
                <tr>
                    <th>住所</th>
                    <td>${item.formatted_address || '情報なし'}</td>
                </tr>
                <tr>
                    <th>電話番号</th>
                    <td>${item.formatted_phone_number || '情報なし'}</td>
                </tr>
                <tr>
                    <th>ウェブサイト</th>
                    <td>${item.website ? `<a href="${item.website}" target="_blank">${item.website}</a>` : '情報なし'}</td>
                </tr>
                <tr>
                    <th>評価数</th>
                    <td>${item.user_ratings_total || '情報なし'}</td>
                </tr>
            </table>
            <button onclick="findRouteToRestaurant(${lng}, ${lat})">ここへのルートを表示</button>
            <button onclick="switchToEvacuation(${lng}, ${lat})">この場所から避難所を探す</button>
        `;
        
        // エンティティとして3D四角柱を追加（避難所と同様のスタイル）
        viewer.entities.add({
          name: name,
          description: description,
          position: Cesium.Cartesian3.fromDegrees(
            lng,
            lat,
            height / 2  // 高さの半分を中心位置に設定
          ),
          box: {
            dimensions: new Cesium.Cartesian3(30, 30, height), // 幅・奥行きは30メートルに設定
            material: color.withAlpha(0.7), // 透明度を追加（避難所と同様）
            outline: true,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1.0 // アウトラインの幅を指定
          },
          // ラベルを追加（飲食店名を表示）
          label: {
            text: name,
            font: '12px sans-serif',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -height / 2 - 10), // 四角柱の上部にラベルを表示
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            disableDepthTestDistance: Number.POSITIVE_INFINITY, // 常に表示
            scale: 0.8, // ラベルのサイズ
            // 近づいたときだけ表示するオプション
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2000)
          },
          properties: {
            isRestaurant: true,
            restaurantData: item,
            priceLevel: priceLevel,
            rating: rating
          }
        });
        
        displayedCount++;
        
      } catch (error) {
        console.error(`店舗 ${i} の表示中にエラーが発生しました:`, error);
      }
    }
    
    // 次のバッチを処理（処理が残っている場合）
    if (endIndex < restaurants.length) {
      // 非同期で次のバッチを処理（UIのブロッキングを防止）
      setTimeout(() => {
        displayBatch(endIndex);
      }, 10); // 10ms後に次のバッチを処理
    } else {
      // すべての処理が完了
      console.log(`${displayedCount}件の飲食店を表示しました`);
    }
  }
  
  // 最初のバッチを開始
  displayBatch(0);
}

// 検索機能のセットアップ
function setupSearchFunctionality() {
  const searchBox = document.getElementById('searchBox');
  const searchButton = document.getElementById('searchButton');
  const clearButton = document.getElementById('clearButton');

  // 検索ボックスのクリックイベント
  searchButton.addEventListener('click', () => {
    const query = searchBox.value.trim().toLowerCase();
    if (query) {
      const results = searchInNameAndText(query);
      displaySearchResults(results);
      displayRestaurants(results);
    }
  });

  // クリアボタンのクリックイベント
  clearButton.addEventListener('click', () => {
    searchBox.value = '';
    document.getElementById('resultsList').innerHTML = '';
    applyFilters(); // 検索をクリアしてフィルターのみ適用
  });
  
  // Enterキーのイベント
  searchBox.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
      searchButton.click();
    }
  });
}

// 名前とレビューを検索
function searchInNameAndText(query) {
  if (!query) return allRestaurantData;

  return allRestaurantData.filter(restaurant => {
    const nameMatches = restaurant.name && restaurant.name.toLowerCase().includes(query);
    const reviewsMatch = restaurant.reviews && restaurant.reviews.some(review => 
      review.text && review.text.toLowerCase().includes(query)
    );
    return nameMatches || reviewsMatch;
  });
}

// 検索結果を表示
function displaySearchResults(results) {
  const container = document.getElementById('resultsList');
  container.innerHTML = ''; // 既存のデータをクリア

  if (results.length === 0) {
    container.innerHTML = '<p>検索結果が見つかりませんでした。</p>';
    return;
  }

  // 検索結果を表示（最大10件まで）
  const displayCount = Math.min(results.length, 10);
  for (let i = 0; i < displayCount; i++) {
    const restaurant = results[i];
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <p>${restaurant.name}</p>
      <p class="result-rating">${restaurant.rating ? `★${restaurant.rating}` : ''} ${restaurant.price_level ? '¥'.repeat(restaurant.price_level) : ''}</p>
    `;
    
    // クリックイベント - 選択した飲食店にカメラを移動
    item.addEventListener('click', () => {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          restaurant.geometry.location.lng, 
          restaurant.geometry.location.lat, 
          500
        ),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0
        }
      });
    });
    
    container.appendChild(item);
  }
  
  // 結果が10件以上ある場合は追加メッセージ
  if (results.length > 10) {
    const moreMessage = document.createElement('p');
    moreMessage.className = 'more-results';
    moreMessage.textContent = `他 ${results.length - 10} 件の結果があります`;
    container.appendChild(moreMessage);
  }
}

// フィルタリングUIのセットアップ
function setupFilteringUI() {
  // 価格帯フィルターのチェックボックス
  document.querySelectorAll('.price-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      selectedPriceRanges = Array.from(document.querySelectorAll('.price-checkbox:checked'))
        .map(cb => parseInt(cb.value, 10));
      applyFilters();
    });
  });
  
  // 評価フィルターのチェックボックス
  document.querySelectorAll('.rating-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      selectedRatings = Array.from(document.querySelectorAll('.rating-checkbox:checked'))
        .map(cb => parseInt(cb.value, 10));
      applyFilters();
    });
  });
}

// フィルターを適用
function applyFilters() {
  // 検索クエリを取得
  const searchQuery = document.getElementById('searchBox').value.trim().toLowerCase();
  
  // まず検索クエリでフィルタリング
  let filteredData = searchQuery ? 
    searchInNameAndText(searchQuery) : 
    [...allRestaurantData];
  
  // 価格帯でフィルタリング
  if (selectedPriceRanges.length > 0) {
    filteredData = filteredData.filter(item => {
      const priceLevel = item.price_level === "N/A" || !item.price_level ? 
        null : parseInt(item.price_level, 10);
      return priceLevel && selectedPriceRanges.includes(priceLevel);
    });
  }
  
  // 評価でフィルタリング
  if (selectedRatings.length > 0) {
    filteredData = filteredData.filter(item => {
      const rating = item.rating === "N/A" || !item.rating ? 
        null : Math.floor(parseFloat(item.rating));
      return rating && selectedRatings.includes(rating);
    });
  }
  
  // フィルタリング結果を表示
  displayedRestaurants = filteredData;
  displayRestaurants(displayedRestaurants);
  
  // 検索結果も更新
  displaySearchResults(displayedRestaurants);
}

// 最寄りの飲食店を検索して表示
function findNearestRestaurant() {
  // 現在地がない場合は取得
  if (!currentLocation) {
    getCurrentLocation().then(location => {
      findNearestRestaurantFromLocation(location.longitude, location.latitude);
    }).catch(error => {
      console.error('現在地の取得に失敗しました:', error);
    });
  } else {
    findNearestRestaurantFromLocation(currentLocation.longitude, currentLocation.latitude);
  }
}

// 指定位置から最寄りの飲食店を検索
function findNearestRestaurantFromLocation(longitude, latitude) {
  // 現在地を表示
  showCurrentLocationMarker(longitude, latitude);
  
  // フィルタリングされた飲食店から最寄りを検索
  let nearestRestaurant = null;
  let minDistance = Infinity;
  
  displayedRestaurants.forEach(restaurant => {
    const restaurantLng = restaurant.geometry.location.lng;
    const restaurantLat = restaurant.geometry.location.lat;
    
    const distance = calculateDistance(longitude, latitude, restaurantLng, restaurantLat);
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestRestaurant = restaurant;
    }
  });
  
  if (nearestRestaurant) {
    // 前回の最寄り店舗ハイライトがあれば削除
    if (nearestRestaurantEntity) {
      viewer.entities.remove(nearestRestaurantEntity);
    }
    
    // 最寄りの店舗の座標
    const restaurantLng = nearestRestaurant.geometry.location.lng;
    const restaurantLat = nearestRestaurant.geometry.location.lat;
    
    // 最寄りの店舗をハイライト
    nearestRestaurantEntity = viewer.entities.add({
      name: '最寄り飲食店',
      position: Cesium.Cartesian3.fromDegrees(restaurantLng, restaurantLat, 10),
      billboard: {
        image: './img/restaurant-icon.png', // 飲食店アイコン（画像ファイルが必要）
        scale: 0.8,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM
      }
    });
    
    // 店舗詳細を表示
    updateNearestRestaurantInfo(nearestRestaurant, minDistance);
    
    // ルートを表示
    showRoute([longitude, latitude], [restaurantLng, restaurantLat], 'foot-walking')
      .then(routeInfo => {
        if (routeInfo) {
          updateRouteInfo(routeInfo, 'restaurant');
        }
      });
  } else {
    alert('近くに飲食店が見つかりませんでした。');
  }
}

// 飲食店へのルートを表示
function findRouteToRestaurant(lng, lat) {
  // 現在地がない場合は取得
  if (!currentLocation) {
    getCurrentLocation().then(location => {
      showCurrentLocationMarker(location.longitude, location.latitude);
      showRoute([location.longitude, location.latitude], [lng, lat], 'foot-walking')
        .then(routeInfo => {
          if (routeInfo) {
            updateRouteInfo(routeInfo, 'restaurant');
          }
        });
    }).catch(error => {
      console.error('現在地の取得に失敗しました:', error);
    });
  } else {
    showRoute([currentLocation.longitude, currentLocation.latitude], [lng, lat], 'foot-walking')
      .then(routeInfo => {
        if (routeInfo) {
          updateRouteInfo(routeInfo, 'restaurant');
        }
      });
  }
}

// 最寄り飲食店情報を更新
function updateNearestRestaurantInfo(restaurant, distance) {
  const priceLevel = restaurant.price_level === "N/A" || !restaurant.price_level ? 
    1 : parseInt(restaurant.price_level, 10);
  const rating = restaurant.rating === "N/A" || !restaurant.rating ? 
    '評価なし' : restaurant.rating;
  
  const infoElement = document.getElementById('restaurantDetails');
  infoElement.innerHTML = `
    <div class="restaurant-info">
      <p class="restaurant-name">${restaurant.name}</p>
      <p><strong>距離:</strong> ${distance.toFixed(2)} km</p>
      <p><strong>価格帯:</strong> ${'¥'.repeat(priceLevel)}</p>
      <p><strong>評価:</strong> ${rating} ★</p>
      <p><strong>住所:</strong> ${restaurant.formatted_address || '情報なし'}</p>
      <button onclick="findRouteToRestaurant(${restaurant.geometry.location.lng}, ${restaurant.geometry.location.lat})" class="btn">ルートを検索</button>
      <button onclick="switchToEvacuation(${restaurant.geometry.location.lng}, ${restaurant.geometry.location.lat})" class="btn">この場所から避難所を探す</button>
    </div>
  `;
}

// 経路情報を更新
function updateRouteInfo(routeInfo, type) {
  const infoElement = type === 'restaurant' ? 
    document.getElementById('restaurantDetails') : 
    document.getElementById('shelterDetails');
  
  // 既存の内容を保持
  const existingContent = infoElement.innerHTML;
  
  // 所要時間を分と秒に変換
  const minutes = Math.floor(routeInfo.duration / 60);
  const seconds = Math.floor(routeInfo.duration % 60);
  
  // ルート情報を追加
  const routeInfoHTML = `
    <div class="route-info">
      <p><strong>所要時間:</strong> ${minutes}分${seconds}秒</p>
      <p><strong>距離:</strong> ${(routeInfo.distance / 1000).toFixed(2)} km</p>
    </div>
  `;
  
  // 既存コンテンツの最後にルート情報を追加
  infoElement.innerHTML = existingContent + routeInfoHTML;
}

// 避難所モードに切り替え（指定位置から）
function switchToEvacuation(lng, lat) {
  // 現在地を保存
  currentLocation = {
    longitude: parseFloat(lng),
    latitude: parseFloat(lat)
  };
  
  // 避難所モードに切り替え
  switchMode('evacuation');
  
  // 少し遅延を入れてから現在地を表示（モード切替の処理が完了するのを待つ）
  setTimeout(() => {
    showCurrentLocationMarker(currentLocation.longitude, currentLocation.latitude);
    
    // 最寄りの避難所を検索
    findNearestShelterFromLocation(currentLocation.longitude, currentLocation.latitude);
  }, 500);
}