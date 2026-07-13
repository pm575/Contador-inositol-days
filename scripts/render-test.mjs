import fs from "node:fs";
import handler from "../netlify/functions/timer.mjs";

const request = new Request("http://localhost/.netlify/functions/timer?format=gif");
const response = await handler(request);
if (!response.ok) throw new Error(await response.text());
const output = Buffer.from(await response.arrayBuffer());
fs.writeFileSync("timer-test.gif", output);
console.log(`GIF generado: ${output.length} bytes`);
