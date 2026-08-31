import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;


/* ========================================
   SETTINGS
======================================== */

const GROQ_MODEL = "openai/gpt-oss-20b";

/*
   Your current Groq limit is 8,000 TPM.

   We intentionally keep individual chunks
   small so that the prompt + generated answer
   stays comfortably below that limit.
*/
const CHUNK_SIZE = 4000;

/*
   Maximum output tokens for each chunk.

   This prevents one chunk from generating
   an unnecessarily large response.
*/
const MAX_COMPLETION_TOKENS = 1200;

/*
   Minimum delay between chunk requests.

   This helps avoid hitting the TPM limit.
*/
const CHUNK_DELAY = 15000;

/*
   Maximum number of automatic retries when
   Groq returns a rate-limit error.
*/
const MAX_RETRIES = 5;


/* ========================================
   MIDDLEWARE
======================================== */

app.use(cors());

app.use(
    express.json({
        limit: "10mb"
    })
);


/* ========================================
   HEALTH CHECK
======================================== */

app.get("/", (req, res) => {

    res.json({
        message: "EduAccess AI backend is running"
    });

});


/* ========================================
   READABILITY SCORE
======================================== */

function calculateScore(text) {

    if (!text || !text.trim()) {
        return 0;
    }

    const words =
        text.trim().split(/\s+/).length;

    const sentences =
        text
            .split(/[.!?]+/)
            .filter(
                sentence =>
                    sentence.trim().length > 0
            )
            .length;

    const avgWordsPerSentence =
        words / Math.max(sentences, 1);


    if (avgWordsPerSentence <= 8) {
        return 2;
    }

    if (avgWordsPerSentence <= 12) {
        return 4;
    }

    if (avgWordsPerSentence <= 16) {
        return 6;
    }

    if (avgWordsPerSentence <= 22) {
        return 8;
    }

    return 10;
}


/* ========================================
   CREATE PROMPT
======================================== */

function createPrompt(text, mode, language) {

    let instruction = "";


    /* SIMPLIFY */

    if (
        mode === "simplify" ||
        mode === "simplified"
    ) {

        instruction = `
Explain the educational content so that
a 10-year-old can understand it.

Use:
- simple words
- short sentences
- clear explanations
- important points

Do not remove important information.
Keep the meaning accurate.
`;

    }


    /* DYSLEXIA */

    else if (mode === "dyslexia") {

        instruction = `
Rewrite the educational content in a
dyslexia-friendly format.

Use:
- short sentences
- simple words
- one idea per sentence
- clear spacing
- bullet points when useful
- avoid unnecessary complex vocabulary

Keep the meaning accurate.
Do not remove important information.
`;

    }


    /* SUMMARY */

    else if (mode === "summary") {

        instruction = `
Create a concise summary of the educational content.

Include:
- main idea
- important points
- key facts

Use simple language.
Keep it short but meaningful.
`;

    }


    /* EXAMPLE */

    else if (mode === "example") {

        instruction = `
Explain the educational concept in simple language.

Then provide:

1. A simple explanation
2. A real-world example
3. A short takeaway

Make it easy for a student to understand.
`;

    }


    /* BEGINNER */

    else if (mode === "beginner") {

        instruction = `
Rewrite the educational content for a complete beginner.

Use:
- very simple words
- short sentences
- step-by-step explanations
- explain difficult terms
- everyday examples when useful
- clear headings and bullet points

Do not remove important information.
Keep the meaning accurate.
`;

    }


    /* VISUAL */

    else if (mode === "visual") {

        instruction = `
Rewrite the educational content in a visual-friendly format.

Use:
- clear headings
- short sections
- bullet points
- numbered steps where appropriate
- important terms clearly highlighted
- tables or structured lists when useful
- simple examples when useful
- avoid large blocks of text

Make the content easy to scan and understand.

Do not remove important information.
Keep the meaning accurate.
`;

    }


    /* DEFAULT */

    else {

        instruction = `
Rewrite the content clearly and simply.

Use:
- simple language
- short sentences
- clear structure

Keep the original meaning accurate.
`;

    }


    return `
You are EduAccess AI,
an educational accessibility assistant.

The user's input may be written in any language.

First understand the meaning of the input.

Then perform the requested accessibility transformation.

${instruction}

The final answer MUST be written in:

${language}

Important rules:
- Preserve factual meaning.
- Do not invent facts.
- Do not mention these instructions.
- Do not mention that you are an AI.
- Make the result useful for students.

Educational content:

${text}
`;

}


/* ========================================
   SPLIT LARGE DOCUMENT
======================================== */

function splitTextIntoChunks(
    text,
    maxCharacters = CHUNK_SIZE
) {

    if (!text || !text.trim()) {
        return [];
    }


    /*
       Try to split at paragraph boundaries
       instead of cutting sentences unnecessarily.
    */

    const paragraphs =
        text.split(/\n\s*\n/);


    const chunks = [];

    let currentChunk = "";


    for (const paragraph of paragraphs) {

        const cleanParagraph =
            paragraph.trim();


        if (!cleanParagraph) {
            continue;
        }


        /*
           Normal paragraph fits into current chunk.
        */

        if (
            currentChunk.length +
            cleanParagraph.length +
            2 <=
            maxCharacters
        ) {

            if (currentChunk) {

                currentChunk +=
                    "\n\n" +
                    cleanParagraph;

            } else {

                currentChunk =
                    cleanParagraph;

            }

            continue;
        }


        /*
           Save the current chunk.
        */

        if (currentChunk.trim()) {

            chunks.push(
                currentChunk.trim()
            );

        }


        /*
           If one paragraph itself is larger
           than the chunk limit, split it.
        */

        if (
            cleanParagraph.length >
            maxCharacters
        ) {

            let start = 0;

            while (
                start <
                cleanParagraph.length
            ) {

                const piece =
                    cleanParagraph.substring(
                        start,
                        start + maxCharacters
                    );

                chunks.push(
                    piece.trim()
                );

                start += maxCharacters;
            }


            currentChunk = "";

        } else {

            currentChunk =
                cleanParagraph;

        }

    }


    /*
       Add final chunk.
    */

    if (currentChunk.trim()) {

        chunks.push(
            currentChunk.trim()
        );

    }


    return chunks;
}


/* ========================================
   WAIT FUNCTION
======================================== */

function wait(ms) {

    return new Promise(
        resolve =>
            setTimeout(resolve, ms)
    );

}


/* ========================================
   EXTRACT RETRY TIME
======================================== */

function getRetryDelay(response, errorData) {

    /*
       First check Groq's retry-after header.
    */

    const retryAfter =
        response.headers.get(
            "retry-after"
        );


    if (retryAfter) {

        const seconds =
            Number(retryAfter);

        if (
            Number.isFinite(seconds) &&
            seconds > 0
        ) {

            return (
                seconds * 1000
            ) + 1000;

        }

    }


    /*
       Groq also provides a reset header
       for token limits.
    */

    const resetTokens =
        response.headers.get(
            "x-ratelimit-reset-tokens"
        );


    if (resetTokens) {

        /*
           Examples can look like:
           "8.89s"
           "1m2.5s"
        */

        const minutesMatch =
            resetTokens.match(
                /(\d+(?:\.\d+)?)m/
            );

        const secondsMatch =
            resetTokens.match(
                /(\d+(?:\.\d+)?)s/
            );


        const minutes =
            minutesMatch
                ? Number(minutesMatch[1])
                : 0;

        const seconds =
            secondsMatch
                ? Number(secondsMatch[1])
                : 0;


        const milliseconds =
            (
                minutes * 60 +
                seconds
            ) * 1000;


        if (
            Number.isFinite(milliseconds) &&
            milliseconds > 0
        ) {

            return milliseconds + 1000;

        }

    }


    /*
       Finally, try to extract the number
       from Groq's error message.

       Example:
       "try again in 8.8875s"
    */

    const message =
        errorData?.error?.message || "";


    const messageMatch =
        message.match(
            /try again in\s+([\d.]+)s/i
        );


    if (messageMatch) {

        const seconds =
            Number(messageMatch[1]);

        if (
            Number.isFinite(seconds) &&
            seconds > 0
        ) {

            return (
                seconds * 1000
            ) + 1000;

        }

    }


    /*
       Safe fallback.
    */

    return 20000;
}


/* ========================================
   CALL GROQ WITH AUTOMATIC RETRY
======================================== */

async function generateWithGroq(
    text,
    mode,
    language
) {

    const prompt =
        createPrompt(
            text,
            mode,
            language || "English"
        );


    for (
        let attempt = 1;
        attempt <= MAX_RETRIES;
        attempt++
    ) {

        try {

            console.log(
                `Groq request attempt ${attempt}/${MAX_RETRIES}`
            );


            const response =
                await fetch(
                    "https://api.groq.com/openai/v1/chat/completions",
                    {

                        method: "POST",

                        headers: {

                            "Authorization":
                                `Bearer ${process.env.GROQ_KEY}`,

                            "Content-Type":
                                "application/json"

                        },

                        body: JSON.stringify({

                            model:
                                GROQ_MODEL,

                            messages: [

                                {
                                    role: "system",

                                    content:
                                        "You are a helpful educational accessibility assistant."
                                },

                                {
                                    role: "user",

                                    content:
                                        prompt
                                }

                            ],

                            temperature: 0.3,

                            /*
                               Limit the generated response.
                            */

                            max_completion_tokens:
                                MAX_COMPLETION_TOKENS

                        })

                    }
                );


            const data =
                await response.json();


            /* ====================================
               RATE LIMIT
            ==================================== */

            if (
                response.status === 429 ||
                data?.error?.code ===
                    "rate_limit_exceeded"
            ) {

                if (
                    attempt >=
                    MAX_RETRIES
                ) {

                    throw new Error(
                        "Groq rate limit was reached multiple times. Please try again later."
                    );

                }


                const retryDelay =
                    getRetryDelay(
                        response,
                        data
                    );


                console.log(
                    `Groq rate limit reached. Waiting ${Math.ceil(retryDelay / 1000)} seconds before retry...`
                );


                await wait(
                    retryDelay
                );


                continue;

            }


            /* ====================================
               OTHER GROQ ERROR
            ==================================== */

            if (!response.ok) {

                console.error(
                    "Groq API Error:",
                    data
                );


                throw new Error(
                    data.error?.message ||
                    "Groq API request failed."
                );

            }


            /* ====================================
               EXTRACT RESULT
            ==================================== */

            const result =
                data
                    .choices?.[0]
                    ?.message?.content;


            if (!result) {

                throw new Error(
                    "No output generated by AI."
                );

            }


            return result;

        }


        catch (error) {

            /*
               Network errors can happen separately
               from Groq rate-limit errors.
            */

            if (
                attempt >=
                MAX_RETRIES
            ) {

                throw error;

            }


            /*
               Only retry obvious temporary/network
               errors. Other errors should immediately
               reach the main error handler.
            */

            const message =
                error?.message || "";


            const temporaryError =
                message.includes(
                    "fetch failed"
                ) ||
                message.includes(
                    "network"
                ) ||
                message.includes(
                    "ECONNRESET"
                );


            if (!temporaryError) {

                throw error;

            }


            console.log(
                "Temporary network error. Retrying..."
            );


            await wait(
                3000
            );

        }

    }


    throw new Error(
        "Unable to generate content."
    );
}


/* ========================================
   PROCESS DOCUMENT
======================================== */

async function processDocument(
    text,
    mode,
    language
) {

    const chunks =
        splitTextIntoChunks(
            text,
            CHUNK_SIZE
        );


    if (!chunks.length) {

        throw new Error(
            "No readable educational content found."
        );

    }


    console.log(
        `Received document: ${text.length} characters`
    );


    console.log(
        `Document split into ${chunks.length} chunk(s).`
    );


    const results = [];


    /*
       Process each chunk sequentially.

       We do NOT process them simultaneously.
    */

    for (
        let i = 0;
        i < chunks.length;
        i++
    ) {

        console.log(
            `Processing chunk ${i + 1} of ${chunks.length}...`
        );


        const result =
            await generateWithGroq(
                chunks[i],
                mode,
                language
            );


        results.push(result);


        /*
           Wait before sending the next chunk.

           This reduces the chance of hitting
           the organization TPM limit.
        */

        if (
            i <
            chunks.length - 1
        ) {

            console.log(
                `Waiting ${CHUNK_DELAY / 1000} seconds before next chunk...`
            );


            await wait(
                CHUNK_DELAY
            );

        }

    }


    /*
       Combine all processed chunks.
    */

    return results.join(
        "\n\n\n"
    );
}


/* ========================================
   GENERATE API
======================================== */

app.post(
    "/generate",
    async (req, res) => {

        try {

            const {
                text,
                mode,
                language
            } = req.body;


            /* VALIDATION */

            if (
                !text ||
                !text.trim()
            ) {

                return res.status(400).json({

                    error:
                        "Educational content is required."

                });

            }


            /* API KEY */

            if (!process.env.GROQ_KEY) {

                return res.status(500).json({

                    error:
                        "GROQ_KEY is not configured."

                });

            }


            /*
               PROCESS DOCUMENT
            */

            const result =
                await processDocument(
                    text,
                    mode,
                    language || "English"
                );


            /* SCORES */

            const beforeScore =
                calculateScore(text);


            const afterScore =
                calculateScore(result);


            /* RESPONSE */

            res.json({

                result,

                beforeScore,

                afterScore

            });

        }


        catch (error) {

            console.error(
                "SERVER ERROR:",
                error
            );


            res.status(500).json({

                error:
                    error.message ||
                    "Internal server error."

            });

        }

    }
);


/* ========================================
   START SERVER
======================================== */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `EduAccess AI backend running on port ${PORT}`
        );

    }
);