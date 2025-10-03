import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in .env");
  process.exit(1);
}

app.use(cors());
app.use(express.json());

app.get("/ephemeral", async (_req, res) => {
  try {
    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        voice: "alloy",
        // VAD only for speech start/stop events (we drive turns client-side)
        turn_detection: { type: "server_vad", threshold: 0.6, silence_duration_ms: 900 },

        // ---- TOOLS: structured updates (not spoken) ----
        tools: [
          {
            type: "function",
            name: "payload_upsert",
            description: "Update exactly one field in the quote payload.",
            parameters: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  enum: [
                    "vehicleDetails.make",
                    "vehicleDetails.model",
                    "vehicleDetails.year",
                    "previousClaims.claimMadeInLast3Years",
                    "previousClaims.claimAtFault",
                    "postalCode"
                  ]
                },
                value: {}
              },
              required: ["path", "value"],
              additionalProperties: false
            }
          },
          {
            type: "function",
            name: "manager_ready",
            description: "All required fields captured and validated. Return the final payload.",
            parameters: {
              type: "object",
              properties: {
                payload: {
                  type: "object",
                  properties: {
                    vehicleDetails: {
                      type: "object",
                      properties: {
                        make: { type: "string" },
                        model: { type: "string" },
                        year: { type: "number" }
                      },
                      required: ["make", "model", "year"]
                    },
                    previousClaims: {
                      type: "object",
                      properties: {
                        claimMadeInLast3Years: { type: "boolean" },
                        claimAtFault: { type: "boolean" }
                      },
                      required: ["claimMadeInLast3Years", "claimAtFault"]
                    },
                    postalCode: { type: "string" }
                  },
                  required: ["vehicleDetails", "previousClaims", "postalCode"]
                }
              },
              required: ["payload"],
              additionalProperties: false
            }
          }
        ],

        // ---- SYSTEM INSTRUCTIONS ----
        instructions: `
You are a friendly, casual auto-insurance intake assistant. Stay strictly on auto insurance; ignore topics like mileage, commute, etc.

TARGET PAYLOAD:
{
  "vehicleDetails": { "make": string, "model": string, "year": number },
  "previousClaims": { "claimMadeInLast3Years": boolean, "claimAtFault": boolean },
  "postalCode": "string"
}

VALIDATION:
• Postal → uppercase A1A1A1 with no spaces. • Year is 4 digits (e.g., 2017).

CRITICAL RULES:
• Use the tools exclusively to record fields (payload_upsert for each field, then manager_ready when complete). Never reveal or describe tool calls.
• Ask exactly ONE missing field at a time. Keep replies short, warm, and human—no interrogation vibe.
• Only acknowledge/thank if you actually recorded a field via tool call in this turn. If unclear/noise, apologize briefly and re-ask the SAME missing field.
• Do NOT proactively speak before the user says anything.
• Never go outside the schema above or ask about miles, usage, etc.
`
      })
    });

    if (!r.ok) return res.status(r.status).send(await r.text());
    const data = await r.json();
    res.json({ client_secret: data.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "realtime init failed" });
  }
});

app.listen(PORT, () => console.log(`Token server running at http://localhost:${PORT}`));
