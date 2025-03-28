// Cesium ionのアクセストークン
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc5YzciLCJpZCI6NTc3MzMsImlhdCI6MTYyNzg0NTE4Mn0.XcKpgANiY19MC4bdFUXMVEBToBmBLjJJZV0OvYHNhfY';

// シンプルなテスト用JavaScriptファイル
console.log('テストJSファイルが読み込まれました');

// グローバル変数
let viewer;

// 初期化関数
function initCesium() {
  console.log('Cesium初期化を開始します');
  
  try {
    // Cesium Viewerの初期化（高品質な地形設定付き）
    viewer = new Cesium.Viewer('cesiumContainer', {
      terrainProvider: Cesium.createWorldTerrain({
        requestWaterMask: true,  // 水面効果を有効化
        requestVertexNormals: true // 法線マップを有効化（光の反射効果向上）
      }),
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
    });
    
    console.log('Cesiumビューアが初期化されました');
    
    // デフォルトのイメージレイヤーを削除
    viewer.imageryLayers.removeAll();
    
    // 航空写真の追加
    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
        maximumLevel: 19,
        credit: '地理院タイル',
        tileWidth: 256,
        tileHeight: 256
      })
    );
    
    console.log('航空写真レイヤーが追加されました');
    
    // 地形の品質設定
    viewer.scene.globe.maximumScreenSpaceError = 2.0; // 低い値ほど高品質
    
    // 地形の強調表示（高さを強調）
    viewer.scene.globe.terrainExaggeration = 1.5; // 1.0より大きい値で地形の起伏を強調
    
    // デバッグ用マーカーを追加
    viewer.entities.add({
      name: 'デバッグマーカー',
      position: Cesium.Cartesian3.fromDegrees(139.6300, 35.4500, 0),
      point: {
        pixelSize: 10,
        color: Cesium.Color.RED
      }
    });
    
    // カメラ位置を設定
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(139.6300, 35.4500, 7000.0),
      orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(-30.0),
        roll: 0.0
      }
    });
    
    console.log('カメラ位置が設定されました');
    
  } catch (error) {
    console.error('Cesiumビューアの初期化に失敗しました:', error);
    document.getElementById('cesiumContainer').innerHTML = 
      '<div style="color:red; padding:20px;">Cesiumの初期化に失敗しました。コンソールでエラーを確認してください。</div>';
  }
}

// DOMコンテンツロード時に実行
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOMが読み込まれました');
  
  // cesiumContainerの存在チェック
  const container = document.getElementById('cesiumContainer');
  if (!container) {
    console.error('ID "cesiumContainer" の要素が見つかりません');
    document.body.innerHTML += '<div style="color:red; padding:20px;">ID "cesiumContainer" の要素が見つかりません。HTMLを確認してください。</div>';
    return;
  }
  
  // Cesiumの存在チェック
  if (typeof Cesium === 'undefined') {
    console.error('Cesiumが見つかりません。Cesiumライブラリが正しく読み込まれているか確認してください');
    container.innerHTML = '<div style="color:red; padding:20px;">Cesiumライブラリが読み込まれていません。スクリプトタグを確認してください。</div>';
    return;
  }
  
  // 初期化関数を呼び出し
  initCesium();
});