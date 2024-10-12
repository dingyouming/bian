chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getBalance") {
    getMarginBalance().then(balance => {
      sendResponse({balance: balance});
    }).catch(error => {
      sendResponse({error: error.message});
    });
    return true;  // 保持消息通道开放以进行异步响应
  }
});

async function getMarginBalance() {
  const apiKey = await getApiKey();
  const secretKey = await getSecretKey();
  
  if (!apiKey || !secretKey) {
    throw new Error('API Key 或 Secret Key 未设置');
  }
  
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = await createSignature(queryString, secretKey);
  
  const response = await fetch(`https://api.binance.com/sapi/v1/margin/account?${queryString}&signature=${signature}`, {
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': apiKey
    }
  });

  if (!response.ok) {
    throw new Error('API请求失败');
  }

  const data = await response.json();
  const totalAssetOfBtc = parseFloat(data.totalAssetOfBtc);
  
  // 获取BTC/USDT的当前价格
  const btcPriceResponse = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
  const btcPriceData = await btcPriceResponse.json();
  const btcPrice = parseFloat(btcPriceData.price);

  return totalAssetOfBtc * btcPrice;
}

async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiKey'], function(result) {
      resolve(result.apiKey);
    });
  });
}

async function getSecretKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['secretKey'], function(result) {
      resolve(result.secretKey);
    });
  });
}

async function createSignature(queryString, secretKey) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', 
    encoder.encode(secretKey),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(queryString)
  );
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}