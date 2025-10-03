import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;
app.use(cors());
app.use(express.json());

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in .env");
  process.exit(1);
}

app.get("/ephemeral", async (req, res) => {
  const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-realtime-preview",
      voice: "alloy",
      // this is where your multi-agent base prompt goes
      instructions: `
        You are part of a multi-agent team (Collector, Validator, Manager).
        - Collector chats with the user casually, gathering only insurance-related details (vehicle make, model, year; claims info; Canadian postal code).
        - Validator checks Collector's updates, enforces strict schema rules, and formats into the working payload.
        - Manager ensures friendliness, scope control, and approves only if the payload is complete/valid.
        Required JSON schema:

        {
          "vehicleDetails": { "make": string, "model": string, "year": number },
          "previousClaims": { "claimMadeInLast3Years": boolean, "claimAtFault": boolean },
          "postalCode": string
        }

        Rules:
        • Never talk about topics outside auto-insurance.
        • Keep tone warm, short, and human — not interrogative.
        • Use EVENT lines (collector.update, validator.upsert, manager.ready, etc.) to emit structured info.
      `
    })
  });
  if (!r.ok) {
    const errTxt = await r.text();
    return res.status(r.status).send(errTxt);
 }
  const data = await r.json();
  res.json({ client_secret: data.client_secret });
});


app.listen(PORT, () => console.log(`Token server http://localhost:${PORT}`));



