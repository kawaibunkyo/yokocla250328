// シンプルなテスト用JavaScriptファイル
console.log('テストJSファイルが読み込まれました');

// Cesiumが利用可能か確認
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOMが読み込まれました');
  
  if (typeof Cesium !== 'undefined') {
    console.log('Cesiumが利用可能です');
    
    try {
      // シンプルなCesiumビューアを作成
      const viewer = new Cesium.Viewer('cesiumContainer', {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        timeline: false
      });
      
      console.log('Cesiumビューアが初期化されました');
      
      // 赤いマーカーを追加
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(139.63, 35.45, 0),
        point: {
          pixelSize: 10,
          color: Cesium.Color.RED
        }
      });
      
      // カメラを設定
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(139.63, 35.45, 5000)
      });
      
    } catch (e) {
      console.error('Cesiumビューアの初期化に失敗しました:', e);
    }
  } else {
    console.error('Cesiumが見つかりません');
  }
});
