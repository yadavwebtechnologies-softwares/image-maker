
/* =====================================================
   PREPAREKORA STUDIO
   PDF GENERATOR
   File: pdf-generator.js

   Responsibilities:
   1. Generate unique MT IDs.
   2. Generate A4 portrait PDF pages.
   3. Preserve the supplied A4 design.
   4. Display five bilingual question pairs per page.
   5. Generate dynamic header, footer and QR code.
   6. Return PDF Blob and shared test data.

   Dependencies:
   - jsPDF 2.5.2
   - html2canvas 1.4.1
   - MCQParser data structure

   This file does not modify either image maker.
===================================================== */

(function (window, document) {

    "use strict";


    /* ================= CONFIGURATION ================= */

    const CONFIG = {
        pageWidth: 210,
        pageHeight: 297,
        questionsPerPage: 5,
        captureScale: 2.5,
        storagePrefix: "preparekora.mtSerial.v1"
    };


    const SUBJECT_CODES = {
        "Mathematics": "MATH",
        "Reasoning": "REASON",
        "General Knowledge": "GK",
        "History": "HIS",
        "Geography": "GEO",
        "Current Affairs": "CA",
        "Computer": "COMP"
    };


    /* ================= SUBJECT CODE ================= */

    function getSubjectCode(subject) {

        const value = String(subject || "").trim();

        if (!value) {
            throw new Error("Subject is required.");
        }

        if (SUBJECT_CODES[value]) {
            return SUBJECT_CODES[value];
        }

        const code = value
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "")
            .slice(0, 8);

        if (!code) {
            throw new Error("Unable to generate a subject code.");
        }

        return code;
    }


    /* ================= MT ID GENERATOR ================= */

    function getNextMtId(subject) {

        const code = getSubjectCode(subject);
        const storageKey = CONFIG.storagePrefix + "." + code;

        let previousNumber = 0;

        try {
            previousNumber = Number(
                localStorage.getItem(storageKey) || 0
            );
        } catch (error) {
            console.warn("MT ID storage is unavailable.", error);
        }

        if (
            !Number.isSafeInteger(previousNumber) ||
            previousNumber < 0
        ) {
            previousNumber = 0;
        }

        const nextNumber = previousNumber + 1;

        return {
            id: code + "-MT-" + String(nextNumber).padStart(3, "0"),
            number: nextNumber,
            storageKey: storageKey
        };
    }


    function saveMtIdCounter(counter) {

        try {
            localStorage.setItem(
                counter.storageKey,
                String(counter.number)
            );
        } catch (error) {
            console.warn("Unable to save MT ID counter.", error);
        }
    }


    /* ================= METADATA VALIDATION ================= */

    function validateMetadata(settings) {

        if (!settings || typeof settings !== "object") {
            throw new Error("Test information is missing.");
        }

        const subject = String(settings.subject || "").trim();

        if (!subject) {
            throw new Error("Please select a subject.");
        }

        const qrUrl = String(settings.qrUrl || "").trim();

        if (qrUrl) {

            let parsedUrl;

            try {
                parsedUrl = new URL(qrUrl);
            } catch (error) {
                throw new Error("The QR destination URL is invalid.");
            }

            if (
                parsedUrl.protocol !== "https:" &&
                parsedUrl.protocol !== "http:"
            ) {
                throw new Error("The QR URL must use HTTP or HTTPS.");
            }
        }

        return {
            subject: subject,
            title: String(settings.title || "").trim(),
            examType: String(settings.examType || "MOCK TEST").trim(),
            examName: String(settings.examName || "").trim(),
            qrUrl: qrUrl,
            mtId: String(settings.mtId || "").trim()
        };
    }


    /* ================= QUESTION VALIDATION ================= */

    function validateQuestions(questions) {

        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error("No valid MCQ questions were supplied.");
        }

        const expectedLabels = ["A", "B", "C", "D"];

        questions.forEach(function (question, index) {

            const number = index + 1;

            if (!question || typeof question !== "object") {
                throw new Error("Invalid question data at position " + number + ".");
            }

            if (!question.english || !question.assamese) {
                throw new Error(
                    "Both English and Assamese are required for Q" + number + "."
                );
            }

            ["english", "assamese"].forEach(function (language) {

                const data = question[language];

                if (
                    typeof data.question !== "string" ||
                    !data.question.trim()
                ) {
                    throw new Error(
                        language + " question is missing at Q" + number + "."
                    );
                }

                if (
                    !Array.isArray(data.options) ||
                    data.options.length !== 4
                ) {
                    throw new Error(
                        "Exactly four " + language +
                        " options are required at Q" + number + "."
                    );
                }

                data.options.forEach(function (option, optionIndex) {

                    if (
                        !option ||
                        option.label !== expectedLabels[optionIndex] ||
                        typeof option.text !== "string" ||
                        !option.text.trim()
                    ) {
                        throw new Error(
                            "Invalid " + language + " option " +
                            expectedLabels[optionIndex] + " at Q" + number + "."
                        );
                    }
                });

                if (!expectedLabels.includes(data.answer)) {
                    throw new Error(
                        "Invalid " + language + " answer at Q" + number + "."
                    );
                }
            });

            if (
                question.english.answer !== question.assamese.answer
            ) {
                throw new Error(
                    "English and Assamese answers do not match at Q" + number + "."
                );
            }
        });

        return true;
    }


    /* ================= ASSAMESE NUMBER ================= */

    function toAssameseNumber(number) {

        const digits = [
            "০", "১", "২", "৩", "৪",
            "৫", "৬", "৭", "৮", "৯"
        ];

        return String(number).replace(/\d/g, function (digit) {
            return digits[Number(digit)];
        });
    }


    /* ================= PDF CSS ================= */

    function installPdfStyles() {

        if (document.getElementById("pk-pdf-render-style")) {
            return;
        }

        const style = document.createElement("style");

        style.id = "pk-pdf-render-style";

        style.textContent = `

            #pk-pdf-capture,
            #pk-pdf-capture * {
                box-sizing: border-box;
            }

            #pk-pdf-capture {
                position: absolute;
                left: -12000px;
                top: 0;
                width: 210mm;
                background: #ffffff;
                color: #111111;
                pointer-events: none;
            }

            #pk-pdf-capture .sheet {
                width: 210mm;
                height: 297mm;
                margin: 0;
                padding: 10mm 11mm 8mm;
                background: #ffffff;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                box-shadow: none;
            }

            #pk-pdf-capture .page-header {
                flex: 0 0 14mm;
                display: grid;
                grid-template-columns:
                    max-content
                    max-content
                    max-content
                    10mm;
                justify-content: space-between;
                align-items: center;
                gap: 3mm;
                border-bottom: 0.3mm solid #777;
                padding-bottom: 3mm;
                font-family: Arial, sans-serif;
                white-space: nowrap;
            }

            #pk-pdf-capture .header-brand {
                font-size: 8pt;
                font-weight: 700;
                color: #111;
                letter-spacing: -0.2px;
            }

            #pk-pdf-capture .header-brand .in {
                color: #999;
            }

            #pk-pdf-capture .header-subject,
            #pk-pdf-capture .header-id {
                font-size: 8pt;
                font-weight: 600;
                color: #444;
                padding-left: 4mm;
                border-left: 0.2mm solid #d5d5d5;
            }

            #pk-pdf-capture .header-qr {
                width: 10mm;
                height: 10mm;
                display: block;
                object-fit: contain;
                flex-shrink: 0;
            }

            #pk-pdf-capture .question-grid {
                flex: 1;
                min-height: 0;
                display: grid;
                grid-template-rows: repeat(5, minmax(0, 1fr));
            }

            #pk-pdf-capture .question-pair {
                min-height: 0;
                display: grid;
                grid-template-columns:
                    minmax(0, 1fr)
                    minmax(0, 1fr);
                border-bottom: 0.25mm solid #d0d0d0;
                break-inside: avoid;
                page-break-inside: avoid;
            }

            #pk-pdf-capture .question-pair:last-child {
                border-bottom: none;
            }

            #pk-pdf-capture .language-card {
                min-width: 0;
                min-height: 0;
                padding: 4mm 4mm;
                display: flex;
                flex-direction: column;
            }

            #pk-pdf-capture .english {
                border-right: 0.3mm solid #bcbcbc;
                font-family: "Times New Roman", Times, serif;
            }

            #pk-pdf-capture .assamese {
                font-family: "Noto Sans Bengali", "Nirmala UI", sans-serif;
            }

            #pk-pdf-capture .question {
                font-size: 11pt;
                font-weight: 700;
                line-height: 1.35;
                margin: 0 0 3mm;
                color: #111;
            }

            #pk-pdf-capture .assamese .question {
                font-size: 10.5pt;
            }

            #pk-pdf-capture .question-number {
                font-weight: 700;
                white-space: nowrap;
            }

            #pk-pdf-capture .options {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                column-gap: 3mm;
                row-gap: 2.2mm;
                font-size: 9.5pt;
                line-height: 1.3;
            }

            #pk-pdf-capture .option {
                min-width: 0;
                display: flex;
                align-items: flex-start;
                gap: 1.5mm;
            }

            #pk-pdf-capture .option-label {
                flex-shrink: 0;
                font-weight: 700;
            }

            #pk-pdf-capture .answer {
                margin-top: auto;
                padding-top: 2.5mm;
                border-top: 0.2mm solid #e1e1e1;
                font-size: 9pt;
                font-weight: 700;
                line-height: 1.3;
            }

            #pk-pdf-capture .assamese .answer {
                font-size: 9pt;
            }

            #pk-pdf-capture .page-footer {
                flex: 0 0 8mm;
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                align-items: end;
                border-top: 0.25mm solid #bdbdbd;
                padding-top: 2mm;
                font-family: Arial, sans-serif;
                font-size: 7pt;
                font-weight: 600;
                color: #666;
                letter-spacing: 0.25px;
            }

            #pk-pdf-capture .footer-brand {
                color: #222;
                text-align: left;
            }

            #pk-pdf-capture .footer-subject {
                text-align: center;
            }

            #pk-pdf-capture .footer-page {
                text-align: right;
            }
        `;

        document.head.appendChild(style);
    }


    /* ================= DOM HELPERS ================= */

    function createElement(tag, className, text) {

        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined && text !== null) {
            element.textContent = String(text);
        }

        return element;
    }


    /* ================= QR IMAGE ================= */

    function createQrImage(url) {

        if (!url) {
            return Promise.resolve(null);
        }

        return new Promise(function (resolve, reject) {

            const image = new Image();

            image.crossOrigin = "anonymous";

            image.onload = function () {
                resolve(image);
            };

            image.onerror = function () {
                reject(
                    new Error(
                        "QR code could not be loaded. Check your internet connection and try again."
                    )
                );
            };

            image.src =
                "https://api.qrserver.com/v1/create-qr-code/?" +
                "size=240x240&margin=0&data=" +
                encodeURIComponent(url);
        });
    }


    /* ================= OPTION GRID ================= */

    function createOptions(data) {

        const container = createElement("div", "options");

        data.options.forEach(function (option) {

            const optionElement = createElement("div", "option");

            const label = createElement(
                "b",
                "option-label",
                option.label + "."
            );

            const text = createElement(
                "span",
                "option-text",
                option.text
            );

            optionElement.appendChild(label);
            optionElement.appendChild(text);

            container.appendChild(optionElement);
        });

        return container;
    }


    /* ================= ANSWER ================= */

    function createAnswer(data, language) {

        const correctOption = data.options.find(function (option) {
            return option.label === data.answer;
        });

        if (!correctOption) {
            throw new Error("Unable to locate the correct answer.");
        }

        const prefix = language === "assamese"
            ? "শুদ্ধ উত্তৰ: "
            : "Correct: ";

        return createElement(
            "div",
            "answer",
            prefix + data.answer + ". " + correctOption.text
        );
    }


    /* ================= LANGUAGE CARD ================= */

    function createLanguageCard(data, number, language) {

        const card = createElement(
            "div",
            "language-card " + language
        );

        const question = createElement("div", "question");

        const questionNumber = createElement(
            "span",
            "question-number",
            language === "assamese"
                ? "প্ৰশ্ন " + toAssameseNumber(number) + ". "
                : "Q" + number + ". "
        );

        question.appendChild(questionNumber);
        question.appendChild(
            document.createTextNode(data.question)
        );

        card.appendChild(question);
        card.appendChild(createOptions(data));
        card.appendChild(createAnswer(data, language));

        return card;
    }


    /* ================= QUESTION PAIR ================= */

    function createQuestionPair(question) {

        const pair = createElement("div", "question-pair");

        pair.appendChild(
            createLanguageCard(
                question.english,
                question.number,
                "english"
            )
        );

        pair.appendChild(
            createLanguageCard(
                question.assamese,
                question.number,
                "assamese"
            )
        );

        return pair;
    }


    /* ================= BUILD PAGE HEADER ================= */

    function createPageHeader(settings, qrImage) {

        const header = createElement("header", "page-header");

        const brand = createElement("span", "header-brand");

        brand.appendChild(
            document.createTextNode("Preparekora")
        );

        brand.appendChild(
            createElement("span", "in", ".in")
        );


        const subjectText = [
            settings.subject,
            settings.examType
        ]
            .filter(Boolean)
            .join(" · ")
            .toUpperCase();

        const subject = createElement(
            "span",
            "header-subject",
            subjectText
        );


        const id = createElement(
            "span",
            "header-id",
            "MT ID: " + settings.mtId
        );


        const qr = createElement("img", "header-qr");

        qr.alt = "Test QR Code";

        if (qrImage) {
            qr.src = qrImage.src;
        }


        header.appendChild(brand);
        header.appendChild(subject);
        header.appendChild(id);
        header.appendChild(qr);

        return header;
    }


    /* ================= BUILD PAGE FOOTER ================= */

    function createPageFooter(settings, pageNumber, totalPages) {

        const footer = createElement("footer", "page-footer");

        const brand = createElement(
            "span",
            "footer-brand",
            "PREPAREKORA.IN"
        );

        const subject = createElement(
            "span",
            "footer-subject",
            settings.subject.toUpperCase()
        );

        const page = createElement(
            "span",
            "footer-page",

            String(pageNumber).padStart(2, "0") +
            " / " +
            String(totalPages).padStart(2, "0")
        );

        footer.appendChild(brand);
        footer.appendChild(subject);
        footer.appendChild(page);

        return footer;
    }


    /* ================= BUILD COMPLETE PAGE ================= */

    function createPage(settings, questions, pageNumber, totalPages, qrImage) {

        const sheet = createElement("section", "sheet");

        sheet.appendChild(
            createPageHeader(settings, qrImage)
        );


        const grid = createElement("main", "question-grid");


        questions.forEach(function (question) {
            grid.appendChild(createQuestionPair(question));
        });


        sheet.appendChild(grid);

        sheet.appendChild(
            createPageFooter(settings, pageNumber, totalPages)
        );

        return sheet;
    }


    /* ================= PDF RENDER ROOT ================= */

    function createRenderRoot() {

        installPdfStyles();

        const existing = document.getElementById("pk-pdf-capture");

        if (existing) {
            existing.remove();
        }

        const root = createElement("div");

        root.id = "pk-pdf-capture";

        document.body.appendChild(root);

        return root;
    }


    /* ================= LOAD REQUIRED LIBRARIES ================= */

    function getLibraries() {

        const jsPDF =
            window.jspdf &&
            window.jspdf.jsPDF;

        const html2canvas = window.html2canvas;

        if (!jsPDF) {
            throw new Error("jsPDF library is not available.");
        }

        if (!html2canvas) {
            throw new Error("html2canvas library is not available.");
        }

        return {
            jsPDF: jsPDF,
            html2canvas: html2canvas
        };
    }


    /* ================= WAIT FOR FONTS ================= */

    async function waitForFonts() {

        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
    }


    /* ================= GENERATE PDF ================= */

    async function generate(settingsInput, questions) {

        let root = null;

        let mtCounter = null;

        try {

            const libraries = getLibraries();

            const settings = validateMetadata(settingsInput);

            validateQuestions(questions);


            /* Generate MT ID only when one is not supplied */

            if (!settings.mtId) {

                mtCounter = getNextMtId(settings.subject);

                settings.mtId = mtCounter.id;
            }


            const totalQuestions = questions.length;

            const totalPages = Math.ceil(
                totalQuestions / CONFIG.questionsPerPage
            );


            /* Load QR and fonts before capturing pages */

            const qrImage = await createQrImage(settings.qrUrl);

            await waitForFonts();


            root = createRenderRoot();


            const pdf = new libraries.jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4",
                compress: true
            });


            pdf.setProperties({
                title: settings.title || settings.subject,
                subject: settings.subject,
                author: "Preparekora.in",
                creator: "PrepareKora Studio"
            });


            /* Render each A4 page */

            for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {

                const startIndex =
                    pageIndex * CONFIG.questionsPerPage;

                const endIndex =
                    startIndex + CONFIG.questionsPerPage;

                const pageQuestions = questions.slice(
                    startIndex,
                    endIndex
                );


                const sheet = createPage(
                    settings,
                    pageQuestions,
                    pageIndex + 1,
                    totalPages,
                    qrImage
                );


                root.replaceChildren(sheet);


                /* Allow browser to calculate layout */

                await new Promise(function (resolve) {
                    requestAnimationFrame(function () {
                        requestAnimationFrame(resolve);
                    });
                });


                const canvas = await libraries.html2canvas(sheet, {

                    scale: CONFIG.captureScale,

                    backgroundColor: "#ffffff",

                    useCORS: true,

                    allowTaint: false,

                    logging: false,

                    width: sheet.scrollWidth,

                    height: sheet.scrollHeight,

                    windowWidth: Math.max(
                        document.documentElement.clientWidth,
                        1200
                    ),

                    imageTimeout: 20000,

                    onclone: function (clonedDocument) {

                        const clonedRoot =
                            clonedDocument.getElementById("pk-pdf-capture");

                        if (clonedRoot) {
                            clonedRoot.style.left = "0";
                            clonedRoot.style.top = "0";
                        }
                    }

                });


                const imageData = canvas.toDataURL("image/png");


                if (pageIndex > 0) {
                    pdf.addPage("a4", "portrait");
                }


                pdf.addImage(
                    imageData,
                    "PNG",
                    0,
                    0,
                    CONFIG.pageWidth,
                    CONFIG.pageHeight,
                    undefined,
                    "FAST"
                );


                /* Release the page canvas memory */

                canvas.width = 0;
                canvas.height = 0;
            }


            const pdfBlob = pdf.output("blob");


            if (!pdfBlob || pdfBlob.size === 0) {
                throw new Error("The PDF file could not be created.");
            }


            /* Save serial only after successful PDF generation */

            if (mtCounter) {
                saveMtIdCounter(mtCounter);
            }


            const safeFileName = settings.mtId
                .replace(/[^A-Z0-9_-]/gi, "_");


            const fileName = safeFileName + ".pdf";


            /* Preserve an independent snapshot for thumbnail integration */

            const testData = {

                mtId: settings.mtId,

                subject: settings.subject,

                title: settings.title,

                examType: settings.examType,

                examName: settings.examName,

                qrUrl: settings.qrUrl,

                totalQuestions: totalQuestions,

                totalPages: totalPages,

                questions: JSON.parse(
                    JSON.stringify(questions)
                )

            };


            return {

                success: true,

                blob: pdfBlob,

                fileName: fileName,

                mtId: settings.mtId,

                totalQuestions: totalQuestions,

                totalPages: totalPages,

                testData: testData

            };

        } catch (error) {

            console.error("PrepareKora PDF generation error:", error);

            throw error;

        } finally {

            if (root) {
                root.remove();
            }
        }
    }


    /* ================= DOWNLOAD PDF ================= */

    function download(result) {

        if (
            !result ||
            !result.success ||
            !(result.blob instanceof Blob)
        ) {
            throw new Error("A valid generated PDF is required.");
        }


        const objectUrl = URL.createObjectURL(result.blob);

        const link = document.createElement("a");

        link.href = objectUrl;

        link.download = result.fileName || "Preparekora_Test.pdf";

        document.body.appendChild(link);

        link.click();

        link.remove();


        window.setTimeout(function () {
            URL.revokeObjectURL(objectUrl);
        }, 1000);

        return true;
    }


    /* ================= PUBLIC API ================= */

    window.PDFGenerator = {

        generate: generate,

        download: download,

        getSubjectCode: getSubjectCode,

        version: "1.0.0"

    };


})(window, document);
