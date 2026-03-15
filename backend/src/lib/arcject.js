import arcjet, { shield, detectBot, slidingWindow } from "@arcjet/node";

import dotenv from 'dotenv';
dotenv.config();
const {ARCJET_KEY} = process.env;


const aj = arcjet({

  key: ARCJET_KEY,
  rules: [
    // Shield protects your app from common attacks e.g. SQL injection
    shield({ mode: "LIVE" }),
    // Create a bot detection rule
    detectBot({
      mode: "LIVE", // Blocks requests. Use "DRY_RUN" to log only
      // Block all bots except the following
      allow: [
        "CATEGORY:SEARCH_ENGINE", // Google, Bing, etc
     
      ],
    }),
    // Create a rate limiting rule
    slidingWindow({
      mode: "LIVE", // Blocks requests. Use "DRY_RUN" to log only
      max: 100, // Max 100 requests per window per IP
      interval: 60, // 1 minute
   
    })
  ],
});


export default aj;