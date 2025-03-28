// 避難所モード用のグローバル変数
let shelterData = [];
let nearestShelterEntity = null;
let selectedShelterTypes = ['指定避難所', '広域避難場所', '一時避難場所'];
let minimumShelterLevel = 1;

// 避難所データの読み込み
function loadShelterData() {
  // エンティティをクリア
  viewer.entities.removeAll();
  
  // GeoJSONファイルの読み込み
  fetch('./hinanjyo.geojson')
    .then(response => response.json())
    .then(data => {
      shelterData = data.features;
      
      // 避難所を表示
      displayShelters(shelterData);
      
      // フィルターのセットアップ
      setupShelterFilteringUI();
    })
    .catch(error => {
      console.error('避難所データの読み込みに失敗しました:', error);
    });
}

// 避難所を四角柱で表示
function displayShelters(shelters) {
  shelters.forEach(shelter => {
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
    const address = props.P20_003 || '住所不明';
    
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
        </table>
        <button onclick="findRouteToShelter(${coords[0]}, ${coords[1]})">ここへのルートを表示</button>
        <button onclick="switchToRestaurant(${coords[0]}, ${coords[1]})">この場所から飲食店を探す</button>
    `;
    
    // プロパティを設定
    const shelterProperties = {
      isEvacuationShelter: true,
      shelterType: type,
      shelterLevel: level,
      shelterAddress: address
    };
    
    // 避難所エンティティの作成
    const entity = viewer.entities.add({
      name: name,
      description: description,
      position: Cesium.Cartesian3.fromDegrees(coords[0], coords[1], height/2),
      box: {
        dimensions: new Cesium.Cartesian3(20, 20, height),
        material: color.withAlpha(0.7),
        outline: true,
        outlineColor: Cesium.Color.BLACK
      },
      properties: shelterProperties
    });
    
    // 元の避難所データへの参照を保持
    entity.originalShelter = shelter;
  });
}

// 避難所フィルターのセットアップ
function setupShelterFilteringUI() {
  // 避難所タイプのチェックボックス
  document.querySelectorAll('input[name="shelterType"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      // 選択された避難所タイプを更新
      selectedShelterTypes = Array.from(document.querySelectorAll('input[name="shelterType"]:checked'))
        .map(cb => cb.value);
        
      // フィルターを適用
      updateShelterFilters();
    });
  });
  
  // レベルフィルターのスライダー
  const levelSlider = document.getElementById('levelFilter');
  if (levelSlider) {
    levelSlider.addEventListener('input', () => {
      document.getElementById('levelValue').textContent = levelSlider.value;
      minimumShelterLevel = parseInt(levelSlider.value, 10);
      updateShelterFilters();
    });
  }
  
  // 建物表示切替ボタン
  document.getElementById('toggleBuildingsBtn').addEventListener('click', toggleBuildingsVisibility);
  
  // 現在地取得ボタン
  document.getElementById('getCurrentLocationEvacBtn').addEventListener('click', () => {
    getCurrentLocation().then(location => {
      showCurrentLocationMarker(location.longitude, location.latitude);
      findNearestShelterFromLocation(location.longitude, location.latitude);
    });
  });
  
  // 表示リセットボタン
  document.getElementById('resetViewEvacBtn').addEventListener('click', resetView);
  
  // 飲食店モードへの切り替えボタン
  document.getElementById('switchToRestaurantBtn').addEventListener('click', () => {
    switchMode('restaurant');
  });
}

// 避難所フィルターの更新と適用
function updateShelterFilters() {
  // 全エンティティをフィルタリング
  viewer.entities.values.forEach(entity => {
    // 避難所エンティティだけを処理
    if (entity.properties && entity.properties.isEvacuationShelter) {
      const type = entity.properties.shelterType._value;
      const level = entity.properties.shelterLevel._value;
      
      // フィルタ条件に合致するかどうか
      const matchesType = selectedShelterTypes.includes(type);
      const matchesLevel = level >= minimumShelterLevel;
      
      // 表示/非表示を設定
      entity.show = matchesType && matchesLevel;
    }
  });
  
  // 避難所が1つも表示されない場合は警告
  const visibleShelters = viewer.entities.values.filter(entity => 
    entity.properties && 
    entity.properties.isEvacuationShelter && 
    entity.show
  );
  
  if (visibleShelters.length === 0) {
    alert('選択された条件に合う避難所がありません。条件を変更してください。');
  }
}

// 最寄りの避難所を検索して表示
function findNearestShelterFromLocation(longitude, latitude) {
  // フィルタリング条件を取得
  const minLevel = minimumShelterLevel;
  
  // フィルタリングされた避難所だけを検索対象にする
  const filteredShelters = shelterData.filter(shelter => {
    const type = shelter.properties.種類 || '指定避難所';
    const level = shelter.properties.レベル || 1;
    return selectedShelterTypes.includes(type) && level >= minLevel;
  });
  
  if (filteredShelters.length === 0) {
    alert('フィルタ条件に合う避難所がありません。条件を変更してください。');
    return;
  }
  
  // 最寄りの避難所を検索
  const nearest = findNearestShelter(longitude, latitude, filteredShelters);
  
  if (nearest) {
    // 前回の最寄避難所ハイライトがあれば削除
    if (nearestShelterEntity) {
      viewer.entities.remove(nearestShelterEntity);
    }
    
    // 最寄りの避難所の座標
    const shelterCoords = nearest.geometry.coordinates;
    
    // 最寄りの避難所をハイライト
    nearestShelterEntity = viewer.entities.add({
      name: '最寄り避難所',
      position: Cesium.Cartesian3.fromDegrees(shelterCoords[0], shelterCoords[1], 10),
      billboard: {
        image: './img/shelter-icon.png', // 避難所アイコン（画像ファイルが必要）
        scale: 0.8,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM
      }
    });
    
    // 避難所詳細を表示
    updateNearestShelterInfo(nearest);
    
    // 選択された移動手段を取得
    const transportMode = getTransportMode();
    
    // ルートを表示
    showRoute([longitude, latitude], shelterCoords, transportMode)
      .then(routeInfo => {
        if (routeInfo) {
          updateRouteInfo(routeInfo, 'evacuation');
        }
      });
  } else {
    alert('近くに避難所が見つかりませんでした。');
  }
}

// 最寄りの避難所を検索
function findNearestShelter(longitude, latitude, shelters) {
  let minDistance = Infinity;
  let nearestShelter = null;
  
  shelters.forEach(shelter => {
    const [shelterLng, shelterLat] = shelter.geometry.coordinates;
    const distance = calculateDistance(longitude, latitude, shelterLng, shelterLat);
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestShelter = shelter;
    }
  });
  
  return nearestShelter;
}

// 避難所へのルートを表示
function findRouteToShelter(lng, lat) {
  // 現在地がない場合は取得
  if (!currentLocation) {
    getCurrentLocation().then(location => {
      showCurrentLocationMarker(location.longitude, location.latitude);
      
      // 選択された移動手段を取得
      const transportMode = getTransportMode();
      
      // ルートを表示
      showRoute([location.longitude, location.latitude], [lng, lat], transportMode)
        .then(routeInfo => {
          if (routeInfo) {
            // ルート情報を表示
            const shelters = viewer.entities.values.filter(entity => 
              entity.position && 
              entity.position._value && 
              Cesium.Cartographic.fromCartesian(entity.position._value).longitude === Cesium.Math.toRadians(lng) &&
              Cesium.Cartographic.fromCartesian(entity.position._value).latitude === Cesium.Math.toRadians(lat)
            );
            
            if (shelters.length > 0) {
              const shelter = shelters[0].originalShelter;
              updateNearestShelterInfo(shelter);
              updateRouteInfo(routeInfo, 'evacuation');
            }
          }
        });
    }).catch(error => {
      console.error('現在地の取得に失敗しました:', error);
    });
  } else {
    // 選択された移動手段を取得
    const transportMode = getTransportMode();
    
    // ルートを表示
    showRoute([currentLocation.longitude, currentLocation.latitude], [lng, lat], transportMode)
      .then(routeInfo => {
        if (routeInfo) {
          // ルート情報を表示（避難所情報も更新する必要がある）
          const shelters = viewer.entities.values.filter(entity => 
            entity.position && 
            entity.position._value && 
            Cesium.Cartographic.fromCartesian(entity.position._value).longitude === Cesium.Math.toRadians(lng) &&
            Cesium.Cartographic.fromCartesian(entity.position._value).latitude === Cesium.Math.toRadians(lat)
          );
          
          if (shelters.length > 0) {
            const shelter = shelters[0].originalShelter;
            updateNearestShelterInfo(shelter);
            updateRouteInfo(routeInfo, 'evacuation');
          }
        }
      });
  }
}

// 最寄り避難所情報を更新
function updateNearestShelterInfo(shelter) {
  const props = shelter.properties;
  const name = props.P20_002 || '避難所';
  const address = props.P20_003 || '住所不明';
  const level = props.レベル || 1;
  const type = props.種類 || '指定避難所';
  
  const infoElement = document.getElementById('shelterDetails');
  infoElement.innerHTML = `
    <div class="shelter-info">
      <p class="shelter-name">${name}</p>
      <p><strong>住所:</strong> ${address}</p>
      <p><strong>種類:</strong> ${type}</p>
      <p><strong>レベル:</strong> ${level}</p>
      <button onclick="findRouteToShelter(${shelter.geometry.coordinates[0]}, ${shelter.geometry.coordinates[1]})" class="btn">ルートを検索</button>
      <button onclick="switchToRestaurant(${shelter.geometry.coordinates[0]}, ${shelter.geometry.coordinates[1]})" class="btn">この場所から飲食店を探す</button>
    </div>
  `;
}

// 選択された移動手段を取得
function getTransportMode() {
  const modeRadio = document.querySelector('input[name="transportMode"]:checked');
  return modeRadio ? modeRadio.value : 'foot-walking';
}

// 飲食店モードに切り替え（指定位置から）
function switchToRestaurant(lng, lat) {
  // 現在地を保存
  currentLocation = {
    longitude: parseFloat(lng),
    latitude: parseFloat(lat)
  };
  
  // 飲食店モードに切り替え
  switchMode('restaurant');
  
  // 少し遅延を入れてから現在地を表示（モード切替の処理が完了するのを待つ）
  setTimeout(() => {
    showCurrentLocationMarker(currentLocation.longitude, currentLocation.latitude);
    
    // 最寄りの飲食店を検索
    findNearestRestaurantFromLocation(currentLocation.longitude, currentLocation.latitude);
  }, 500);
}