document.addEventListener('DOMContentLoaded', function() {
  fetchBalance();
  document.getElementById('refresh').addEventListener('click', fetchBalance);
  document.getElementById('settingsLink').addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
});

function fetchBalance() {
  chrome.runtime.sendMessage({action: "getBalance"}, function(response) {
    if (response.error) {
      document.getElementById('balance').textContent = '错误: ' + response.error;
      if (response.error === 'API Key 或 Secret Key 未设置') {
        document.getElementById('balance').textContent += '。请点击设置链接进行配置。';
      }
    } else {
      document.getElementById('balance').textContent = '总余额: $' + response.balance.toFixed(2);
    }
  });
}