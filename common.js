// グローバル変数
let viewer = null;
let currentMode = 'restaurant'; // 'restaurant' または 'evacuation'
let cityModel = null;
let buildingsVisible = true;
let currentLocation = null;

// Cesium ionのアクセストークン
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5N2UyMjcwOS00MDY1LTQxYjEtYjZjMy00YTU0ZTg5MmViYWQiLCJpZCI6ODAzMDYsImlhdCI6MTY0Mjc0ODI2MX0.dkwAL1CcljUV7NA7fDbhXXnmyZQU_c-G5zRx8PtEcxE';

// 初期化関数
function initializeCesium() {
  // Cesium Viewerの初期化
  viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: Cesium.createWorldTerrain(),
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    vrButton: false,
    homeButton: true,
    infoBox: true,
    sceneModePicker: false,
    selectionIndicator: true,
    timeline: false,
    navigationHelpButton: false,
    scene3DOnly: true,
    skyBox: false,
    skyAtmosphere: false, // 大気効果をオフ
  });

  try {
    console.log('地図の背景画像を設定します');
    
    // デフォルトの航空写真レイヤーを削除
    viewer.imageryLayers.removeAll();
    
// 標準地図を追加（航空写真）
viewer.imageryLayers.addImageryProvider(
  new Cesium.UrlTemplateImageryProvider({
    url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
    maximumLevel: 18,
    credit: '地理院タイル'
  })
);
    
    console.log('地図の背景画像を設定しました');
  } catch (error) {
    console.error('地図の背景画像設定中にエラーが発生しました:', error);
  }

  try {
    console.log('3D建物データを読み込みます');
    
    // 3D Tilesデータの参照（PLATEAU - 建物データ）
    cityModel = viewer.scene.primitives.add(
      new Cesium.Cesium3DTileset({
        url: 'https://plateau.geospatial.jp/main/data/3d-tiles/bldg/14100_yokohama/low_resolution/tileset.json',
      })
    );
    
    // 読み込みが完了したら報告
    cityModel.readyPromise.then(() => {
      console.log('3D建物データの読み込みが完了しました');
    }).catch(error => {
      console.error('3D建物データの読み込みに失敗しました:', error);
    });
    
  } catch (error) {
    console.error('3D建物データの設定中にエラーが発生しました:', error);
  }

  // 初期視点を設定
  resetView();
}

// 視点をリセットする
function resetView() {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(139.6300, 35.3500, 7000.0),
    orientation: {
      heading: Cesium.Math.toRadians(0.0),
      pitch: Cesium.Math.toRadians(-30.0),
      roll: 0.0
    }
  });
}

// 現在地を取得
function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const longitude = position.coords.longitude;
          const latitude = position.coords.latitude;
          
          // 現在地を保存
          currentLocation = {
            longitude,
            latitude
          };
          
          resolve(currentLocation);
        },
        error => {
          console.error('位置情報の取得に失敗しました:', error);
          alert('位置情報を取得できませんでした。位置情報の使用を許可してください。');
          reject(error);
        }
      );
    } else {
      alert('このブラウザはGeolocationをサポートしていません');
      reject(new Error('Geolocation not supported'));
    }
  });
}

// 現在地マーカーを表示
function showCurrentLocationMarker(longitude, latitude) {
  // 既存の現在地マーカーがあれば削除
  removeEntityByName('現在地');
  
  // 現在地をマーカーとして表示
  viewer.entities.add({
    name: '現在地',
    position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 10),
    billboard: {
      image: './img/current-location.png', // 現在地アイコン（画像ファイルが必要）
      scale: 0.5,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM
    }
  });
  
  // カメラを現在地に移動
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, 1000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-45),
      roll: 0
    }
  });
}

// 緯度経度間の距離計算（ハバーサイン公式）
function calculateDistance(lon1, lat1, lon2, lat2) {
  const R = 6371; // 地球の半径（km）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance;
}

// 指定した名前のエンティティを削除
function removeEntityByName(name) {
  const entities = viewer.entities.values;
  for (let i = 0; i < entities.length; i++) {
    if (entities[i].name === name) {
      viewer.entities.remove(entities[i]);
      break;
    }
  }
}

// 地形の高さを取得
function getTerrainHeight(longitude, latitude) {
  return new Promise((resolve) => {
    const terrainProvider = viewer.terrainProvider;
    const cartographic = Cesium.Cartographic.fromDegrees(longitude, latitude);
    
    // 地形の高さをサンプリング
    const promise = Cesium.sampleTerrainMostDetailed(terrainProvider, [cartographic]);
    Promise.resolve(promise)
      .then((updatedPositions) => {
        resolve(updatedPositions[0].height);
      })
      .catch(() => {
        resolve(0); // エラー時は高さ0とする
      });
  });
}

// 地形の高さを考慮した3D座標に変換
async function getElevatedPositions(coordinates) {
  const positions = [];
  
  // 各座標の高度を地形に基づいて取得
  for (let i = 0; i < coordinates.length; i++) {
    const [longitude, latitude] = coordinates[i];
    
    // Cesiumの地形から高さを取得
    const height = await getTerrainHeight(longitude, latitude);
    
    // 地表から2m上の高さに設定（見やすさのため）
    positions.push(Cesium.Cartesian3.fromDegrees(longitude, latitude, height + 2));
  }
  
  return positions;
}

// ルートを表示
async function showRoute(start, end, transportMode = 'foot-walking') {
  // 既存のルートがあれば削除
  removeEntityByName('避難経路');
  removeEntityByName('飲食店経路');
  
  // APIキー
  const apiKey = '5b3ce3597851110001cf62483d4f0c5c26f94f3291f93f9de89c0af7'; // OpenRouteService APIキー
  
  try {
    console.log(`経路を検索します: 開始点(${start[0]}, ${start[1]}) → 終了点(${end[0]}, ${end[1]})`);
    
    // ルート検索API URL
    const directionsUrl = `https://api.openrouteservice.org/v2/directions/${transportMode}?api_key=${apiKey}&start=${start[0]},${start[1]}&end=${end[0]},${end[1]}`;
    
    // APIリクエスト
    const response = await fetch(directionsUrl);
    if (!response.ok) {
      throw new Error(`HTTP エラー: ${response.status}`);
    }
    
    const data = await response.json();
    
    // レスポンスを確認
    if (!data.features || data.features.length === 0) {
      throw new Error('経路が見つかりませんでした');
    }
    
    // ルートのジオメトリを取得
    const routeCoordinates = data.features[0].geometry.coordinates;
    console.log(`経路のポイント数: ${routeCoordinates.length}`);
    
    // 地形の高さを考慮した3D座標に変換
    const positions = await getElevatedPositions(routeCoordinates);
    
    // モードに応じたルート名
    const routeName = currentMode === 'evacuation' ? '避難経路' : '飲食店経路';
    const routeColor = currentMode === 'evacuation' ? Cesium.Color.RED : Cesium.Color.DODGERBLUE;
    
    // ルートをポリラインで表示
    viewer.entities.add({
      name: routeName,
      polyline: {
        positions: positions,
        width: 10,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: routeColor
        }),
        clampToGround: true
      }
    });
    
    // 所要時間と距離を取得
    const duration = data.features[0].properties.summary.duration;
    const distance = data.features[0].properties.summary.distance;
    
    console.log(`経路を表示しました: 所要時間=${duration}秒, 距離=${distance}メートル`);
    
    // ルート情報を返す
    return {
      duration: duration,
      distance: distance
    };
    
  } catch (error) {
    console.error('ルート検索に失敗しました:', error);
    alert('経路検索に失敗しました: ' + error.message);
    return null;
  }
}

// 建物の表示/非表示を切り替え
function toggleBuildingsVisibility() {
  if (cityModel) {
    buildingsVisible = !buildingsVisible;
    cityModel.show = buildingsVisible;
    
    // ボタンテキストを更新
    const toggleBtn = document.getElementById('toggleBuildingsBtn');
    if (toggleBtn) {
      toggleBtn.textContent = buildingsVisible ? '建物表示オフ' : '建物表示オン';
    }
  }
}

// モードを切り替え
function switchMode(mode) {
  // 現在のモードを更新
  currentMode = mode;
  
  // UI要素の表示/非表示を切り替え
  const restaurantElements = [
    document.getElementById('restaurantSideMenu'),
    document.getElementById('restaurantLegend')
  ];
  
  const evacuationElements = [
    document.getElementById('evacuationSideMenu'),
    document.getElementById('evacuationLegend')
  ];
  
  // ナビゲーションのアクティブスタイル更新
  const restaurantModeEl = document.getElementById('restaurant-mode');
  const evacuationModeEl = document.getElementById('evacuation-mode');
  
  if (restaurantModeEl) restaurantModeEl.classList.toggle('active', mode === 'restaurant');
  if (evacuationModeEl) evacuationModeEl.classList.toggle('active', mode === 'evacuation');
  
  // モード表示の更新
  const modeIndicatorEl = document.getElementById('modeIndicator');
  if (modeIndicatorEl) {
    modeIndicatorEl.textContent = mode === 'restaurant' ? '飲食店モード' : '避難所モード';
  }
  
  // サイドメニューと凡例の切り替え
  restaurantElements.forEach(el => {
    if (el) el.style.display = mode === 'restaurant' ? 'block' : 'none';
  });
  
  evacuationElements.forEach(el => {
    if (el) el.style.display = mode === 'evacuation' ? 'block' : 'none';
  });
  
  // ページタイトルを更新
  const pageTitleEl = document.getElementById('pageTitle');
  if (pageTitleEl) {
    pageTitleEl.textContent = mode === 'restaurant' ? '横浜駅周辺飲食店マップ' : '横浜駅周辺避難所マップ';
  }
  
  // エンティティをクリア
  viewer.entities.removeAll();
  
  // モードに応じたデータ読み込み
  if (mode === 'restaurant') {
    loadRestaurantData();
  } else {
    loadShelterData();
  }
}

// 画面サイズに合わせてUIを調整
function adjustUIForScreenSize() {
  const isMobile = window.innerWidth < 768;
  const sideMenus = document.querySelectorAll('.side-menu');
  const cesiumContainer = document.getElementById('cesiumContainer');
  
  if (isMobile) {
    sideMenus.forEach(menu => {
      menu.style.width = '100%';
      menu.style.height = '250px';
      menu.style.bottom = '0';
      menu.style.top = 'auto';
    });
    
    cesiumContainer.style.width = '100%';
    cesiumContainer.style.height = 'calc(100% - 310px)';
    cesiumContainer.style.left = '0';
  } else {
    sideMenus.forEach(menu => {
      menu.style.width = '300px';
      menu.style.height = 'calc(100% - 60px)';
      menu.style.top = '60px';
      menu.style.bottom = 'auto';
    });
    
    cesiumContainer.style.width = 'calc(100% - 300px)';
    cesiumContainer.style.height = 'calc(100% - 60px)';
    cesiumContainer.style.left = '300px';
  }
}
