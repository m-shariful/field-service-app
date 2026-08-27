// import dns from "node:dns";

// dns.setServers(["192.168.0.1", "1.1.1.1"]);

// Since DNS issue is in the development machine, the cleanest immediate solution is to configure Node's DNS resolver once at application startup, rather than modifying every MongoDB call.
// For production, DNS should normally be supplied by the hosting/container environment.

import dns from "node:dns";

const dnsServers = (process.env.DNS_SERVERS ?? "")
  .split(",")
  .map((server) => server.trim())
  .filter(Boolean);

if (dnsServers.length > 0) {
  dns.setServers(dnsServers);
}

console.log("🌐 DNS servers:", dns.getServers());
