const net = require("net");
const hostname = "192.168.86.26";
const port = 7070;

const server = net.createServer();

server.listen(port, hostname, () => {
  console.log(`TCP_SERVER: running at http://${hostname}:${port}/`);
});

const Lamp = (sock) => {
  const socket = sock;

  const sendCommand = (command) => {
    const cmd = JSON.stringify(command);
    socket.write(cmd + "\r\n");
  };

  return {
    socket,
    sendCommand,
  };
};

const Lamps = () => {
  const lamps = new Set();

  const sendCommand = (command) => {
    lamps.forEach((lamp) => {
      lamp.sendCommand(command);
    });
  };

  return {
    add: (lamp) => lamps.add(lamp),
    remove: (lamp) => lamps.remove(lamp),
    sendCommand,
  };
};

let lamps = Lamps();

server.on("connection", function (sock) {
  console.log(
    "TCP_SERVER:CONNECTED: " + sock.remoteAddress + ":" + sock.remotePort
  );
  const lamp = Lamp(sock);
  lamps.add(lamp);

  sock.on("data", function (data) {
    console.log("TCP_SERVER:DATA" + sock.remoteAddress + ": " + data);
  });

  // Add a 'close' event handler to this instance of socket
  sock.on("close", function (data) {
    lamps.remove(lamp);
    console.log(
      "TCP_SERVER:CLOSED: " + sock.remoteAddress + " " + sock.remotePort
    );
  });
});

const YeeDevice = require("yeelight-platform").Device;

const device = new YeeDevice({ host: "192.168.86.25", port: 55443 });

device.connect();

device.on("deviceUpdate", (newProps) => {
  // console.log("deviceUpdate", newProps);
});

device.on("connected", () => {
  console.log("connected");
  device.sendCommand({
    id: 1,
    method: "set_music",
    params: [1, "192.168.86.26", port],
  });
});

const midi = require("midi");

// Set up a new input.
const input = new midi.Input();

// Count the available input ports.
console.log(input.getPortCount());

// Get the name of a specified input port.
console.log(input.getPortName(0));

const TIMING_CLOCK = 248;
const ACTIVE_SENSING = 254;
const ignored_status = [TIMING_CLOCK, ACTIVE_SENSING];

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

function rgb2Integer(r, g, b) {
  return r * 256 * 256 + g * 256 + b;
}

function hsv2rgb(h, s, v) {
  let f = (n, k = (n + h / 60) % 6) =>
    v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  return [
    Math.round(f(5) * 255),
    Math.round(f(3) * 255),
    Math.round(f(1) * 255),
  ];
}

const MIN_KEY_CODE = 36;
const MAX_KEY_CODE = 96;
const MAX_HUE = 360;

const convertKeyToHue = (key) => {
  const normalizedKey = (key - MIN_KEY_CODE) / (MAX_KEY_CODE - MIN_KEY_CODE);
  return normalizedKey * 360;
};

const decay = (timePassed) => {
  // timePassed in milliseconds
  return 1 / Math.pow(2, (1 * timePassed) / 610);
};

const MAX_PRESSURE = 124;

// Configure a callback.
input.on("message", (deltaTime, message) => {
  const status = message[0];
  const data1 = message[1]; // keyboard code 36 - 96 keys
  const data2 = message[2]; // pressure, 0 stopped 124 largest, ~50 is the average

  if (ignored_status.includes(status) || data2 === 0) {
  } else {
    const randomColor = getRandomInt(1, 16777216);
    const hue = convertKeyToHue(data1);
    const intensity = Math.min((data2 / MAX_PRESSURE) * 100, 100);
    const rgbArray = hsv2rgb(hue, 1, 1);
    const rgb = rgb2Integer(...rgbArray);

    console.log(rgbArray, intensity, rgb, intensity);
    lamps.sendCommand({
      id: 1,
      method: "start_cf",
      params: [
        7,
        1,
        `50, 1, ${rgb}, ${intensity},` +
          `50, 1, ${rgb}, ${intensity * decay(100)},` +
          `150, 1, ${rgb}, ${intensity * decay(250)},` +
          `150, 1, ${rgb}, ${intensity * decay(400)},` +
          `150, 1, ${rgb}, ${intensity * decay(550)},` +
          `150, 1, ${rgb}, ${intensity * decay(700)},` +
          `1000, 1, ${rgb}, 1`,
      ],
    });

    // decay 2
    // lamps.sendCommand({
    //   id: 1,
    //   method: "start_cf",
    //   params: [
    //     7,
    //     1,
    //     `50, 1, ${rgb}, ${intensity},` +
    //       `50, 1, ${rgb}, ${intensity * decay(100)},` +
    //       `100, 1, ${rgb}, ${intensity * decay(200)},` +
    //       `200, 1, ${rgb}, ${intensity * decay(400)},` +
    //       `300, 1, ${rgb}, ${intensity * decay(700)},` +
    //       `400, 1, ${rgb}, ${intensity * decay(1100)},` +
    //       `3000, 1, ${rgb}, 1`,
    //   ],
    // });

    // decay 1
    // lamps.sendCommand({
    //   id: 1,
    //   method: "start_cf",
    //   params: [
    //     7,
    //     1,
    //     `50, 1, ${rgb}, ${intensity},` +
    //       `50, 1, ${rgb}, ${intensity * decay(100)},` +
    //       `100, 1, ${rgb}, ${intensity * decay(200)},` +
    //       `100, 1, ${rgb}, ${intensity * decay(300)},` +
    //       `200, 1, ${rgb}, ${intensity * decay(500)},` +
    //       `300, 1, ${rgb}, ${intensity * decay(800)},` +
    //       `2000, 1, ${rgb}, 1`,
    //   ],
    // });

    // lamps.sendCommand({
    //   id: 1,
    //   method: "set_rgb",
    //   params: [randomColor, "sudden", 0],
    // });
    // The message is an array of numbers corresponding to the MIDI bytes:
    //   [status, data1, data2]
    // https://www.cs.cf.ac.uk/Dave/Multimedia/node158.html has some helpful
    // information interpreting the messages.
    console.log(`m: ${message} d: ${deltaTime}`);
  }
});

// Open the first available input port.
input.openPort(0);

// Sysex, timing, and active sensing messages are ignored
// by default. To enable these message types, pass false for
// the appropriate type in the function below.
// Order: (Sysex, Timing, Active Sensing)
// For example if you want to receive only MIDI Clock beats
// you should use
// input.ignoreTypes(true, false, true)
input.ignoreTypes(false, false, false);

// ... receive MIDI messages ...

// Close the port when done.
// setTimeout(function () {
//   input.closePort();
// }, 100000);
