
/* =====================================================
   PREPAREKORA STUDIO
   THUMBNAIL INTEGRATION
   File: thumbnail-integration.js

   Responsibilities:
   1. Receive successfully generated PDF test data.
   2. Preserve a snapshot of that test.
   3. Transfer common fields to the original Thumbnail Maker.
   4. Populate selected English question and options.
   5. Provide a question selector.
   6. Keep manual-only fields unchanged.

   Required existing Thumbnail Maker input IDs:

   in-mtId
   in-subject
   in-title
   in-examType
   in-questions
   in-examName
   in-question
   in-optA
   in-optB
   in-optC
   in-optD
   in-time
   in-url

   Expected Thumbnail Maker API:
   window.ThumbTool.refresh()

   Does not modify the independent MCQ Image Maker.
===================================================== */

(function (window, document) {

    "use strict";


    /* ================= STATE ================= */

    let currentTest = null;

    let selectedQuestionNumber = null;


    /* ================= FIELD MAPPING ================= */

    const FIELD_MAP = {

        mtId: "in-mtId",

        subject: "in-subject",

        title: "in-title",

        examType: "in-examType",

        questions: "in-questions",

        examName: "in-examName",

        question: "in-question",

        optA: "in-optA",

        optB: "in-optB",

        optC: "in-optC",

        optD: "in-optD",

        url: "in-url"

    };


    const OPTION_FIELDS = {

        A: "in-optA",

        B: "in-optB",

        C: "in-optC",

        D: "in-optD"

    };


    /* ================= HELPERS ================= */

    function cloneData(data) {

        return JSON.parse(JSON.stringify(data));

    }


    function getField(id) {

        return document.getElementById(id);

    }


    function setField(id, value) {

        const element = getField(id);

        if (!element) {
            return false;
        }


        element.value =
            value === undefined || value === null
                ? ""
                : String(value);


        /*
         * Notify the original Thumbnail Maker's
         * existing input listeners.
         */

        element.dispatchEvent(
            new Event("input", { bubbles: true })
        );


        element.dispatchEvent(
            new Event("change", { bubbles: true })
        );


        return true;
    }


    function getQuestion(number) {

        if (!currentTest) {
            return null;
        }


        return currentTest.questions.find(function (question) {

            return question.number === Number(number);

        }) || null;

    }


    function getOption(question, label) {

        if (
            !question ||
            !question.english ||
            !Array.isArray(question.english.options)
        ) {
            return "";
        }


        const option = question.english.options.find(function (item) {

            return item.label === label;

        });


        return option ? option.text : "";

    }


    /* ================= STATUS ================= */

    function updateNotice(message, type) {

        const notice = getField("thumbnailNotice");

        if (!notice) {
            return;
        }


        notice.textContent = message;

        notice.classList.remove(
            "success",
            "error"
        );


        if (type) {
            notice.classList.add(type);
        }

    }


    /* ================= TEST DATA VALIDATION ================= */

    function validateTestData(data) {

        if (!data || typeof data !== "object") {

            throw new Error("Generated test data is missing.");

        }


        if (!data.mtId) {

            throw new Error("The test MT ID is missing.");

        }


        if (!data.subject) {

            throw new Error("The test subject is missing.");

        }


        if (
            !Array.isArray(data.questions) ||
            data.questions.length === 0
        ) {

            throw new Error("No test questions are available.");

        }


        data.questions.forEach(function (question, index) {

            if (
                !question ||
                !question.english ||
                !question.english.question ||
                !Array.isArray(question.english.options) ||
                question.english.options.length !== 4
            ) {

                throw new Error(
                    "Invalid English thumbnail data at question " +
                    (index + 1) + "."
                );

            }

        });


        return true;

    }


    /* ================= SELECTOR STYLES ================= */

    function installSelectorStyles() {

        if (getField("pk-thumbnail-integration-style")) {
            return;
        }


        const style = document.createElement("style");

        style.id = "pk-thumbnail-integration-style";


        style.textContent = `

            .pk-thumbnail-question-control {
                margin: 0 0 20px;
                padding: 18px;

                background: #ffffff;

                border: 1px solid #dedede;
                border-radius: 8px;

                font-family: Arial, Helvetica, sans-serif;
            }

            .pk-thumbnail-question-control label {
                display: block;

                margin-bottom: 9px;

                color: #333333;

                font-size: 12px;
                font-weight: 700;
            }

            .pk-thumbnail-question-control select {
                width: 100%;
                min-height: 42px;

                padding: 10px 12px;

                border: 1px solid #d8d8d8;
                border-radius: 6px;

                background: #ffffff;
                color: #222222;

                font-size: 12px;

                outline: none;
            }

            .pk-thumbnail-question-control select:focus {
                border-color: #777777;
            }

            .pk-thumbnail-question-control small {
                display: block;

                margin-top: 8px;

                color: #858585;

                font-size: 10px;
                line-height: 1.5;
            }

            @media (max-width: 600px) {

                .pk-thumbnail-question-control {
                    padding: 14px;
                }

            }

        `;


        document.head.appendChild(style);

    }


    /* ================= QUESTION SELECTOR ================= */

    function createQuestionSelector() {

        if (!currentTest) {
            return;
        }


        const mount = getField("thumbnailMakerMount");

        if (!mount) {
            return;
        }


        installSelectorStyles();


        let wrapper = getField("pkThumbnailQuestionControl");


        if (!wrapper) {

            wrapper = document.createElement("section");

            wrapper.id = "pkThumbnailQuestionControl";

            wrapper.className =
                "pk-thumbnail-question-control";


            const label = document.createElement("label");

            label.htmlFor = "pkThumbnailQuestionSelect";

            label.textContent =
                "Select Thumbnail Question";


            const select = document.createElement("select");

            select.id = "pkThumbnailQuestionSelect";

            select.name = "thumbnailQuestion";


            const description = document.createElement("small");

            description.textContent =
                "Choose the English question and options to display on your thumbnail.";


            wrapper.appendChild(label);

            wrapper.appendChild(select);

            wrapper.appendChild(description);


            /*
             * Place the selector above the original
             * Thumbnail Maker interface.
             */

            mount.parentNode.insertBefore(
                wrapper,
                mount
            );


            select.addEventListener("change", function () {

                selectQuestion(Number(select.value));

            });

        }


        const selector = getField("pkThumbnailQuestionSelect");

        selector.replaceChildren();


        currentTest.questions.forEach(function (question, index) {

            const option = document.createElement("option");

            option.value = String(question.number);


            const preview = question.english.question
                .replace(/\s+/g, " ")
                .trim();


            option.textContent =
                "Q" + question.number + " — " +
                (
                    preview.length > 65
                        ? preview.slice(0, 65) + "..."
                        : preview
                );


            selector.appendChild(option);

        });


        if (selectedQuestionNumber !== null) {

            selector.value = String(selectedQuestionNumber);

        }


        wrapper.hidden = false;

    }


    /* ================= COMMON FIELD POPULATION ================= */

    function populateCommonFields() {

        if (!currentTest) {
            return false;
        }


        const values = {

            mtId: currentTest.mtId,

            subject: currentTest.subject,

            title: currentTest.title || "",

            examType: currentTest.examType || "",

            questions: currentTest.totalQuestions ||
                currentTest.questions.length,

            examName: currentTest.examName || "",

            url: currentTest.qrUrl || ""

        };


        Object.keys(values).forEach(function (key) {

            const fieldId = FIELD_MAP[key];

            setField(fieldId, values[key]);

        });


        /*
         * Intentionally do not update in-time.
         * Time Limit remains available for manual editing.
         */

        return true;

    }


    /* ================= SELECTED QUESTION ================= */

    function populateSelectedQuestion() {

        if (!currentTest) {
            return false;
        }


        const question = getQuestion(selectedQuestionNumber);

        if (!question) {
            return false;
        }


        setField(
            FIELD_MAP.question,
            question.english.question
        );


        Object.keys(OPTION_FIELDS).forEach(function (label) {

            setField(
                OPTION_FIELDS[label],
                getOption(question, label)
            );

        });


        return true;

    }


    /* ================= REFRESH ORIGINAL THUMBNAIL ================= */

    function refreshOriginalThumbnail() {

        if (
            window.ThumbTool &&
            typeof window.ThumbTool.refresh === "function"
        ) {

            window.ThumbTool.refresh();

        }

    }


    /* ================= POPULATE EVERYTHING ================= */

    function populate() {

        if (!currentTest) {

            throw new Error(
                "Generate a PDF before creating its thumbnail."
            );

        }


        populateCommonFields();

        populateSelectedQuestion();

        createQuestionSelector();

        refreshOriginalThumbnail();


        updateNotice(
            "Test " + currentTest.mtId +
            " connected successfully. You can now customize and download your thumbnail.",
            "success"
        );


        return true;

    }


    /* ================= SELECT QUESTION ================= */

    function selectQuestion(number) {

        if (!currentTest) {
            return false;
        }


        const question = getQuestion(number);

        if (!question) {

            throw new Error(
                "The selected question does not exist."
            );

        }


        selectedQuestionNumber = question.number;


        const selector = getField(
            "pkThumbnailQuestionSelect"
        );


        if (selector) {

            selector.value = String(selectedQuestionNumber);

        }


        populateSelectedQuestion();

        refreshOriginalThumbnail();


        return true;

    }


    /* ================= SET GENERATED TEST ================= */

    function setTestData(pdfResult) {

        if (!pdfResult || pdfResult.success !== true) {

            throw new Error(
                "Only a successfully generated PDF can be connected."
            );

        }


        if (!pdfResult.testData) {

            throw new Error(
                "Generated PDF test data is unavailable."
            );

        }


        const newSnapshot = cloneData(
            pdfResult.testData
        );


        validateTestData(newSnapshot);


        /*
         * Replace the previous snapshot only after
         * successful validation.
         */

        currentTest = newSnapshot;


        selectedQuestionNumber =
            currentTest.questions[0].number;


        /*
         * Populate original Thumbnail Maker fields.
         */

        populate();


        return getTestData();

    }


    /* ================= OPEN THUMBNAIL WORKSPACE ================= */

    function open() {

        if (!currentTest) {

            updateNotice(
                "Please generate a PDF first. Thumbnail data cannot be created from unsaved input.",
                "error"
            );

            return false;

        }


        populate();

        return true;

    }


    /* ================= GET CURRENT TEST SNAPSHOT ================= */

    function getTestData() {

        if (!currentTest) {
            return null;
        }


        return cloneData(currentTest);

    }


    /* ================= CURRENT QUESTION ================= */

    function getSelectedQuestion() {

        if (!currentTest) {
            return null;
        }


        const question = getQuestion(selectedQuestionNumber);

        return question ? cloneData(question) : null;

    }


    /* ================= RESET INTEGRATION ================= */

    function reset() {

        currentTest = null;

        selectedQuestionNumber = null;


        const selector = getField(
            "pkThumbnailQuestionControl"
        );


        if (selector) {
            selector.hidden = true;
        }


        updateNotice(
            "Create a PDF first to load its test information here.",
            ""
        );


        return true;

    }


    /* ================= PUBLIC API ================= */

    window.PrepareKoraThumbnail = {

        setTestData: setTestData,

        populate: populate,

        open: open,

        selectQuestion: selectQuestion,

        getTestData: getTestData,

        getSelectedQuestion: getSelectedQuestion,

        hasTest: function () {
            return currentTest !== null;
        },

        reset: reset,

        version: "1.0.0"

    };


})(window, document);
