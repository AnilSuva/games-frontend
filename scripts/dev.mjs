#!/usr/bin/env node
import { spawn } from "node:child_process";
import os from "node:os";

// Find local network IP address
function getLocalIpAddresses() {
  const ips = [];
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] ?? []) {
        if ((net.family === "IPv4" || net.family === 4) && !net.internal) {
          ips.push(net.address);
        }
      }
    }
  } catch {
    // Ignore enumeration errors
  }
  return ips;
}

const localIps = getLocalIpAddresses();
const primaryIp = localIps[0] || "localhost";

console.log("\n" + "=".repeat(62));
console.log("  🎮 OmniPlay Local Network / Mobile Dev Server");
console.log("-".repeat(62));
console.log(`  💻 PC Browser:          http://localhost:3000`);
if (localIps.length > 0) {
  for (const ip of localIps) {
    console.log(`  📱 Mobile (Same Wi-Fi): http://${ip}:3000`);
    console.log(`  🔌 WebSocket Server:    ws://${ip}:3001/ws`);
  }
} else {
  console.log(`  📱 Mobile (Same Wi-Fi): Find your PC's IP using 'ipconfig'`);
}
console.log("-".repeat(62));
console.log("  Starting both Next.js Web (port 3000) and Fastify Server (port 3001)...");
console.log("=".repeat(62) + "\n");

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

// Spawn backend server
const serverProcess = spawn(npmCmd, ["run", "dev", "-w", "server"], {
  stdio: "inherit",
  shell: isWindows,
  env: {
    ...process.env,
    HOST: "0.0.0.0",
    PORT: "3001",
  },
});

// Spawn frontend web
const webProcess = spawn(npmCmd, ["run", "dev", "-w", "web"], {
  stdio: "inherit",
  shell: isWindows,
  env: {
    ...process.env,
  },
});

function cleanup() {
  console.log("\nShutting down dev servers...");
  try {
    if (serverProcess && !serverProcess.killed) {
      if (isWindows) {
        spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"]);
      } else {
        serverProcess.kill("SIGTERM");
      }
    }
    if (webProcess && !webProcess.killed) {
      if (isWindows) {
        spawn("taskkill", ["/pid", String(webProcess.pid), "/f", "/t"]);
      } else {
        webProcess.kill("SIGTERM");
      }
    }
  } catch {
    // Ignore cleanup error
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
