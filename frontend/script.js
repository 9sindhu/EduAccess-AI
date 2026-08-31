 const languageDropdown =
    document.getElementById("language");

const customLanguage =
    document.getElementById("customLanguage");

const inputText =
    document.getElementById("inputText");

const characterCount =
    document.getElementById("characterCount");

const loading =
    document.getElementById("loading");

const generateButton =
    document.getElementById("generateButton");

const output =
    document.getElementById("output");



/* CHARACTER COUNT */

inputText.addEventListener("input", () => {

    characterCount.innerText =
        inputText.value.length;

});



/* LANGUAGE */

languageDropdown.addEventListener("change", () => {

    if (languageDropdown.value === "Other") {

        customLanguage.classList.remove("hidden");

    } else {

        customLanguage.classList.add("hidden");

        customLanguage.value = "";

    }

});



/* GENERATE */

async function generateText() {

    const pastedText =
        inputText.value.trim();

    const documentText =
        document.getElementById(
            "documentExtractedText"
        )?.value.trim() || "";

    if (pastedText && documentText) {

    alert(
        "Please use either pasted educational content or upload a document, not both."
    );

    return;
}

 
    

    /*
       Use uploaded document if available.
       Otherwise use pasted educational content.
    */

    const text =
        documentText || pastedText;

    const mode =
        document.getElementById("mode").value;

    let language =
        languageDropdown.value;


    /* VALIDATE TEXT */

    if (!text) {

        alert(
            "Please enter educational content or upload a document."
        );

        return;

    }


    /* CUSTOM LANGUAGE */

    if (language === "Other") {

        language =
            customLanguage.value.trim();

        if (!language) {

            alert(
                "Please enter your preferred language."
            );

            return;

        }

    }


    /* LOADING */

    loading.classList.remove("hidden");

    generateButton.disabled = true;

    output.innerHTML = "";


    try {

        const response =
            await fetch(
                "https://eduaccess-ai-backend.vercel.app/generate",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        text: text,

                        mode: mode,

                        language: language

                    })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Server error"
            );

        }


        /* OUTPUT */

        output.innerText =
            data.result ||
            "No result generated.";


        document.getElementById(
            "downloadSection"
        ).classList.remove("hidden");


        /* SCORES */

        document.getElementById(
            "beforeScore"
        ).innerText =
            data.beforeScore ?? "--";


        document.getElementById(
            "afterScore"
        ).innerText =
            data.afterScore ?? "--";


    }

    catch (error) {

    console.error("Generate error:", error);

    output.innerText =
        error.message ||
        "Unable to generate content.";

    alert(
        error.message ||
        "Unable to generate content."
    );

}

    finally {

        loading.classList.add("hidden");

        generateButton.disabled = false;

    }

}



/* COPY */

async function copyOutput() {

    const text =
        output.innerText.trim();

    if (!text) {

        alert(
            "There is no generated content to copy."
        );

        return;

    }


    try {

        await navigator.clipboard.writeText(
            text
        );

        alert(
            "Result copied successfully!"
        );

    }

    catch {

        alert(
            "Could not copy the result."
        );

    }

}



// ========================================
// DOWNLOAD GENERATED OUTPUT
// ========================================

const downloadBtn =
    document.getElementById("downloadBtn");

const downloadSection =
    document.getElementById("downloadSection");


if (downloadBtn) {

    downloadBtn.addEventListener(
        "click",
        function () {

            const outputElement =
                document.getElementById("output");


            if (!outputElement) {

                alert(
                    "Output area was not found."
                );

                return;

            }


            const outputText =
                outputElement.innerText.trim();


            if (!outputText) {

                alert(
                    "There is no generated output to download."
                );

                return;

            }


            const blob =
                new Blob(
                    [outputText],
                    {
                        type:
                            "text/plain;charset=utf-8"
                    }
                );


            const url =
                URL.createObjectURL(blob);


            const link =
                document.createElement("a");


            link.href = url;

            link.download =
                "EduAccess_AI_Output.txt";


            document.body.appendChild(link);

            link.click();

            document.body.removeChild(link);

            URL.revokeObjectURL(url);

        }
    );

}

/* ========================================
   AI GENERATION WAITING MESSAGE
   Added without changing existing code
======================================== */

(function setupGenerationWaitingMessage() {

    const loadingElement =
        document.getElementById("loading");

    if (!loadingElement) {
        return;
    }


    /* Create waiting message */

    const waitMessage =
        document.createElement("div");

    waitMessage.className =
        "ai-wait-message hidden";


    waitMessage.innerHTML = `

        <div class="ai-wait-title">
            ✨ Creating your accessible version
        </div>

        <div class="ai-wait-text">
            Please wait while EduAccess AI processes your content
            <span class="ai-wait-dots">...</span>
        </div>

        <div class="ai-wait-progress">

            <div class="ai-wait-progress-bar"></div>

        </div>

    `;


    /*
       Put the message directly after
       the existing loading element.
    */

    loadingElement.parentNode.insertBefore(
        waitMessage,
        loadingElement.nextSibling
    );


    let messageInterval = null;

    let dotInterval = null;

    let messageIndex = 0;


    /*
       Messages shown while AI is working.
    */

    const messages = [

        {
            title:
                "✨ Creating your accessible version",

            text:
                "Please wait while EduAccess AI processes your content."
        },

        {
            title:
                "📄 Processing your document",

            text:
                "Your content is being analyzed section by section."
        },

        {
            title:
                "🤖 Applying accessibility improvements",

            text:
                "EduAccess AI is adapting the content to your selected mode."
        },

        {
            title:
                "🌐 Preparing your selected language",

            text:
                "Your accessible version is being prepared."
        },

        {
            title:
                "⏳ Almost done",

            text:
                "Large documents may take a little longer. Please wait."
        }

    ];


    /*
       Update message text.
    */

    function updateMessage() {

        const current =
            messages[messageIndex];


        const titleElement =
            waitMessage.querySelector(
                ".ai-wait-title"
            );


        const textElement =
            waitMessage.querySelector(
                ".ai-wait-text"
            );


        if (titleElement) {

            titleElement.textContent =
                current.title;

        }


        if (textElement) {

            textElement.innerHTML =
                `${current.text}
                <span class="ai-wait-dots">...</span>`;

        }


        messageIndex =
            (messageIndex + 1) %
            messages.length;

    }


    /*
       Animate the dots.
    */

    function startDots() {

        let dots = 0;


        dotInterval =
            setInterval(() => {

                dots =
                    (dots + 1) % 4;


                const dotElements =
                    waitMessage.querySelectorAll(
                        ".ai-wait-dots"
                    );


                dotElements.forEach(
                    element => {

                        element.textContent =
                            ".".repeat(dots);

                    }
                );

            }, 500);

    }


    /*
       Start waiting message.
    */

    function startWaitingMessage() {

        waitMessage.classList.remove(
            "hidden"
        );


        messageIndex = 0;

        updateMessage();


        if (!messageInterval) {

            messageInterval =
                setInterval(() => {

                    updateMessage();

                }, 5000);

        }


        if (!dotInterval) {

            startDots();

        }

    }


    /*
       Stop waiting message.
    */

    function stopWaitingMessage() {

        waitMessage.classList.add(
            "hidden"
        );


        if (messageInterval) {

            clearInterval(
                messageInterval
            );

            messageInterval = null;

        }


        if (dotInterval) {

            clearInterval(
                dotInterval
            );

            dotInterval = null;

        }

    }


    /*
       Watch the existing loading element.

       Your original generateText() already
       adds/removes the "hidden" class.
    */

    const observer =
        new MutationObserver(() => {

            const isLoading =
                !loadingElement.classList.contains(
                    "hidden"
                );


            if (isLoading) {

                startWaitingMessage();

            } else {

                stopWaitingMessage();

            }

        });


    observer.observe(
        loadingElement,
        {
            attributes: true,
            attributeFilter: ["class"]
        }
    );


    /*
       Check initial state.
    */

    if (
        !loadingElement.classList.contains(
            "hidden"
        )
    ) {

        startWaitingMessage();

    }

})();