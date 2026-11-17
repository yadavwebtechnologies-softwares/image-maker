
/* =====================================================
   PREPAREKORA STUDIO
   MAIN APPLICATION CONTROLLER
   File: script.js

   Connects:
   1. index.html
   2. style.css
   3. mcq-parser.js
   4. pdf-generator.js
   5. thumbnail-maker.js
   6. thumbnail-integration.js

   Workflow:
   Subject + MCQs
        ↓
   Parse and Validate
        ↓
   Generate PDF
        ↓
   Display MT ID and details
        ↓
   Download PDF / Create Thumbnail

   MCQ Image Maker remains independent.
===================================================== */

(function (window, document) {

    "use strict";


    /* ================= APPLICATION STATE ================= */

    let latestPdfResult = null;

    let isGenerating = false;


    /* ================= DOM REFERENCES ================= */

    const elements = {

        subjectSelect: document.getElementById("subjectSelect"),

        customSubjectGroup: document.getElementById("customSubjectGroup"),

        customSubject: document.getElementById("customSubject"),

        testTitle: document.getElementById("testTitle"),

        examType: document.getElementById("examType"),

        examName: document.getElementById("examName"),

        qrUrl: document.getElementById("qrUrl"),

        mcqInput: document.getElementById("mcqInput"),


        createButton: document.getElementById("createTestBtn"),

        clearButton: document.getElementById("clearInputBtn"),

        downloadButton: document.getElementById("downloadPdfBtn"),

        thumbnailButton: document.getElementById("createThumbnailBtn"),


        validationMessage: document.getElementById("validationMessage"),

        generatedPanel: document.getElementById("generatedTestPanel"),


        generatedMtId: document.getElementById("generatedMtId"),

        generatedSubject: document.getElementById("generatedSubject"),

        generatedQuestionCount: document.getElementById("generatedQuestionCount"),

        generatedPageCount: document.getElementById("generatedPageCount")

    };


    /* ================= HELPERS ================= */

    function getElement(id) {

        return document.getElementById(id);

    }


    function setText(element, value) {

        if (!element) {
            return;
        }

        element.textContent =
            value === null || value === undefined
                ? ""
                : String(value);

    }


    function setButtonState(button, disabled, text) {

        if (!button) {
            return;
        }

        button.disabled = disabled;

        if (text !== undefined) {
            button.textContent = text;
        }

    }


    /* ================= STATUS MESSAGE ================= */

    function showMessage(message, type) {

        const container = elements.validationMessage;

        if (!container) {
            return;
        }


        container.hidden = false;

        container.classList.remove(
            "success",
            "error"
        );


        if (type) {
            container.classList.add(type);
        }


        container.textContent = String(message || "");

    }


    function showErrors(errors) {

        const container = elements.validationMessage;

        if (!container) {
            return;
        }


        container.hidden = false;

        container.classList.remove("success");

        container.classList.add("error");

        container.replaceChildren();


        const heading = document.createElement("strong");

        heading.textContent =
            "Please correct the following errors:";


        const list = document.createElement("ul");

        list.style.margin = "10px 0 0";

        list.style.paddingLeft = "20px";


        errors.forEach(function (error) {

            const item = document.createElement("li");

            item.style.marginBottom = "5px";

            item.textContent =
                typeof error === "string"
                    ? error
                    : error.message;

            list.appendChild(item);

        });


        container.appendChild(heading);

        container.appendChild(list);

    }


    function hideMessage() {

        const container = elements.validationMessage;

        if (!container) {
            return;
        }


        container.hidden = true;

        container.classList.remove(
            "success",
            "error"
        );

        container.textContent = "";

    }


    /* ================= SUBJECT HANDLING ================= */

    function updateCustomSubjectVisibility() {

        const selectedSubject =
            elements.subjectSelect.value;


        if (selectedSubject === "Custom") {

            elements.customSubjectGroup.hidden = false;

            elements.customSubject.required = true;

        } else {

            elements.customSubjectGroup.hidden = true;

            elements.customSubject.required = false;

        }

    }


    function getSelectedSubject() {

        const selectedSubject =
            elements.subjectSelect.value.trim();


        if (!selectedSubject) {

            throw new Error("Please select a subject.");

        }


        if (selectedSubject === "Custom") {

            const customSubject =
                elements.customSubject.value.trim();


            if (!customSubject) {

                throw new Error(
                    "Please enter your custom subject name."
                );

            }


            return customSubject;

        }


        return selectedSubject;

    }


    /* ================= READ TEST INFORMATION ================= */

    function getTestMetadata() {

        const subject = getSelectedSubject();

        const title =
            elements.testTitle.value.trim();


        if (!title) {

            throw new Error("Please enter the test title.");

        }


        const examType =
            elements.examType.value.trim();


        const examName =
            elements.examName.value.trim();


        const qrUrl =
            elements.qrUrl.value.trim();


        if (qrUrl) {

            try {

                const parsedUrl = new URL(qrUrl);

                if (
                    parsedUrl.protocol !== "https:" &&
                    parsedUrl.protocol !== "http:"
                ) {

                    throw new Error();

                }

            } catch (error) {

                throw new Error(
                    "Please enter a valid HTTP or HTTPS QR destination URL."
                );

            }

        }


        return {

            subject: subject,

            title: title,

            examType: examType || "MOCK EXAMINATION",

            examName: examName,

            qrUrl: qrUrl

        };

    }


    /* ================= PARSE MCQ INPUT ================= */

    function parseMcqInput() {

        if (
            !window.MCQParser ||
            typeof window.MCQParser.parse !== "function"
        ) {

            throw new Error(
                "MCQ Parser is unavailable. Check mcq-parser.js."
            );

        }


        const input =
            elements.mcqInput.value;


        if (!input.trim()) {

            throw new Error(
                "Please paste your English and Assamese MCQs."
            );

        }


        const result =
            window.MCQParser.parse(input);


        if (!result.valid) {

            return {

                valid: false,

                errors: result.formattedErrors &&
                    result.formattedErrors.length
                        ? result.formattedErrors
                        : result.errors.map(function (error) {

                            return error.message;

                        })

            };

        }


        return {

            valid: true,

            questions: result.questions,

            totalQuestions: result.totalQuestions

        };

    }


    /* ================= DISPLAY GENERATED DETAILS ================= */

    function displayGeneratedResult(result) {

        if (!result || !result.success) {

            throw new Error(
                "PDF generation did not return a valid result."
            );

        }


        setText(
            elements.generatedMtId,
            result.testData.mtId
        );


        setText(
            elements.generatedSubject,
            result.testData.subject
        );


        setText(
            elements.generatedQuestionCount,
            result.testData.totalQuestions
        );


        setText(
            elements.generatedPageCount,
            result.testData.totalPages
        );


        elements.generatedPanel.hidden = false;


        elements.generatedPanel.scrollIntoView({

            behavior: "smooth",

            block: "nearest"

        });

    }


    /* ================= CLEAR GENERATED RESULT ================= */

    function clearGeneratedResult() {

        latestPdfResult = null;


        if (elements.generatedPanel) {
            elements.generatedPanel.hidden = true;
        }


        if (
            window.PrepareKoraThumbnail &&
            typeof window.PrepareKoraThumbnail.reset === "function"
        ) {

            window.PrepareKoraThumbnail.reset();

        }

    }


    /* ================= INVALIDATE STALE DATA ================= */

    function handleTestInputChange() {

        if (!latestPdfResult) {
            return;
        }


        clearGeneratedResult();


        showMessage(
            "Test information changed. Create the PDF again before downloading or creating its thumbnail.",
            ""
        );

    }


    /* ================= CREATE PDF ================= */

    async function createTest() {

        if (isGenerating) {
            return;
        }


        hideMessage();


        try {

            /* Check dependencies */

            if (
                !window.PDFGenerator ||
                typeof window.PDFGenerator.generate !== "function"
            ) {

                throw new Error(
                    "PDF Generator is unavailable. Check pdf-generator.js."
                );

            }


            if (
                !window.MCQParser ||
                typeof window.MCQParser.parse !== "function"
            ) {

                throw new Error(
                    "MCQ Parser is unavailable. Check mcq-parser.js."
                );

            }


            /* Read metadata */

            const metadata = getTestMetadata();


            /* Parse question data */

            const parsed = parseMcqInput();


            if (!parsed.valid) {

                showErrors(parsed.errors);

                return;

            }


            clearGeneratedResult();


            isGenerating = true;


            setButtonState(
                elements.createButton,
                true,
                "Creating PDF..."
            );


            showMessage(
                "Validating questions and generating your A4 PDF...",
                ""
            );


            /* Generate PDF */

            const result = await window.PDFGenerator.generate(
                metadata,
                parsed.questions
            );


            if (
                !result ||
                result.success !== true ||
                !result.testData
            ) {

                throw new Error(
                    "PDF generation returned an incomplete result."
                );

            }


            /*
             * Keep the exact generated test snapshot.
             *
             * Thumbnail Maker will use this snapshot,
             * not unsaved form contents.
             */

            latestPdfResult = result;


            /* Display generated details */

            displayGeneratedResult(result);


            showMessage(
                "PDF created successfully. MT ID: " +
                result.testData.mtId +
                ". You can now download it or create its thumbnail.",
                "success"
            );


        } catch (error) {

            console.error(
                "PrepareKora Studio PDF creation error:",
                error
            );


            latestPdfResult = null;


            showMessage(
                error.message ||
                "Something went wrong while creating the PDF.",
                "error"
            );


        } finally {

            isGenerating = false;


            setButtonState(
                elements.createButton,
                false,
                "Create PDF"
            );

        }

    }


    /* ================= DOWNLOAD PDF ================= */

    function downloadPdf() {

        if (!latestPdfResult) {

            showMessage(
                "Please create a PDF first.",
                "error"
            );

            return;

        }


        try {

            if (
                !window.PDFGenerator ||
                typeof window.PDFGenerator.download !== "function"
            ) {

                throw new Error(
                    "PDF download functionality is unavailable."
                );

            }


            window.PDFGenerator.download(
                latestPdfResult
            );


        } catch (error) {

            console.error(
                "PDF download error:",
                error
            );


            showMessage(
                error.message ||
                "Unable to download the PDF.",
                "error"
            );

        }

    }


    /* ================= NAVIGATION ================= */

    function setView(targetId) {

        const views = document.querySelectorAll(
            ".app-view"
        );


        views.forEach(function (view) {

            const isActive =
                view.id === targetId;


            view.classList.toggle(
                "active",
                isActive
            );


            view.hidden = !isActive;

        });


        const navigationButtons = document.querySelectorAll(
            "[data-view-target]"
        );


        navigationButtons.forEach(function (button) {

            const isActive =
                button.dataset.viewTarget === targetId;


            button.classList.toggle(
                "active",
                isActive
            );


            if (isActive) {

                button.setAttribute(
                    "aria-current",
                    "page"
                );

            } else {

                button.removeAttribute("aria-current");

            }

        });


        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });


        return true;

    }


    function bindNavigation() {

        const navigationButtons = document.querySelectorAll(
            "[data-view-target]"
        );


        navigationButtons.forEach(function (button) {

            if (button.dataset.appNavigation === "attached") {
                return;
            }


            button.dataset.appNavigation = "attached";


            button.addEventListener("click", function () {

                const targetId =
                    button.dataset.viewTarget;


                if (!getElement(targetId)) {

                    console.error(
                        "Navigation target not found:",
                        targetId
                    );

                    return;

                }


                setView(targetId);

            });

        });

    }


    /* ================= CREATE THUMBNAIL ================= */

    function createThumbnail() {

        if (!latestPdfResult) {

            showMessage(
                "Create the PDF first. Thumbnail data must come from a successfully generated test.",
                "error"
            );

            return;

        }


        try {

            if (
                !window.PrepareKoraThumbnail ||
                typeof window.PrepareKoraThumbnail.setTestData !== "function"
            ) {

                throw new Error(
                    "Thumbnail integration is unavailable. Check thumbnail-integration.js."
                );

            }


            /*
             * Transfer the exact PDF result snapshot.
             */

            window.PrepareKoraThumbnail.setTestData(
                latestPdfResult
            );


            window.PrepareKoraThumbnail.open();


            /* Open the thumbnail workspace */

            setView("thumbnailView");


        } catch (error) {

            console.error(
                "Thumbnail integration error:",
                error
            );


            showMessage(
                error.message ||
                "Unable to connect the generated test to Thumbnail Maker.",
                "error"
            );

        }

    }


    /* ================= CLEAR INPUT ================= */

    function clearInput() {

        const confirmed = window.confirm(
            "Clear all MCQ text from the input box?"
        );


        if (!confirmed) {
            return;
        }


        elements.mcqInput.value = "";


        clearGeneratedResult();

        hideMessage();


        elements.mcqInput.focus();

    }


    /* ================= FORM INPUT EVENTS ================= */

    function bindTestInputEvents() {

        const inputFields = [

            elements.subjectSelect,

            elements.customSubject,

            elements.testTitle,

            elements.examType,

            elements.examName,

            elements.qrUrl,

            elements.mcqInput

        ];


        inputFields.forEach(function (field) {

            if (!field) {
                return;
            }


            if (field.dataset.testListener === "attached") {
                return;
            }


            field.dataset.testListener = "attached";


            field.addEventListener(
                "input",
                handleTestInputChange
            );


            field.addEventListener(
                "change",
                handleTestInputChange
            );

        });

    }


    /* ================= BUTTON EVENTS ================= */

    function bindActionButtons() {

        if (
            elements.createButton &&
            elements.createButton.dataset.appListener !== "attached"
        ) {

            elements.createButton.dataset.appListener = "attached";

            elements.createButton.addEventListener(
                "click",
                createTest
            );

        }


        if (
            elements.clearButton &&
            elements.clearButton.dataset.appListener !== "attached"
        ) {

            elements.clearButton.dataset.appListener = "attached";

            elements.clearButton.addEventListener(
                "click",
                clearInput
            );

        }


        if (
            elements.downloadButton &&
            elements.downloadButton.dataset.appListener !== "attached"
        ) {

            elements.downloadButton.dataset.appListener = "attached";

            elements.downloadButton.addEventListener(
                "click",
                downloadPdf
            );

        }


        if (
            elements.thumbnailButton &&
            elements.thumbnailButton.dataset.appListener !== "attached"
        ) {

            elements.thumbnailButton.dataset.appListener = "attached";

            elements.thumbnailButton.addEventListener(
                "click",
                createThumbnail
            );

        }


        if (
            elements.subjectSelect &&
            elements.subjectSelect.dataset.subjectListener !== "attached"
        ) {

            elements.subjectSelect.dataset.subjectListener = "attached";

            elements.subjectSelect.addEventListener(
                "change",
                updateCustomSubjectVisibility
            );

        }

    }


    /* ================= STARTUP VALIDATION ================= */

    function checkRequiredElements() {

        const requiredIds = [

            "subjectSelect",

            "customSubjectGroup",

            "customSubject",

            "testTitle",

            "examType",

            "examName",

            "qrUrl",

            "mcqInput",

            "createTestBtn",

            "clearInputBtn",

            "downloadPdfBtn",

            "createThumbnailBtn",

            "validationMessage",

            "generatedTestPanel",

            "generatedMtId",

            "generatedSubject",

            "generatedQuestionCount",

            "generatedPageCount"

        ];


        const missing = requiredIds.filter(function (id) {

            return !getElement(id);

        });


        if (missing.length > 0) {

            console.error(
                "PrepareKora Studio missing HTML elements:",
                missing
            );

            return false;

        }


        return true;

    }


    /* ================= INITIALIZE ================= */

    function init() {

        if (!checkRequiredElements()) {

            console.error(
                "PrepareKora Studio could not initialize completely."
            );

            return false;

        }


        updateCustomSubjectVisibility();


        bindNavigation();

        bindTestInputEvents();

        bindActionButtons();


        /* Initial view */

        setView("pdfBuilderView");


        if (elements.generatedPanel) {
            elements.generatedPanel.hidden = true;
        }


        hideMessage();


        console.info(
            "PrepareKora Studio initialized successfully."
        );


        return true;

    }


    /* ================= PUBLIC API ================= */

    window.PrepareKoraStudio = {

        createTest: createTest,

        downloadPdf: downloadPdf,

        createThumbnail: createThumbnail,

        setView: setView,

        getLatestPdfResult: function () {
            return latestPdfResult;
        },

        clearGeneratedResult: clearGeneratedResult,

        version: "1.0.0"

    };


    /* ================= APPLICATION START ================= */

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            { once: true }
        );

    } else {

        init();

    }


})(window, document);
