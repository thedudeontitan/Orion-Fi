const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const cors = require("cors");

const app = express();
const redis = new Redis();

app.use(express.json());
app.use(cors());

// WebSocket server setup
const wss = new WebSocket.Server({ port: 8080 });

const clients = new Map();

wss.on('connection', (ws) => {
  const id = uuidv4();
  const metadata = { id };

  clients.set(ws, metadata);

  console.log(`New WebSocket connection: ${id}`);

  ws.on('message', (messageAsString) => {
    const message = JSON.parse(messageAsString);
    const metadata = clients.get(ws);

    if (message.type === 'subscribe') {
      metadata.userAddress = message.userAddress;
      console.log(`Client ${metadata.id} subscribed to address ${metadata.userAddress}`);
    }
  });

  ws.on('close', () => {
    console.log(`WebSocket connection closed: ${id}`);
    clients.delete(ws);
  });
});

function notifyUser(userAddress, message) {
  const matchingClients = Array.from(clients.entries())
    .filter(([client, metadata]) => metadata.userAddress === userAddress);
  
  matchingClients.forEach(([client, metadata]) => {
    client.send(JSON.stringify(message));
  });
}

// Helper function to create a new order
async function createOrder(type, price, amount, userAddress, contractAddress) {
  const orderId = uuidv4();
  const order = { id: orderId, type, price, amount, userAddress, contractAddress, timestamp: Date.now() };
  await redis.hset(`orders:${orderId}`, order);
  await redis.zadd(`orderbook:${type}`, price, orderId);
  return order;
}

// Helper function to match orders
async function matchOrders() {
  const buyOrders = await redis.zrevrange('orderbook:buy', 0, -1, 'WITHSCORES');
  const sellOrders = await redis.zrange('orderbook:sell', 0, -1, 'WITHSCORES');

  let buyIndex = 0;
  let sellIndex = 0;

  while (buyIndex < buyOrders.length && sellIndex < sellOrders.length) {
    const buyOrderId = buyOrders[buyIndex];
    const buyPrice = parseFloat(buyOrders[buyIndex + 1]);
    const sellOrderId = sellOrders[sellIndex];
    const sellPrice = parseFloat(sellOrders[sellIndex + 1]);

    if (buyPrice >= sellPrice) {
      const buyOrder = await redis.hgetall(`orders:${buyOrderId}`);
      const sellOrder = await redis.hgetall(`orders:${sellOrderId}`);

      const matchedAmount = Math.min(parseFloat(buyOrder.amount), parseFloat(sellOrder.amount));
      const matchPrice = sellPrice;

      // Update orders
      await redis.hset(`orders:${buyOrderId}`, 'amount', parseFloat(buyOrder.amount) - matchedAmount);
      await redis.hset(`orders:${sellOrderId}`, 'amount', parseFloat(sellOrder.amount) - matchedAmount);

      // Notify users
      notifyUser(buyOrder.userAddress, {
        type: 'orderMatched',
        order: buyOrder,
        matchedAmount,
        matchPrice
      });
      notifyUser(sellOrder.userAddress, {
        type: 'orderMatched',
        order: sellOrder,
        matchedAmount,
        matchPrice
      });

      // Remove filled orders
      if (parseFloat(buyOrder.amount) - matchedAmount <= 0) {
        await redis.zrem('orderbook:buy', buyOrderId);
        await redis.del(`orders:${buyOrderId}`);
        buyIndex += 2;
      }
      if (parseFloat(sellOrder.amount) - matchedAmount <= 0) {
        await redis.zrem('orderbook:sell', sellOrderId);
        await redis.del(`orders:${sellOrderId}`);
        sellIndex += 2;
      }

      console.log(`Matched: ${matchedAmount} @ ${matchPrice} (Buy: ${buyOrderId}, Sell: ${sellOrderId})`);
    } else {
      break;
    }
  }
}

// API endpoint to place a new order
app.post('/order', async (req, res) => {
  const { type, price, amount, userAddress, contractAddress } = req.body;

  if (!['buy', 'sell'].includes(type) || !price || !amount || !userAddress || !contractAddress) {
    return res.status(400).json({ error: 'Invalid order parameters' });
  }

  const order = await createOrder(type, parseFloat(price), parseFloat(amount), userAddress, contractAddress);
  await matchOrders();

  res.json(order);
});

// API endpoint to get the current order book
app.get('/orderbook', async (req, res) => {
  const buyOrders = await redis.zrevrange('orderbook:buy', 0, -1, 'WITHSCORES');
  const sellOrders = await redis.zrange('orderbook:sell', 0, -1, 'WITHSCORES');

  const formatOrders = (orders) => {
    const result = [];
    for (let i = 0; i < orders.length; i += 2) {
      result.push({ id: orders[i], price: parseFloat(orders[i + 1]) });
    }
    return result;
  };

  res.json({
    buyOrders: formatOrders(buyOrders),
    sellOrders: formatOrders(sellOrders),
  });
});

// API endpoint to get all orders
app.get('/orders', async (req, res) => {
  const buyOrderIds = await redis.zrevrange('orderbook:buy', 0, -1);
  const sellOrderIds = await redis.zrevrange('orderbook:sell', 0, -1);
  const allOrderIds = [...buyOrderIds, ...sellOrderIds];

  const orders = await Promise.all(allOrderIds.map(id => redis.hgetall(`orders:${id}`)));

  // Sort orders by timestamp, most recent first
  orders.sort((a, b) => b.timestamp - a.timestamp);

  res.json(orders);
});

// API endpoint to get orders for a specific user
app.get('/orders/:userAddress', async (req, res) => {
  const { userAddress } = req.params;
  const buyOrderIds = await redis.zrevrange('orderbook:buy', 0, -1);
  const sellOrderIds = await redis.zrevrange('orderbook:sell', 0, -1);
  const allOrderIds = [...buyOrderIds, ...sellOrderIds];

  const allOrders = await Promise.all(allOrderIds.map(id => redis.hgetall(`orders:${id}`)));
  const userOrders = allOrders.filter(order => order.userAddress === userAddress);
  
  // Sort orders by timestamp, most recent first
  userOrders.sort((a, b) => b.timestamp - a.timestamp);

  res.json(userOrders);
});

const EXPRESS_PORT = process.env.EXPRESS_PORT || 3000;
app.listen(EXPRESS_PORT, () => {
  console.log(`Express server listening on port ${EXPRESS_PORT}`);
});

console.log(`WebSocket server listening on ws://localhost:8080`);