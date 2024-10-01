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
  let auxInfo = "";
  if (client.clean) {
    auxInfo = " (clean)";
  }
  console.log(client.id, "connected" + auxInfo);
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

async function test() {
  
  // publish a simple retained topic

  const mqttClient1 = await mqtt.connectAsync("mqtt://127.0.0.1:1885");
  await mqttClient1.publishAsync("main", "data", { qos: 2, retain: true });

  // subscribe from a clean session

  console.log("Open client with clean session");
  const mqttClient2 = mqtt.connect("mqtt://127.0.0.1:1885");
  let received2 = false;
  mqttClient2.subscribe("main");
  mqttClient2.on("message", (topic, payload) => {
    if (topic === "main") {
      received2 = true;
    } 
  });

  await new Promise((resolve) => { setTimeout(resolve, 1000) });

  console.log("Received:", received2);

  // subscribe from a non-clean session in QoS0

  console.log("Open client with clean=false");
  const mqttClient3 = await mqtt.connectAsync("mqtt://127.0.0.1:1885", { clean: false, clientId: "client111" });
  let received3 = false;
  mqttClient3.on("message", (topic, payload) => {
    if (topic === "main") {
      received3 = true;
    } 
  });
  mqttClient3.subscribe("main", { qos: 0 });

  await new Promise((resolve) => { setTimeout(resolve, 1000) });

  console.log("Received:", received3);

  // subscribe from a non-clean session in QoS2

  console.log("Open client with clean=false and subscribe in QoS2");
  const mqttClient4 = await mqtt.connectAsync("mqtt://127.0.0.1:1885", { clean: false, clientId: "client222" });
  let received4 = false;
  mqttClient4.on("message", (topic, payload) => {
    if (topic === "main") {
      received4 = true;
    } 
  });
  mqttClient4.subscribe("main", { qos: 2 });

  await new Promise((resolve) => { setTimeout(resolve, 2000) });

  console.log("Received:", received4);

  await new Promise((resolve) => { setTimeout(resolve, 1000) });

  exit(0);
}

test();
