// 避難所モード用のグローバル変数
let shelterData = [];
let nearestShelterEntity = null;
let selectedShelterTypes = ['避難所']; // 避難所の種類フィルタは単一で良い
// 災害の種類に対応するフィルター
let selectedDisasterTypes = ['洪水', '崖崩、土石流及び地滑', '高潮', '地震', '津波', '大規模火災', '内水氾濫', '火山現象'];
let minimumShelterLevel = 1;

// CSV列のマッピング (CSVの列名→コード内の変数名)
const csvColumns = {
  '市町村コード': 'cityCode',
  '都道府県名及び市町村名': 'cityName',
  'NO': 'no',
  '施設・場所名': 'name',
  '住所': 'address',
  '洪水': 'flood',
  '崖崩、土石流及び地滑': 'landslide',
  '高潮': 'highTide',
  '地震': 'earthquake',
  '津波': 'tsunami',
  '大規模火災': 'largeFire',
  '内水氾濫': 'inlandFlood',
  '火山現象': 'volcano',
  '指定避難所との住所同一': 'sameAddress',
  '緯度': 'latitude',
  '経度': 'longitude',
  '備考': 'remarks'
};

// 避難所データの読み込み（CSVファイル）
function loadShelterData() {
  // エンティティをクリア
  viewer.entities.removeAll();
  
  // ローディングインジケータを表示
  showLoadingIndicator('避難所データを読み込み中...');
  
  // CSVファイルの読み込み
  Papa.parse('./kanagawa.csv', {
    download: true,
    header: true,
    encoding: 'utf-8',
    dynamicTyping: true, // 数値を適切に変換
    skipEmptyLines: true,
    complete: function(results) {
      try {
        // CSV解析結果をshelterDataに変換
        const processedData = processCSVData(results.data);
        shelterData = processedData;
        
        console.log(`CSV読み込み完了: ${shelterData.length}件の避難所データを読み込みました`);
        
        // 避難所を表示
        displayShelters(shelterData);
        
        // フィルターのセットアップ
        setupShelterFilteringUI();
        
        // ローディングインジケータを非表示
        hideLoadingIndicator();
        
        // 初期位置のマーカーが設定されていなければ表示
        if (currentLocation) {
          showCurrentLocationMarker(currentLocation.longitude, currentLocation.latitude);
        }
      } catch (error) {
        console.error('CSVデータの処理中にエラーが発生しました:', error);
        hideLoadingIndicator();
        alert('避難所データの処理に失敗しました: ' + error.message);
      }
    },
    error: function(error) {
      console.error('CSVファイルの読み込みに失敗しました:', error);
      hideLoadingIndicator();
      alert('CSVファイルの読み込みに失敗しました: ' + error.message);
      
      // 失敗した場合はGeoJSONのロードを試みる（フォールバック）
      loadGeoJSONShelterData();
    }
  });
}

// CSVデータの処理
function processCSVData(csvData) {
  // フィルタリングと整形を行う
  return csvData.filter(row => {
    // 緯度・経度があるデータのみを使用
    return row['緯度'] && row['経度'] && !isNaN(row['緯度']) && !isNaN(row['経度']);
  }).map(row => {
    // 必要なデータ形式に変換
    return {
      cityCode: row['市町村コード'],
      cityName: row['都道府県名及び市町村名'],
      no: row['NO'],
      name: row['施設・場所名'],
      address: row['住所'],
      // 災害対応情報
      disasters: {
        flood: row['洪水'] === 1,
        landslide: row['崖崩、土石流及び地滑'] === 1,
        highTide: row['高潮'] === 1,
        earthquake: row['地震'] === 1, 
        tsunami: row['津波'] === 1,
        largeFire: row['大規模火災'] === 1,
        inlandFlood: row['内水氾濫'] === 1,
        volcano: row['火山現象'] === 1
      },
      latitude: row['緯度'],
      longitude: row['経度'],
      remarks: row['備考'] || '',
      // レベルはCSVにはないので1に固定
      level: 1
    };
  });
}

// フォールバック: GeoJSONから避難所データを読み込む
function loadGeoJSONShelterData() {
  // ローディングインジケータを表示
  showLoadingIndicator('避難所データを読み込み中...(GeoJSON)');
  
  // GeoJSONファイルの読み込み
  fetch('./hinanjyo.geojson')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP エラー: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      shelterData = convertGeoJSONtoShelterData(data.features);
      
      // 避難所を表示
      displayShelters(shelterData);
      
      // フィルターのセットアップ
      setupShelterFilteringUI();
      
      // ローディングインジケータを非表示
      hideLoadingIndicator();
      
      // 初期位置のマーカーが設定されていなければ表示
      if (currentLocation) {
        showCurrentLocationMarker(currentLocation.longitude, currentLocation.latitude);
      }
    })
    .catch(error => {
      console.error('避難所データの読み込みに失敗しました:', error);
      hideLoadingIndicator();
      alert('避難所データの読み込みに失敗しました: ' + error.message);
    });
}

// GeoJSON形式からCSV互換の避難所データ形式に変換
function convertGeoJSONtoShelterData(features) {
  return features.map(feature => {
    const props = feature.properties;
    const coords = feature.geometry.coordinates;
    
    return {
      name: props.P20_002 || '避難所',
      address: props.P20_003 || '住所不明',
      // すべての災害対応をデフォルトでtrueに設定
      disasters: {
        flood: true,
        landslide: true,
        highTide: true,
        earthquake: true,
        tsunami: true,
        largeFire: true,
        inlandFlood: true,
        volcano: true
      },
      longitude: coords[0],
      latitude: coords[1],
      level: props.レベル || 1,
      remarks: ''
    };
  });
}

// 避難所を表示する災害種類のマッピング
const disasterTypeMapping = {
  '洪水': 'flood',
  '崖崩、土石流及び地滑': 'landslide',
  '高潮': 'highTide',
  '地震': 'earthquake',
  '津波': 'tsunami',
  '大規模火災': 'largeFire',
  '内水氾濫': 'inlandFlood',
  '火山現象': 'volcano'
};

// 避難所を四角柱で表示
function displayShelters(shelters) {
  // フィルタリングを適用
  const filteredShelters = filterShelters(shelters);
  
  filteredShelters.forEach(shelter => {
    try {
      // 基本情報
      const name = shelter.name || '避難所';
      const address = shelter.address || '住所不明';
      const level = shelter.level || 1;
      const longitude = shelter.longitude;
      const latitude = shelter.latitude;
      
      // 災害対応情報のテキスト生成
      const disastersText = generateDisastersText(shelter.disasters);
      
      // 備考
      const remarks = shelter.remarks || '';
      
      // 高さは避難所のレベルに基づいて設定
      const height = level * 100;
      
      // 避難所の色を設定
      const color = Cesium.Color.GREEN;
      
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
                  <th>対応災害</th>
                  <td>${disastersText}</td>
              </tr>
              ${remarks ? `<tr><th>備考</th><td>${remarks}</td></tr>` : ''}
          </table>
          <button onclick="findRouteToShelter(${longitude}, ${latitude})">ここへのルートを表示</button>
          <button onclick="switchToRestaurant(${longitude}, ${latitude})">この場所から飲食店を探す</button>
      `;
      
      // プロパティを設定
      const shelterProperties = {
        isEvacuationShelter: true,
        shelterLevel: level,
        shelterAddress: address,
        shelterDisasters: shelter.disasters
      };
      
      // 避難所エンティティの作成
      const entity = viewer.entities.add({
        name: name,
        description: description,
        position: Cesium.Cartesian3.fromDegrees(longitude, latitude, height/2),
        box: {
          dimensions: new Cesium.Cartesian3(50, 50, height),
          material: color.withAlpha(0.7),
          outline: true,
          outlineColor: Cesium.Color.BLACK
        },
        properties: shelterProperties
      });
      
      // 元の避難所データへの参照を保持
      entity.originalShelter = shelter;
    } catch (error) {
      console.error('避難所の表示中にエラーが発生しました:', error);
    }
  });
  
  console.log(`${filteredShelters.length}件の避難所を表示しました`);
}

// 災害対応情報のテキスト生成
function generateDisastersText(disasters) {
  const disasterTexts = [];
  
  if (disasters.flood) disasterTexts.push('洪水');
  if (disasters.landslide) disasterTexts.push('崖崩れ/土石流');
  if (disasters.highTide) disasterTexts.push('高潮');
  if (disasters.earthquake) disasterTexts.push('地震');
  if (disasters.tsunami) disasterTexts.push('津波');
  if (disasters.largeFire) disasterTexts.push('大規模火災');
  if (disasters.inlandFlood) disasterTexts.push('内水氾濫');
  if (disasters.volcano) disasterTexts.push('火山');
  
  return disasterTexts.join('、') || '情報なし';
}

// 避難所フィルタリング
function filterShelters(shelters) {
  return shelters.filter(shelter => {
    // レベルフィルター
    if (shelter.level < minimumShelterLevel) {
      return false;
    }
    
    // 災害種類フィルター
    if (selectedDisasterTypes.length > 0) {
      // 選択された災害タイプのいずれかに対応している避難所を表示
      return selectedDisasterTypes.some(disasterType => {
        const disasterKey = disasterTypeMapping[disasterType];
        return shelter.disasters[disasterKey];
      });
    }
    
    return true;
  });
}

// 避難所フィルターのセットアップ
function setupShelterFilteringUI() {
  // 災害タイプのチェックボックス
  document.querySelectorAll('input[name="disasterType"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      // 選択された災害タイプを更新
      selectedDisasterTypes = Array.from(document.querySelectorAll('input[name="disasterType"]:checked'))
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
    }).catch(error => {
      console.error('現在地の取得に失敗しました:', error);
      // デフォルト位置を使用
      if (typeof DEFAULT_LATITUDE !== 'undefined' && typeof DEFAULT_LONGITUDE !== 'undefined') {
        showCurrentLocationMarker(DEFAULT_LONGITUDE, DEFAULT_LATITUDE);
        findNearestShelterFromLocation(DEFAULT_LONGITUDE, DEFAULT_LATITUDE);
      }
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
  // ローディングインジケータを表示
  showLoadingIndicator('フィルターを適用中...');
  
  setTimeout(() => {
    try {
      // 現在表示されている避難所を削除
      const entitiesToRemove = viewer.entities.values.filter(entity => 
        entity.properties && entity.properties.isEvacuationShelter
      );
      
      entitiesToRemove.forEach(entity => {
        viewer.entities.remove(entity);
      });
      
      // 現在地マーカーを保持したまま避難所を再表示
      displayShelters(shelterData);
      
      // 避難所が1つも表示されない場合は警告
      const visibleShelters = viewer.entities.values.filter(entity => 
        entity.properties && entity.properties.isEvacuationShelter
      );
      
      if (visibleShelters.length === 0) {
        alert('選択された条件に合う避難所がありません。条件を変更してください。');
      }
    } catch (error) {
      console.error('フィルタ適用中にエラーが発生しました:', error);
    } finally {
      // ローディングインジケータを非表示
      hideLoadingIndicator();
    }
  }, 100);
}

// 最寄りの避難所を検索して表示
function findNearestShelterFromLocation(longitude, latitude) {
  // ローディングインジケータを表示
  showLoadingIndicator('最寄りの避難所を検索中...');
  
  try {
    // フィルタリングされた避難所だけを検索対象にする
    const filteredShelters = filterShelters(shelterData);
    
    if (filteredShelters.length === 0) {
      hideLoadingIndicator();
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
      
      // 最寄りの避難所をハイライト
      nearestShelterEntity = viewer.entities.add({
        name: '最寄り避難所',
        position: Cesium.Cartesian3.fromDegrees(nearest.longitude, nearest.latitude, 10),
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
      
      // ローディングインジケータを非表示
      hideLoadingIndicator();
      
      // ルートを表示
      showRoute([longitude, latitude], [nearest.longitude, nearest.latitude], transportMode)
        .then(routeInfo => {
          if (routeInfo) {
            updateRouteInfo(routeInfo, 'evacuation');
          }
        })
        .catch(error => {
          console.error('避難所ルート検索中にエラーが発生しました:', error);
        });
    } else {
      hideLoadingIndicator();
      alert('近くに避難所が見つかりませんでした。フィルター条件を変更してみてください。');
    }
  } catch (error) {
    console.error('最寄り避難所検索中にエラーが発生しました:', error);
    hideLoadingIndicator();
    alert('最寄り避難所検索中にエラーが発生しました: ' + error.message);
  }
}

// 最寄りの避難所を検索
function findNearestShelter(longitude, latitude, shelters) {
  let minDistance = Infinity;
  let nearestShelter = null;
  
  shelters.forEach(shelter => {
    try {
      const shelterLng = shelter.longitude;
      const shelterLat = shelter.latitude;
      
      // nullチェックと数値チェック
      if (shelterLng === undefined || shelterLat === undefined || 
          isNaN(parseFloat(shelterLng)) || isNaN(parseFloat(shelterLat))) {
        return;
      }
      
      const distance = calculateDistance(longitude, latitude, shelterLng, shelterLat);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestShelter = shelter;
      }
    } catch (error) {
      console.error('避難所距離計算中にエラーが発生しました:', error);
    }
  });
  
  return nearestShelter;
}

// 避難所へのルートを表示
function findRouteToShelter(lng, lat) {
  // parseFloatで確実に数値に変換
  lng = parseFloat(lng);
  lat = parseFloat(lat);
  
  // ローディングインジケータを表示
  showLoadingIndicator('避難所へのルートを検索中...');
  
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
            const shelterEntity = findShelterEntityByCoordinates(lng, lat);
            if (shelterEntity && shelterEntity.originalShelter) {
              updateNearestShelterInfo(shelterEntity.originalShelter);
              updateRouteInfo(routeInfo, 'evacuation');
            }
          }
        })
        .catch(error => {
          console.error('ルート検索中にエラーが発生しました:', error);
          alert('ルート検索に失敗しました: ' + error.message);
        });
    }).catch(error => {
      hideLoadingIndicator();
      console.error('現在地の取得に失敗しました:', error);
      
      // デフォルト位置を使用
      if (typeof DEFAULT_LONGITUDE !== 'undefined' && typeof DEFAULT_LATITUDE !== 'undefined') {
        const defaultLocation = {
          longitude: DEFAULT_LONGITUDE,
          latitude: DEFAULT_LATITUDE
        };
        
        showCurrentLocationMarker(defaultLocation.longitude, defaultLocation.latitude);
        const transportMode = getTransportMode();
        
        showRoute([defaultLocation.longitude, defaultLocation.latitude], [lng, lat], transportMode)
          .then(routeInfo => {
            if (routeInfo) {
              const shelterEntity = findShelterEntityByCoordinates(lng, lat);
              if (shelterEntity && shelterEntity.originalShelter) {
                updateNearestShelterInfo(shelterEntity.originalShelter);
                updateRouteInfo(routeInfo, 'evacuation');
              }
            }
          })
          .catch(error => {
            console.error('デフォルト位置からのルート検索に失敗しました:', error);
          });
      }
    });
  } else {
    // 選択された移動手段を取得
    const transportMode = getTransportMode();
    
    // ルートを表示
    showRoute([currentLocation.longitude, currentLocation.latitude], [lng, lat], transportMode)
      .then(routeInfo => {
        if (routeInfo) {
          // ルート情報を表示
          const shelterEntity = findShelterEntityByCoordinates(lng, lat);
          if (shelterEntity && shelterEntity.originalShelter) {
            updateNearestShelterInfo(shelterEntity.originalShelter);
            updateRouteInfo(routeInfo, 'evacuation');
          }
        }
      })
      .catch(error => {
        console.error('ルート検索中にエラーが発生しました:', error);
        alert('ルート検索に失敗しました: ' + error.message);
      });
  }
}

// 座標から避難所エンティティを検索
function findShelterEntityByCoordinates(lng, lat) {
  const tolerance = 0.0001; // 緯度経度の許容誤差
  
  return viewer.entities.values.find(entity => 
    entity.position && 
    entity.position._value && 
    Math.abs(Cesium.Math.toDegrees(Cesium.Cartographic.fromCartesian(entity.position._value).longitude) - lng) < tolerance &&
    Math.abs(Cesium.Math.toDegrees(Cesium.Cartographic.fromCartesian(entity.position._value).latitude) - lat) < tolerance &&
    entity.properties && 
    entity.properties.isEvacuationShelter
  );
}

// 最寄り避難所情報を更新
function updateNearestShelterInfo(shelter) {
  const name = shelter.name || '避難所';
  const address = shelter.address || '住所不明';
  
  // 災害対応情報のテキスト生成
  const disastersText = generateDisastersText(shelter.disasters);
  
  // 備考
  const remarks = shelter.remarks || '';
  
  const infoElement = document.getElementById('shelterDetails');
  infoElement.innerHTML = `
    <div class="shelter-info">
      <p class="shelter-name">${name}</p>
      <p><strong>住所:</strong> ${address}</p>
      <p><strong>対応災害:</strong> ${disastersText}</p>
      ${remarks ? `<p><strong>備考:</strong> ${remarks}</p>` : ''}
      <button onclick="findRouteToShelter(${shelter.longitude}, ${shelter.latitude})" class="btn">ルートを検索</button>
      <button onclick="switchToRestaurant(${shelter.longitude}, ${shelter.latitude})" class="btn">この場所から飲食店を探す</button>
    </div>
  `;
}

// 選択された移動手段を取得
function getTransportMode() {
  const modeRadio = document.querySelector('input[name="transportMode"]:checked');
  return modeRadio ? modeRadio.value : 'foot-walking';
}

// 経路情報を更新
function updateRouteInfo(routeInfo, type) {
  const infoElement = type === 'restaurant' ? 
    document.getElementById('restaurantDetails') : 
    document.getElementById('shelterDetails');
  
  // 既存の内容を保持
  const existingContent = infoElement.innerHTML;
  
  // 既存のルート情報が含まれている場合は削除
  const routeInfoRegex = /<div class="route-info">[\s\S]*?<\/div>/;
  const cleanedContent = existingContent.replace(routeInfoRegex, '');
  
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
  infoElement.innerHTML = cleanedContent + routeInfoHTML;
}

// 飲食店モードに切り替え（指定位置から）
function switchToRestaurant(lng, lat) {
  // 数値に変換
  lng = parseFloat(lng);
  lat = parseFloat(lat);
  
  // 現在地を保存
  currentLocation = {
    longitude: lng,
    latitude: lat
  };
  
  // ローディングインジケータを表示
  showLoadingIndicator('飲食店モードに切替中...');
  
  // 飲食店モードに切り替え
  switchMode('restaurant');
  
  // 少し遅延を入れてから現在地を表示（モード切替の処理が完了するのを待つ）
  setTimeout(() => {
    try {
      showCurrentLocationMarker(currentLocation.longitude, currentLocation.latitude);
      
      // 最寄りの飲食店を検索
      if (typeof findNearestRestaurantFromLocation === 'function') {
        findNearestRestaurantFromLocation(currentLocation.longitude, currentLocation.latitude);
      }
    } catch (error) {
      console.error('飲食店モード切替時にエラーが発生しました:', error);
    } finally {
      // ローディングインジケータを非表示
      hideLoadingIndicator();
    }
  }, 500);
}