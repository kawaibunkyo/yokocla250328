// Cesium ionのアクセストークン - 公式サンプルのデフォルトトークンに変更
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc5YzciLCJpZCI6NTc3MzMsImlhdCI6MTYyNzg0NTE4Mn0.XcKpgANiY19MC4bdFUXMVEBToBmBLjJJZV0OvYHNhfY';

// OpenRouteService APIキー
const apiKey = '5b3ce3597851110001cf62483d4f0c5c26f94f3291f93f9de89c0af7';

// グローバル変数
let viewer;
let cityModel;
let buildingsVisible = true;
let currentMode = 'restaurant'; // デフォルトは飲食店モード

// データ格納用
let restaurantData = [];
let shelterData = [];

// エンティティ管理用
let currentLocationEntity = null;
let routeEntity = null;
let nearestPointEntity = null;

// 初期化関数
document.addEventListener('DOMContentLoaded', initialize);

function initialize() {
    console.log('初期化を開始します...');
    
    try {
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
            scene3DOnly: true
        // 現在地を表示
function displayCurrentLocation(longitude, latitude) {
    // 既存の現在地マーカーがあれば削除
    if (currentLocationEntity) {
        viewer.entities.remove(currentLocationEntity);
    // 避難所情報の表示を更新
function updateNearestShelterInfo(shelter) {
    const props = shelter.properties;
    const name = props.P20_002 || '避難所';
    const address = props.P20_003 || '住所不明';
    const level = props.レベル || 1;
    const type = props.種類 || '指定避難所';
    
    const infoElement = document.getElementById('shelterDetails');
    if (infoElement) {
        infoElement.innerHTML = `
            <div class="shelter-info">
                <p class="shelter-name">${name}</p>
                <p><strong>住所:</strong> ${address}</p>
                <p><strong>種類:</strong> ${type}</p>
                <p><strong>レベル:</strong> ${level}</p>
            </div>
        `;
    }
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

// ルートを表示
async function showRoute(start, end, transportMode = 'foot-walking') {
    try {
        console.log(`ルート検索: ${start} から ${end} へ (${transportMode})`);
        
        // ルート検索API URL
        const directionsUrl = `https://api.openrouteservice.org/v2/directions/${transportMode}?api_key=${apiKey}&start=${start[0]},${start[1]}&end=${end[0]},${end[1]}`;
        
        // APIリクエスト
        const response = await fetch(directionsUrl);
        const data = await response.json();
        
        if (!data || !data.features || data.features.length === 0) {
            throw new Error('ルートデータが取得できませんでした');
        }
        
        // ルートのジオメトリを取得
        const routeCoordinates = data.features[0].geometry.coordinates;
        
        // 地形の高さを考慮した3D座標に変換
        const positions = await getElevatedPositions(routeCoordinates);
        
        // 既存のルートを削除
        if (routeEntity) {
            viewer.entities.remove(routeEntity);
        }
        
        // ルートをポリラインで表示
        routeEntity = viewer.entities.add({
            name: '経路',
            polyline: {
                positions: positions,
                width: 10,
                material: new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.2,
                    color: Cesium.Color.RED
                }),
                clampToGround: true
            }
        });
        
        // ルートにカメラを合わせる
        viewer.zoomTo(routeEntity);
        
        console.log('ルートが表示されました');
        
    } catch (error) {
        console.error('ルート検索に失敗しました:', error);
        alert('経路の検索に失敗しました。');
    }
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

// 検索機能の設定
function setupSearchFunctionality() {
    console.log('検索機能を設定します');
    
    const searchBox = document.getElementById('searchBox');
    const searchButton = document.getElementById('searchButton');
    const clearButton = document.getElementById('clearButton');
    
    if (!searchBox || !searchButton || !clearButton) {
        console.warn('検索用のDOM要素が見つかりません');
        return;
    }
    
    // 検索ボタンクリック
    searchButton.addEventListener('click', () => {
        const query = searchBox.value.trim().toLowerCase();
        if (!query) return;
        
        const results = searchInNameAndText(query);
        displaySearchResults(results);
    });
    
    // クリアボタンクリック
    clearButton.addEventListener('click', () => {
        searchBox.value = '';
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) resultsContainer.innerHTML = '';
        displayRestaurantEntities(restaurantData);
    });
    
    // エンターキーでも検索実行
    searchBox.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchButton.click();
        }
    });
    
    console.log('検索機能の設定が完了しました');
}

// 名前とレビューでの検索
function searchInNameAndText(query) {
    if (!query) return [];
    
    return restaurantData.filter(restaurant => {
        if (!restaurant) return false;
        
        const nameMatches = restaurant.name && restaurant.name.toLowerCase().includes(query);
        const reviewsMatch = restaurant.reviews && restaurant.reviews.some(review => 
            review.text && review.text.toLowerCase().includes(query)
        );
        return nameMatches || reviewsMatch;
    });
}

// 検索結果の表示
function displaySearchResults(results) {
    const container = document.getElementById('searchResults');
    if (!container) return;
    
    container.innerHTML = ''; // 既存のデータをクリア
    
    if (results.length === 0) {
        container.innerHTML = '<p>検索結果が見つかりませんでした。</p>';
        return;
    }
    
    // 検索結果を表示
    results.forEach(restaurant => {
        const card = document.createElement('div');
        card.className = 'search-result-card';
        
        // 価格帯の表示
        const priceLevel = restaurant.price_level === "N/A" || !restaurant.price_level ? 1 : parseInt(restaurant.price_level, 10);
        const priceDisplay = '¥'.repeat(priceLevel);
        
        // 評価の表示
        const rating = restaurant.rating === "N/A" || !restaurant.rating ? '-' : restaurant.rating;
        
        card.innerHTML = `
            <p><strong>${restaurant.name}</strong></p>
            <p>${priceDisplay} | ★${rating}</p>
        `;
        
        // クリックイベント
        card.addEventListener('click', () => {
            const lng = restaurant.geometry.location.lng;
            const lat = restaurant.geometry.location.lat;
            
            // カメラをその場所に移動
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(lng, lat, 500),
                orientation: {
                    heading: Cesium.Math.toRadians(0),
                    pitch: Cesium.Math.toRadians(-45),
                    roll: 0
                }
            });
        });
        
        container.appendChild(card);
    });
    
    // 検索結果をマップに表示
    displayRestaurantEntities(results);
}

// 表示をリセット
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

// 画面サイズに合わせてUIを調整
function adjustUIForScreenSize() {
    const isMobile = window.innerWidth < 768;
    const sidePanel = document.getElementById('sidePanel');
    const cesiumContainer = document.getElementById('cesiumContainer');
    
    if (!sidePanel || !cesiumContainer) return;
    
    if (isMobile) {
        // モバイル向けレイアウト
        sidePanel.style.width = '100%';
        sidePanel.style.height = '250px';
        sidePanel.style.bottom = '0';
        sidePanel.style.top = 'auto';
        
        cesiumContainer.style.width = '100%';
        cesiumContainer.style.height = 'calc(100% - 315px)';
        cesiumContainer.style.left = '0';
    } else {
        // デスクトップ向けレイアウト
        sidePanel.style.width = '320px';
        sidePanel.style.height = 'calc(100% - 65px)';
        sidePanel.style.top = '65px';
        sidePanel.style.bottom = 'auto';
        
        cesiumContainer.style.width = 'calc(100% - 320px)';
        cesiumContainer.style.height = 'calc(100% - 65px)';
        cesiumContainer.style.left = '320px';
    }
}
    
    // 現在地をマーカーとして表示
    currentLocationEntity = viewer.entities.add({
        name: '現在地',
        position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 10),
        billboard: {
            image: './img/current-location.png', // 現在地アイコン
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

// 最寄りの飲食店を検索して表示
function findNearestRestaurantFrom(longitude, latitude) {
    // レストランモードに切り替え
    switchMode('restaurant');
    
    // フィルタリング条件の取得
    const minRating = parseFloat(document.getElementById('ratingFilter')?.value || 1);
    const selectedPrices = getSelectedPriceLevels();
    
    // フィルタリング
    const filteredData = restaurantData.filter(item => {
        if (!item || !item.geometry || !item.geometry.location) return false;
        
        const rating = item.rating === "N/A" || !item.rating ? 1 : parseFloat(item.rating);
        const priceLevel = item.price_level === "N/A" || !item.price_level ? 1 : parseInt(item.price_level, 10);
        
        // 評価とフィルタの判定
        const ratingMatch = rating >= minRating;
        const priceMatch = selectedPrices.length === 0 || selectedPrices.includes(priceLevel);
        
        return ratingMatch && priceMatch;
    });
    
    if (filteredData.length === 0) {
        alert('条件に合う飲食店が見つかりませんでした。フィルターを変更してください。');
        return;
    }
    
    // 最寄りの飲食店を検索
    let minDistance = Infinity;
    let nearestRestaurant = null;
    
    filteredData.forEach(restaurant => {
        const restaurantLng = restaurant.geometry.location.lng;
        const restaurantLat = restaurant.geometry.location.lat;
        const distance = calculateDistance(longitude, latitude, restaurantLng, restaurantLat);
        
        if (distance < minDistance) {
            minDistance = distance;
            nearestRestaurant = restaurant;
        }
    });
    
    if (nearestRestaurant) {
        // 前回のルートがあれば削除
        if (routeEntity) {
            viewer.entities.remove(routeEntity);
        }
        
        // 前回の最寄マーカーがあれば削除
        if (nearestPointEntity) {
            viewer.entities.remove(nearestPointEntity);
        }
        
        // 最寄りの飲食店をマーカーで表示
        const restaurantLng = nearestRestaurant.geometry.location.lng;
        const restaurantLat = nearestRestaurant.geometry.location.lat;
        
        nearestPointEntity = viewer.entities.add({
            name: '最寄りの飲食店',
            position: Cesium.Cartesian3.fromDegrees(restaurantLng, restaurantLat, 10),
            billboard: {
                image: './img/restaurant-icon.png', // 飲食店アイコン
                scale: 0.8,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM
            }
        });
        
        // 選択された移動手段を取得
        const transportMode = getTransportMode();
        
        // ルートを表示
        showRoute([longitude, latitude], [restaurantLng, restaurantLat], transportMode);
        
        // 結果をポップアップ表示
        alert(`最寄りの飲食店: ${nearestRestaurant.name}\n距離: 約${(minDistance * 1000).toFixed(0)}m`);
    } else {
        alert('近くに飲食店が見つかりませんでした。');
    }
}

// 最寄りの避難所を検索して表示
function findNearestShelterFrom(longitude, latitude) {
    // 避難所モードに切り替え
    switchMode('shelter');
    
    // フィルタリング条件の取得
    const selectedTypes = getSelectedShelterTypes();
    const minLevel = parseInt(document.getElementById('levelFilter')?.value || 1);
    
    // フィルタリング
    const filteredShelters = shelterData.filter(shelter => {
        if (!shelter || !shelter.geometry || !shelter.properties) return false;
        
        const type = shelter.properties.種類 || '指定避難所';
        const level = shelter.properties.レベル || 1;
        
        return selectedTypes.includes(type) && level >= minLevel;
    });
    
    if (filteredShelters.length === 0) {
        alert('条件に合う避難所が見つかりませんでした。フィルターを変更してください。');
        return;
    }
    
    // 最寄りの避難所を検索
    let minDistance = Infinity;
    let nearestShelter = null;
    
    filteredShelters.forEach(shelter => {
        const shelterLng = shelter.geometry.coordinates[0];
        const shelterLat = shelter.geometry.coordinates[1];
        const distance = calculateDistance(longitude, latitude, shelterLng, shelterLat);
        
        if (distance < minDistance) {
            minDistance = distance;
            nearestShelter = shelter;
        }
    });
    
    if (nearestShelter) {
        // 前回のルートがあれば削除
        if (routeEntity) {
            viewer.entities.remove(routeEntity);
        }
        
        // 前回の最寄マーカーがあれば削除
        if (nearestPointEntity) {
            viewer.entities.remove(nearestPointEntity);
        }
        
        // 最寄りの避難所をマーカーで表示
        const shelterLng = nearestShelter.geometry.coordinates[0];
        const shelterLat = nearestShelter.geometry.coordinates[1];
        
        nearestPointEntity = viewer.entities.add({
            name: '最寄りの避難所',
            position: Cesium.Cartesian3.fromDegrees(shelterLng, shelterLat, 10),
            billboard: {
                image: './img/shelter-icon.png', // 避難所アイコン
                scale: 0.8,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM
            }
        });
        
        // 避難所詳細を表示
        updateNearestShelterInfo(nearestShelter);
        
        // 選択された移動手段を取得
        const transportMode = getTransportMode();
        
        // ルートを表示
        showRoute([longitude, latitude], [shelterLng, shelterLat], transportMode);
    } else {
        alert('近くに避難所が見つかりませんでした。');
    }
});
        
        console.log('Cesium Viewerが初期化されました');

        // 航空写真の追加
        viewer.imageryLayers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({
                url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
                maximumLevel: 19,
            })
        );
        
        console.log('航空写真レイヤーが追加されました');

        // デバッグ用マーカーを追加
        viewer.entities.add({
            name: 'デバッグマーカー',
            position: Cesium.Cartesian3.fromDegrees(139.6300, 35.3500, 0),
            point: {
                pixelSize: 10,
                color: Cesium.Color.RED
            }
        });

        // 初期カメラ位置設定
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(139.6300, 35.3500, 7000.0),
            orientation: {
                heading: Cesium.Math.toRadians(0.0),
                pitch: Cesium.Math.toRadians(-30.0),
                roll: 0.0
            }
        });
        
        console.log('カメラ位置が設定されました');

        // 3D Tilesデータの参照（PLATEAU - 建物データ）- エラーになる場合はコメントアウト
        try {
            cityModel = viewer.scene.primitives.add(
                new Cesium.Cesium3DTileset({
                    url: 'https://plateau.geospatial.jp/main/data/3d-tiles/bldg/14100_yokohama/low_resolution/tileset.json',
                })
            );
            console.log('3D建物モデルが追加されました');
        } catch (error) {
            console.error('3D建物データの読み込みに失敗しました:', error);
        }

        // イベントリスナー設定
        setupEventListeners();
        
        // レスポンシブ対応
        adjustUIForScreenSize();
        window.addEventListener('resize', adjustUIForScreenSize);
        
        // データ読み込み
        loadDataSources();
        
    } catch (error) {
        console.error('初期化中にエラーが発生しました:', error);
        alert('地図の初期化に失敗しました。詳細はコンソールを確認してください。');
    }
}

// データソース読み込み
async function loadDataSources() {
    try {
        console.log('データの読み込みを開始します...');
        
        // ダミーデータの初期設定
        initializeDummyData();
        
        try {
            // 飲食店データの読み込み
            const restaurantResponse = await fetch('yokohama_restaurant_1000_1km_2_1000.json');
            const restaurantJson = await restaurantResponse.json();
            restaurantData = restaurantJson;
            console.log('飲食店データを読み込みました');
        } catch (error) {
            console.warn('飲食店データの読み込みに失敗しました、ダミーデータを使用します:', error);
        }
        
        try {
            // 避難所データの読み込み
            const shelterResponse = await fetch('./hinanjyo.geojson');
            const shelterGeoJson = await shelterResponse.json();
            shelterData = shelterGeoJson.features;
            console.log('避難所データを読み込みました');
        } catch (error) {
            console.warn('避難所データの読み込みに失敗しました、ダミーデータを使用します:', error);
        }
        
        // 初期表示（レストランモード）
        displayRestaurantEntities(restaurantData);
        
        // フィルターの初期設定
        setupFilteringUI();
        
        console.log('データの読み込みが完了しました');
    } catch (error) {
        console.error('データの読み込みプロセスでエラーが発生しました:', error);
        alert('データの読み込みに失敗しました。ダミーデータを使用します。');
        
        // エラー時にはダミーデータを表示
        displayRestaurantEntities(restaurantData);
    }
}

// ダミーデータの初期化
function initializeDummyData() {
    // ダミーのレストランデータ
    restaurantData = [
        {
            name: "テスト飲食店1",
            rating: 4.5,
            price_level: 2,
            formatted_address: "横浜市西区みなとみらい1-1-1",
            formatted_phone_number: "045-123-4567",
            website: "https://example.com",
            user_ratings_total: 120,
            geometry: {
                location: {
                    lat: 35.451,
                    lng: 139.631
                }
            }
        },
        {
            name: "テスト飲食店2",
            rating: 3.8,
            price_level: 3,
            formatted_address: "横浜市西区みなとみらい2-2-2",
            formatted_phone_number: "045-987-6543",
            website: "https://example2.com",
            user_ratings_total: 85,
            geometry: {
                location: {
                    lat: 35.453,
                    lng: 139.633
                }
            }
        }
    ];
    
    // ダミーの避難所データ
    shelterData = [
        {
            geometry: {
                coordinates: [139.629, 35.449]
            },
            properties: {
                P20_002: "テスト避難所1",
                P20_003: "横浜市西区みなとみらい3-3-3",
                レベル: 3,
                種類: "指定避難所"
            }
        },
        {
            geometry: {
                coordinates: [139.636, 35.455]
            },
            properties: {
                P20_002: "テスト避難所2",
                P20_003: "横浜市西区みなとみらい4-4-4",
                レベル: 4,
                種類: "広域避難場所"
            }
        }
    ];
    
    console.log('ダミーデータが初期化されました');
}

// モード切替
function switchMode(mode) {
    console.log(`モードを ${mode} に切り替えます`);
    currentMode = mode;
    
    // ボディクラスの切り替え
    if (mode === 'restaurant') {
        document.body.classList.remove('shelter-view');
        document.body.classList.add('restaurant-view');
    } else {
        document.body.classList.remove('restaurant-view');
        document.body.classList.add('shelter-view');
    }
    
    // パネルの切り替え
    document.querySelectorAll('.mode-panel').forEach(panel => panel.classList.remove('active'));
    document.getElementById(mode + 'Panel').classList.add('active');
    
    // 凡例の切り替え
    document.querySelectorAll('.mode-legend').forEach(legend => legend.classList.remove('active'));
    document.getElementById(mode + 'Legend').classList.add('active');
    
    // ナビゲーションリンクの切り替え
    document.querySelectorAll('nav a').forEach(link => link.classList.remove('active'));
    document.getElementById(mode + '-mode').classList.add('active');
    
    // 地図データの切り替え
    clearMapEntities();
    
    if (mode === 'restaurant') {
        displayRestaurantEntities(restaurantData);
    } else {
        displayShelterEntities(shelterData);
    }
}

// 地図エンティティクリア
function clearMapEntities() {
    viewer.entities.removeAll();
    
    // ルートエンティティやマーカーのリセット
    currentLocationEntity = null;
    routeEntity = null;
    nearestPointEntity = null;
}

// 飲食店エンティティの表示
function displayRestaurantEntities(data) {
    console.log('飲食店データを表示します', data?.length || 0);
    
    // 既存のエンティティをクリア
    clearMapEntities();
    
    // データがない場合
    if (!data || data.length === 0) {
        console.warn('表示する飲食店データがありません');
        return;
    }
    
    // フィルタリング条件の取得
    const minRating = parseFloat(document.getElementById('ratingFilter')?.value || 1);
    const selectedPrices = getSelectedPriceLevels();
    
    // フィルタリング
    const filteredData = data.filter(item => {
        if (!item || !item.geometry || !item.geometry.location) return false;
        
        const rating = item.rating === "N/A" || !item.rating ? 1 : parseFloat(item.rating);
        const priceLevel = item.price_level === "N/A" || !item.price_level ? 1 : parseInt(item.price_level, 10);
        
        // 評価とフィルタの判定
        const ratingMatch = rating >= minRating;
        const priceMatch = selectedPrices.length === 0 || selectedPrices.includes(priceLevel);
        
        return ratingMatch && priceMatch;
    });
    
    console.log('フィルター後の飲食店データ:', filteredData.length);
    
    // エンティティ表示
    filteredData.forEach(item => {
        // 評価に基づいて高さを変更（評価が高いほど高い）
        const baseHeight = 20; // 基本の高さ
        const ratingMultiplier = 100; // 評価1つあたりの高さ
        
        // 評価の取得と正規化（1〜5の範囲に）
        const rating = item.rating === "N/A" || !item.rating ? 1 : Math.min(Math.max(parseFloat(item.rating), 1), 5);
        
        // 高さの計算（評価1なら50、評価5なら250）
        const height = baseHeight + (rating - 1) * ratingMultiplier;
        
        // 価格帯の取得と正規化
        const priceLevel = item.price_level === "N/A" || !item.price_level ? 1 : Math.min(Math.max(parseInt(item.price_level, 10), 1), 4);
        
        // 価格帯に基づいた色相の計算（安い：緑、高い：赤）
        const hue = 120 - ((priceLevel - 1) / 3) * 120; // 120（緑）から0（赤）へ
        const saturation = 60; // 彩度は固定
        const lightness = 50; // 明度も固定
        
        // HSL色の作成
        const colorHSL = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        
        // エンティティの説明（情報ウィンドウの内容）
        const description = `
            <table>
                <tr>
                    <th>店名</th>
                    <td>${item.name}</td>
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
                    <th>Webサイト</th>
                    <td><a href="${item.website || '#'}" target="_blank">${item.website || '情報なし'}</a></td>
                </tr>
                <tr>
                    <th>評価件数</th>
                    <td>${item.user_ratings_total || '0'}</td>
                </tr>
                <tr>
                    <th>アクション</th>
                    <td><button class="find-shelter-btn" data-lat="${item.geometry.location.lat}" data-lng="${item.geometry.location.lng}">近くの避難所を探す</button></td>
                </tr>
            </table>
        `;
        
        // エンティティとして3D四角柱を追加
        viewer.entities.add({
            name: item.name,
            description: description,
            position: Cesium.Cartesian3.fromDegrees(
                item.geometry.location.lng,
                item.geometry.location.lat,
                height / 2  // 高さの半分を中心位置に設定
            ),
            box: {
                dimensions: new Cesium.Cartesian3(10, 10, height), // 幅・奥行きは固定、高さは評価による
                material: new Cesium.Color.fromCssColorString(colorHSL), // 価格帯に基づく色
                outline: true,
                outlineColor: Cesium.Color.BLACK
            },
            properties: {
                isRestaurant: true,
                latitude: item.geometry.location.lat,
                longitude: item.geometry.location.lng,
                rating: rating,
                priceLevel: priceLevel,
                originalData: item
            }
        });
    });
    
    // イベントリスナーの設定
    setupInfoBoxEventListeners();
}

// 避難所エンティティの表示
function displayShelterEntities(shelters) {
    console.log('避難所データを表示します', shelters?.length || 0);
    
    // 既存のエンティティをクリア
    clearMapEntities();
    
    // データがない場合
    if (!shelters || shelters.length === 0) {
        console.warn('表示する避難所データがありません');
        return;
    }
    
    // フィルタリング条件の取得
    const selectedTypes = getSelectedShelterTypes();
    const minLevel = parseInt(document.getElementById('levelFilter')?.value || 1);
    
    // フィルタリング
    const filteredShelters = shelters.filter(shelter => {
        if (!shelter || !shelter.geometry || !shelter.properties) return false;
        
        const type = shelter.properties.種類 || '指定避難所';
        const level = shelter.properties.レベル || 1;
        
        return selectedTypes.includes(type) && level >= minLevel;
    });
    
    console.log('フィルター後の避難所データ:', filteredShelters.length);
    
    // 各避難所のエンティティを作成
    filteredShelters.forEach(shelter => {
        const coords = shelter.geometry.coordinates;
        const props = shelter.properties;
        
        // レベルや種類を取得（ない場合はデフォルト値）
        const level = props.レベル || 1;
        const type = props.種類 || '指定避難所';
        
        // 高さは避難所のレベルに基づいて設定
        const height = level * 100;
        
        // 避難所の種類に基づいて色を設定
        let color;
        switch(type) {
            case '指定避難所':
                color = Cesium.Color.GREEN;
                break;
            case '広域避難場所':
                color = Cesium.Color.BLUE;
                break;
            case '一時避難場所':
                color = Cesium.Color.YELLOW;
                break;
            default:
                color = Cesium.Color.ORANGE;
        }
        
        // 避難所名を取得
        const name = props.P20_002 || '避難所';
        const address = props.P20_003 || '';
        
        // HTML説明内容
        const description = `
            <table>
                <tr>
                    <th>避難所名</th>
                    <td>${name}</td>
                </tr>
                <tr>
                    <th>住所</th>
                    <td>${address}</td>
                </tr>
                <tr>
                    <th>レベル</th>
                    <td>${level}</td>
                </tr>
                <tr>
                    <th>種類</th>
                    <td>${type}</td>
                </tr>
                <tr>
                    <th>アクション</th>
                    <td><button class="find-restaurant-btn" data-lat="${coords[1]}" data-lng="${coords[0]}">近くの飲食店を探す</button></td>
                </tr>
            </table>
        `;
        
        // エンティティの作成
        viewer.entities.add({
            name: name,
            description: description,
            position: Cesium.Cartesian3.fromDegrees(coords[0], coords[1], height/2),
            box: {
                dimensions: new Cesium.Cartesian3(50, 50, height),
                material: color.withAlpha(0.7),
                outline: true,
                outlineColor: Cesium.Color.BLACK
            },
            properties: {
                isShelter: true,
                latitude: coords[1],
                longitude: coords[0],
                shelterType: type,
                shelterLevel: level,
                shelterAddress: address,
                originalShelter: shelter
            }
        });
    });
    
    // イベントリスナーの設定
    setupInfoBoxEventListeners();
}

// 選択された避難所タイプを取得
function getSelectedShelterTypes() {
    const checkboxes = document.querySelectorAll('input[name="shelterType"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// 選択された価格帯レベルを取得
function getSelectedPriceLevels() {
    const checkboxes = document.querySelectorAll('input[name="priceLevel"]:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.value, 10));
}

// 選択された移動手段を取得
function getTransportMode() {
    const modeRadio = document.querySelector('input[name="transportMode"]:checked');
    return modeRadio ? modeRadio.value : 'foot-walking';
}

// フィルタリングUIの初期設定
function setupFilteringUI() {
    console.log('フィルタリングUIを設定します');
    
    try {
        // レストランモードのフィルター
        const ratingSlider = document.getElementById('ratingFilter');
        if (ratingSlider) {
            ratingSlider.addEventListener('input', () => {
                const ratingValue = document.getElementById('ratingValue');
                if (ratingValue) ratingValue.textContent = ratingSlider.value;
                
                if (currentMode === 'restaurant') {
                    displayRestaurantEntities(restaurantData);
                }
            });
        }
        
        // 価格帯チェックボックス
        document.querySelectorAll('input[name="priceLevel"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                if (currentMode === 'restaurant') {
                    displayRestaurantEntities(restaurantData);
                }
            });
        });
        
        // 避難所モードのフィルター
        const levelSlider = document.getElementById('levelFilter');
        if (levelSlider) {
            levelSlider.addEventListener('input', () => {
                const levelValue = document.getElementById('levelValue');
                if (levelValue) levelValue.textContent = levelSlider.value;
                
                if (currentMode === 'shelter') {
                    displayShelterEntities(shelterData);
                }
            });
        }
        
        // 避難所タイプチェックボックス
        document.querySelectorAll('input[name="shelterType"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                if (currentMode === 'shelter') {
                    displayShelterEntities(shelterData);
                }
            });
        });
        
        console.log('フィルタリングUIの設定が完了しました');
    } catch (error) {
        console.error('フィルタリングUI設定中にエラーが発生しました:', error);
    }
}

// インフォボックスのイベントリスナー設定
function setupInfoBoxEventListeners() {
    try {
        console.log('インフォボックスのイベントリスナーを設定します');
        
        // Cesiumのinfobox内のDOMが変更されたときに呼ばれるイベントリスナーを設定
        const observer = new MutationObserver(mutations => {
            // 情報ウィンドウ内のボタンにイベントリスナーを追加
            const findShelterBtns = document.querySelectorAll('.find-shelter-btn');
            findShelterBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const lat = parseFloat(e.target.getAttribute('data-lat'));
                    const lng = parseFloat(e.target.getAttribute('data-lng'));
                    findNearestShelterFrom(lng, lat);
                });
            });
            
            const findRestaurantBtns = document.querySelectorAll('.find-restaurant-btn');
            findRestaurantBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const lat = parseFloat(e.target.getAttribute('data-lat'));
                    const lng = parseFloat(e.target.getAttribute('data-lng'));
                    findNearestRestaurantFrom(lng, lat);
                });
            });
        });
        
        // infoBox内のiframeを監視
        const infoBoxFrame = document.querySelector('.cesium-infoBox-iframe');
        if (infoBoxFrame) {
            try {
                const contentDoc = infoBoxFrame.contentDocument || infoBoxFrame.contentWindow?.document;
                if (contentDoc) {
                    observer.observe(contentDoc, {
                        childList: true,
                        subtree: true
                    });
                    console.log('インフォボックスのDOMを監視しています');
                } else {
                    console.warn('インフォボックスのドキュメントにアクセスできませんでした');
                }
            } catch (error) {
                console.error('インフォボックスの監視設定中にエラーが発生しました:', error);
            }
        } else {
            console.warn('インフォボックスのiframeが見つかりませんでした');
        }
    } catch (error) {
        console.error('インフォボックスイベントリスナー設定中にエラーが発生しました:', error);
    }
}

// イベントリスナーのセットアップ
function setupEventListeners() {
    console.log('イベントリスナーを設定します...');
    
    try {
        // モード切替イベント
        document.getElementById('restaurant-mode')?.addEventListener('click', (e) => {
            e.preventDefault();
            switchMode('restaurant');
        });
        
        document.getElementById('shelter-mode')?.addEventListener('click', (e) => {
            e.preventDefault();
            switchMode('shelter');
        });
        
        // 現在地取得ボタン - レストランモード
        document.getElementById('getCurrentLocationRestaurant')?.addEventListener('click', getCurrentLocationRestaurant);
        
        // 現在地取得ボタン - 避難所モード
        document.getElementById('getCurrentLocationShelter')?.addEventListener('click', getCurrentLocationShelter);
        
        // 飲食店から最寄避難所ボタン
        document.getElementById('findNearestShelterFromRestaurant')?.addEventListener('click', () => {
            if (currentLocationEntity) {
                // 現在地から最寄りの避難所を探す
                const currPos = currentLocationEntity.position.getValue(Cesium.JulianDate.now());
                const cart = Cesium.Cartographic.fromCartesian(currPos);
                const lon = Cesium.Math.toDegrees(cart.longitude);
                const lat = Cesium.Math.toDegrees(cart.latitude);
                
                findNearestShelterFrom(lon, lat);
            } else {
                getCurrentLocationShelter();
            }
        });
        
        // 避難所から最寄飲食店ボタン
        document.getElementById('findNearestRestaurantFromShelter')?.addEventListener('click', () => {
            if (currentLocationEntity) {
                // 現在地から最寄りの飲食店を探す
                const currPos = currentLocationEntity.position.getValue(Cesium.JulianDate.now());
                const cart = Cesium.Cartographic.fromCartesian(currPos);
                const lon = Cesium.Math.toDegrees(cart.longitude);
                const lat = Cesium.Math.toDegrees(cart.latitude);
                
                findNearestRestaurantFrom(lon, lat);
            } else {
                getCurrentLocationRestaurant();
            }
        });
        
        // 建物表示切替ボタン
        document.getElementById('toggleBuildingsBtn')?.addEventListener('click', toggleBuildingsVisibility);
        
        // 表示リセットボタン
        document.getElementById('resetViewBtn')?.addEventListener('click', resetView);
        
        // 検索機能のセットアップ
        setupSearchFunctionality();
        
        console.log('イベントリスナーが正常に設定されました');
    } catch (error) {
        console.error('イベントリスナー設定中にエラーが発生しました:', error);
    }
}

// 現在地から最寄りの飲食店を検索
function getCurrentLocationRestaurant() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const longitude = position.coords.longitude;
                const latitude = position.coords.latitude;
                
                console.log(`現在地取得成功: 経度=${longitude}, 緯度=${latitude}`);
                
                // 現在地を表示
                displayCurrentLocation(longitude, latitude);
                
                // 最寄りの飲食店を検索
                findNearestRestaurantFrom(longitude, latitude);
            },
            error => {
                console.error('位置情報の取得に失敗しました:', error);
                alert('位置情報を取得できませんでした。位置情報の使用を許可してください。');
            }
        );
    } else {
        alert('このブラウザはGeolocationをサポートしていません');
    }
}

// 現在地から最寄りの避難所を検索
function getCurrentLocationShelter() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const longitude = position.coords.longitude;
                const latitude = position.coords.latitude;
                
                console.log(`現在地取得成功: 経度=${longitude}, 緯度=${latitude}`);
                
                // 現在地を表示
                displayCurrentLocation(longitude, latitude);
                
                // 最寄りの避難所を検索
                findNearestShelterFrom(longitude, latitude);
            },
            error => {
                console.error('位置情報の取得に失敗しました:', error);
                alert('位置情報を取得できませんでした。位置情報の使用を許可してください。');
            }
        );
    } else {
        alert('このブラウザはGeolocationをサポートしていません');
    }
}