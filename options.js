document.addEventListener('DOMContentLoaded', function() {
  // 加载已保存的设置
  chrome.storage.local.get(['apiKey', 'secretKey'], function(result) {
    document.getElementById('apiKey').value = result.apiKey || '';
    document.getElementById('secretKey').value = result.secretKey || '';
  });

  // 保存设置
  document.getElementById('save').addEventListener('click', function() {
    var apiKey = document.getElementById('apiKey').value;
    var secretKey = document.getElementById('secretKey').value;
    chrome.storage.local.set({apiKey: apiKey, secretKey: secretKey}, function() {
      document.getElementById('status').textContent = '设置已保存';
      setTimeout(function() {
        document.getElementById('status').textContent = '';
      }, 2000);
    });
  });
});