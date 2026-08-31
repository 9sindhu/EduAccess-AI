let extractedDocumentText = "";


// ================================
// FILE UPLOAD
// ================================

async function handleDocumentUpload(event) {

    const file = event.target.files[0];

    if (!file) {
        return;
    }

    const fileName = file.name.toLowerCase();

    const supportedFile =
        fileName.endsWith(".pdf") ||
        fileName.endsWith(".docx") ||
        fileName.endsWith(".txt");

    if (!supportedFile) {

        alert(
            "Unsupported file type.\n\n" +
            "Please upload PDF, DOCX or TXT files."
        );

        event.target.value = "";
        return;
    }


    showDocumentStatus("Reading document...");

    try {

        if (fileName.endsWith(".pdf")) {

            extractedDocumentText =
                await extractPDFText(file);

        }

        else if (fileName.endsWith(".docx")) {

            extractedDocumentText =
                await extractDOCXText(file);

        }

        else if (fileName.endsWith(".txt")) {

            extractedDocumentText =
                await extractTXTText(file);

        }


        if (!extractedDocumentText.trim()) {

            showDocumentStatus(
                "No readable text was found in this document."
            );

            return;
        }


        displayExtractedText(extractedDocumentText);

showDocumentStatus(
    `Successfully extracted text from ${file.name}`
);

 

    }

    catch (error) {

        console.error("Document processing error:", error);

        showDocumentStatus(
            "Could not read this document. Please try another file."
        );
    }
}


// ================================
// TXT
// ================================

function extractTXTText(file) {

    return new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.onload = function () {

            resolve(reader.result);
        };

        reader.onerror = function () {

            reject(reader.error);
        };

        reader.readAsText(file);
    });
}


// ================================
// PDF
// ================================

async function extractPDFText(file) {

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer
    }).promise;


    let completeText = "";


    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {

        const page = await pdf.getPage(pageNumber);

        const textContent = await page.getTextContent();


        const pageText = textContent.items
            .map(item => item.str)
            .join(" ");


        completeText +=
            `\n\n--- Page ${pageNumber} ---\n\n` +
            pageText;
    }


    return completeText;
}


// ================================
// DOCX
// ================================

async function extractDOCXText(file) {

    const arrayBuffer = await file.arrayBuffer();

    const result = await mammoth.extractRawText({
        arrayBuffer: arrayBuffer
    });


    return result.value;
}


// ================================
// DISPLAY TEXT
// ================================

function displayExtractedText(text) {

    const output = document.getElementById(
        "documentExtractedText"
    );


    if (!output) {
        return;
    }


    output.value = text;
}


// ================================
// STATUS
// ================================

function showDocumentStatus(message) {

    const status = document.getElementById(
        "documentStatus"
    );


    if (status) {
        status.textContent = message;
    }
}


// ================================
// GET EXTRACTED TEXT
// ================================

function getExtractedDocumentText() {

    return extractedDocumentText;
}


// ================================
// LISTEN TO DOCUMENT
// ================================

 // ================================
// LISTEN TO GENERATED RESULT
// ================================

function listenToDocument() {

    // Get the AI-generated accessible result
    const output =
        document.getElementById("output");


    if (!output) {

        alert("Output area was not found.");

        return;
    }


    const text =
        output.innerText.trim();


    if (!text) {

        alert(
            "There is no generated content available to read."
        );

        return;
    }


    // Read the generated accessible content
    speakText(text);
}

 
 
 