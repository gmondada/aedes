const Aedes = require('./aedes')
const createSocket = require('net').createServer
const createHttp = require('http').createServer
const _ws = require('ws')
const wsServer = _ws.Server
const createWebSocketStream = _ws.createWebSocketStream
const port = 1885;
const wsPort = 8885;
const mqtt = require('mqtt');
const { exit } = require('process')

// server

const aedes = new Aedes();
const socket = createSocket(aedes.handle);
socket.listen(port, function () {
  console.log("Aedes MQTT listening on port", port);
});

const http = createHttp();
const ws = new wsServer({ server: http });
ws.on("connection", (connection, _) => {
  let stream = createWebSocketStream(connection);
  aedes.handle(stream);
});

http.listen(wsPort, () => {
  console.log("Aedes MQTT-WS listening on port", wsPort);
});

aedes.on("client", (client) => {
  console.log(client.id, "connected");
});

aedes.on("clientDisconnect", (client) => {
  console.log(client.id, "disconnected");
});

aedes.on("subscribe", (subscriptions, client) => {
  console.log(
    client.id,
    "subscribed",
    subscriptions.map((s) => s.topic).join(";"));
});

aedes.on("unsubscribe", (subscriptions, client) => {
  console.log(
    client.id,
    "unsubscribed",
    subscriptions.join(";"));
});

aedes.on("publish", (packet, client) => {
  if (client) {
    console.log(
      client.id,
      "published",
      packet.qos,
      packet.topic,
      packet.payload.toString())
  };
});

// clients

let txCount = 0;
let rxCount = 0;
let fwCount = 0;
let connectionCount = 0;
const mqttClient1 = mqtt.connect("ws://127.0.0.1:8885");
const mqttClient2 = mqtt.connect("mqtt://127.0.0.1:1885");

async function sendMessageBurst() {
  for (let i = 0; i < 10; i++) {
    mqttClient1.publishAsync("main", "Ping " + txCount, { qos: 2 });
    txCount++;
  }
}

mqttClient1.on("message", (topic, payload) => {
  if (topic === "main") {
    var message = payload.toString();
    if (message.startsWith("Pong")) {
      rxCount++;
      if (rxCount % 10 === 0) {
        console.log("Burst received");
        sendMessageBurst();
      }
    }
  }
});

mqttClient1.on("connect", () => {
  connectionCount++;
  if (connectionCount === 2) {
    sendMessageBurst();
  }
});

mqttClient1.subscribe("main", { qos: 2 });
mqttClient1.subscribe("aux", { qos: 2 });

mqttClient2.on("message", (topic, payload) => {
  if (topic === "main") {
    var message = payload.toString();
    if (message.startsWith("Ping")) {
      const reply = message.replace("Ping", "Pong");
      mqttClient2.publish("main", reply, { qos: 2 });
      if (fwCount % 9 === 0) {
        mqttClient2.publish("aux", "QoS0 Message", { qos: 0 });
      }
      fwCount++;
    }    
  } 
});

mqttClient2.on("connect", () => {
  connectionCount++;
  if (connectionCount === 2) {
    sendMessageBurst();
  }
});

mqttClient2.subscribe("main", { qos: 2 });
mqttClient2.subscribe("aux", { qos: 2 });

setInterval(() => {
  mqttClient2.publish("aux", "QoS0 Message", { qos: 0 });
}, 200);

let lastRxCount = 0;
setInterval(() => {
  if (rxCount === lastRxCount) {
    console.log("Ping sent:", txCount);
    console.log("Pong received:", rxCount);
    exit(1);
  }
  lastRxCount = rxCount;
}, 1000);
