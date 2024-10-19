chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getBalance") {
    getTotalBalance().then(balance => {
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
  
  console.log('API Response:', JSON.stringify(data, null, 2));

  if (typeof data !== 'object' || data === null || typeof data.totalNetAssetOfBtc !== 'string') {
    console.error('Unexpected data structure:', data);
    throw new Error(`资产数据格式不正确: ${JSON.stringify(data)}`);
  }

  // 获取BTC对USDT的当前价格
  const btcPriceResponse = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
  const btcPriceData = await btcPriceResponse.json();
  const btcPrice = parseFloat(btcPriceData.price);

  // 计算总净资产的USDT价值
  const totalNetAssetOfUsdt = parseFloat(data.totalNetAssetOfBtc) * btcPrice;

  return totalNetAssetOfUsdt;  // 返回以USDT计的总净资产价值
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

async function getTotalBalance() {
  const apiKey = await getApiKey();
  const secretKey = await getSecretKey();
  
  if (!apiKey || !secretKey) {
    throw new Error('API Key 或 Secret Key 未设置');
  }
  
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = await createSignature(queryString, secretKey);
  
  // 获取保证金账户信息
  const marginResponse = await fetch(`https://api.binance.com/sapi/v1/margin/account?${queryString}&signature=${signature}`, {
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': apiKey
    }
  });

  // 获取现货账户信息
  const spotResponse = await fetch(`https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`, {
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': apiKey
    }
  });

  if (!marginResponse.ok || !spotResponse.ok) {
    throw new Error('API请求失败');
  }

  const marginData = await marginResponse.json();
  const spotData = await spotResponse.json();
  
  console.log('Margin API Response:', JSON.stringify(marginData, null, 2));
  console.log('Spot API Response:', JSON.stringify(spotData, null, 2));

  // 获取BTC对USDT的当前价格
  const btcPriceResponse = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
  const btcPriceData = await btcPriceResponse.json();
  const btcPrice = parseFloat(btcPriceData.price);

  // 计算保证金账户总净资产的USDT价值
  const marginNetAssetOfUsdt = parseFloat(marginData.totalNetAssetOfBtc) * btcPrice;

  // 计算现货账户总资产的USDT价值
  let spotTotalAssetOfUsdt = 0;
  for (const balance of spotData.balances) {
    const free = parseFloat(balance.free);
    const locked = parseFloat(balance.locked);
    if (free > 0 || locked > 0) {
      if (balance.asset === 'USDT') {
        spotTotalAssetOfUsdt += free + locked;
      } else {
        const priceResponse = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${balance.asset}USDT`);
        const priceData = await priceResponse.json();
        const price = parseFloat(priceData.price);
        spotTotalAssetOfUsdt += (free + locked) * price;
      }
    }
  }

  // 计算总资产价值
  const totalAssetOfUsdt = marginNetAssetOfUsdt + spotTotalAssetOfUsdt;

  return totalAssetOfUsdt;  // 返回以USDT计的总资产价值
}
