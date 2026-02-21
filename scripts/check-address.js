const https = require("https");
https.get("https://account-it.net/", (res) => {
  let html = "";
  res.on("data", (c) => (html += c));
  res.on("end", () => run(html));
}).on("error", (e) => console.error(e));

function run(html) {
    console.log("HTML length:", html.length);
    console.log("--- Script tags containing 954 or address or phone or zip ---");
    const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
    scripts.forEach((s, i) => {
      if (/954|address|phone|zip|\d{5}/i.test(s)) console.log("Script", i, "snippet:", s.slice(0, 200));
    });
    console.log("--- data-* attributes with address/contact ---");
    const data = html.match(/data-[a-z-]+="[^"]{5,80}"/g) || [];
    data.filter((d) => /address|phone|contact|street|city/i.test(d)).slice(0, 10).forEach((d) => console.log(d));
    console.log("--- Looking for address / contact in HTML ---\n");
    const zipRe = /\d{5}/g;
    let m;
    const contexts = [];
    while ((m = zipRe.exec(html)) !== null) {
      const start = Math.max(0, m.index - 80);
      const end = Math.min(html.length, m.index + 15);
      const ctx = html.slice(start, end).replace(/\s+/g, " ").replace(/<[^>]+>/g, " ").trim();
      if (ctx.length > 10 && !contexts.some((c) => c.slice(0, 40) === ctx.slice(0, 40))) {
        contexts.push(ctx);
      }
    }
    console.log("Contexts around 5-digit zips:", contexts.length);
    contexts.slice(0, 15).forEach((c, i) => console.log(`${i + 1}. ${c}\n`));
    console.log("--- tel: (double or single quote) ---");
    const tels = html.match(/href=["']tel:[^"']+["']/g) || [];
    console.log(tels.slice(0, 5));
    console.log("--- 954 (area code) context ---");
    const idx = html.indexOf("954");
    if (idx >= 0) console.log(html.slice(Math.max(0, idx - 40), idx + 50));
    console.log("--- Raw text between > and < that has digits then letters (address-like) ---");
    const chunks = html.match(/>[^<]{10,100}</g) || [];
    const withDigit = chunks.filter((c) => /\d{2,}/.test(c) && /[A-Za-z]{4,}/.test(c));
    withDigit.slice(0, 20).forEach((c) => console.log(c));
}
