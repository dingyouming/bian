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
  
  // 检查 data.assets 是否存在且为数组
  if (!Array.isArray(data.assets)) {
    throw new Error('资产数据格式不正确');
  }

  // 获取所有资产的总价值
  let totalValueInUSDT = 0;
  for (const asset of data.assets) {
    const assetAmount = parseFloat(asset.free) + parseFloat(asset.locked);
    if (assetAmount > 0) {
      const priceResponse = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${asset.asset}USDT`);
      const priceData = await priceResponse.json();
      const price = parseFloat(priceData.price);
      totalValueInUSDT += assetAmount * price;
    }
  }

  return totalValueInUSDT;  // 返回以USDT计的总资产价值
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
