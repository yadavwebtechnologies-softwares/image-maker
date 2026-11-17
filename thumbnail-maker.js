
/* =====================================================
   PREPAREKORA STUDIO
   THUMBNAIL MAKER ENGINE
   File: thumbnail-maker.js

   Responsibilities:
   1. Manage thumbnail input state.
   2. Preserve user-entered thumbnail data.
   3. Render data into the existing banner preview.
   4. Support 16:9 and 9:16 formats.
   5. Generate QR code previews.
   6. Export PNG images.
   7. Support original manual input fields.
   8. Expose ThumbTool.refresh() for integration.

   Required libraries:
   - html2canvas 1.4.1

   Required existing elements:
   - #tool-thumb
   - #banner
   - #portraitBtn
   - #landscapeBtn
   - Original thumbnail input IDs.

   Preview text can use data-thumb-field attributes
   or the supported output ID conventions below.

   This file does not control MCQ Image Maker.
===================================================== */

(function (window, document) {

    "use strict";


    /* ================= CONFIGURATION ================= */

    const CONFIG = {

        storageKey: "pk_banner_state",

        landscapeWidth: 1920,
        landscapeHeight: 1080,

        portraitWidth: 1080,
        portraitHeight: 1920,

        qrBaseUrl: "https://quickchart.io/qr?size=300&text=",

        captureScale: 2

    };


    /* ================= DEFAULT DATA ================= */

    const DEFAULT_DATA = {

        mtId: "ADR/GK/01/022",

        subject: "GENERAL KNOWLEDGE",

        title: "Important\nMCQs",

        examType: "MOCK EXAMINATION",

        examName: "ADRE\nGeneral\nKnowledge",

        question: "Who is the Education Minister of Assam?",

        optA: "Ranoj Pegu",

        optB: "Himanta Biswa Sarma",

        optC: "Gaurav Gogoi",

        optD: "Nitin Gadkari",

        questions: "120",

        time: "30 Min",

        url: ""

    };


    /* ================= INPUT MAP ================= */

    const INPUT_MAP = {

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

        time: "in-time",

        url: "in-url"

    };


    /* ================= STATE ================= */

    let thumbState = loadState();

    let currentFormat = "landscape";

    let isDownloading = false;


    /* ================= HELPERS ================= */

    function getElement(id) {

        return document.getElementById(id);

    }


    function safeString(value) {

        if (value === null || value === undefined) {
            return "";
        }

        return String(value);
    }


    function cloneObject(value) {

        return JSON.parse(JSON.stringify(value));

    }


    function safeStorageWrite(value) {

        try {

            localStorage.setItem(
                CONFIG.storageKey,
                JSON.stringify(value)
            );

            return true;

        } catch (error) {

            console.warn(
                "Thumbnail data could not be saved.",
                error
            );

            return false;
        }
    }


    /* ================= LOAD SAVED STATE ================= */

    function loadState() {

        try {

            const saved = localStorage.getItem(
                CONFIG.storageKey
            );


            if (!saved) {
                return cloneObject(DEFAULT_DATA);
            }


            const parsed = JSON.parse(saved);


            if (
                !parsed ||
                typeof parsed !== "object" ||
                Array.isArray(parsed)
            ) {

                return cloneObject(DEFAULT_DATA);

            }


            return Object.assign(
                {},
                DEFAULT_DATA,
                parsed
            );

        } catch (error) {

            console.warn(
                "Unable to read saved thumbnail data.",
                error
            );

            return cloneObject(DEFAULT_DATA);

        }

    }


    /* ================= UPDATE STATE FROM INPUTS ================= */

    function readInputs() {

        Object.keys(INPUT_MAP).forEach(function (key) {

            const field = getElement(INPUT_MAP[key]);

            if (!field) {
                return;
            }


            thumbState[key] = safeString(field.value);

        });

    }


    /* ================= SET INPUT VALUES ================= */

    function populateInputs() {

        Object.keys(INPUT_MAP).forEach(function (key) {

            const field = getElement(INPUT_MAP[key]);

            if (!field) {
                return;
            }


            const value = safeString(thumbState[key]);


            if (field.value !== value) {

                field.value = value;

            }

        });

    }


    /* ================= PREVIEW OUTPUT SELECTORS ================= */

    const OUTPUT_SELECTORS = {

        mtId: [
            '[data-thumb-field="mtId"]',
            '[data-field="mtId"]',
            '[data-bind="mtId"]',
            '#out-mtId',
            '#display-mtId',
            '#thumb-mtId'
        ],

        subject: [
            '[data-thumb-field="subject"]',
            '[data-field="subject"]',
            '[data-bind="subject"]',
            '#out-subject',
            '#display-subject',
            '#thumb-subject'
        ],

        title: [
            '[data-thumb-field="title"]',
            '[data-field="title"]',
            '[data-bind="title"]',
            '#out-title',
            '#display-title',
            '#thumb-title'
        ],

        examType: [
            '[data-thumb-field="examType"]',
            '[data-field="examType"]',
            '[data-bind="examType"]',
            '#out-examType',
            '#display-examType',
            '#thumb-examType'
        ],

        examName: [
            '[data-thumb-field="examName"]',
            '[data-field="examName"]',
            '[data-bind="examName"]',
            '#out-examName',
            '#display-examName',
            '#thumb-examName'
        ],

        question: [
            '[data-thumb-field="question"]',
            '[data-field="question"]',
            '[data-bind="question"]',
            '#out-question',
            '#display-question',
            '#thumb-question'
        ],

        optA: [
            '[data-thumb-field="optA"]',
            '[data-field="optA"]',
            '[data-bind="optA"]',
            '#out-optA',
            '#display-optA',
            '#thumb-optA'
        ],

        optB: [
            '[data-thumb-field="optB"]',
            '[data-field="optB"]',
            '[data-bind="optB"]',
            '#out-optB',
            '#display-optB',
            '#thumb-optB'
        ],

        optC: [
            '[data-thumb-field="optC"]',
            '[data-field="optC"]',
            '[data-bind="optC"]',
            '#out-optC',
            '#display-optC',
            '#thumb-optC'
        ],

        optD: [
            '[data-thumb-field="optD"]',
            '[data-field="optD"]',
            '[data-bind="optD"]',
            '#out-optD',
            '#display-optD',
            '#thumb-optD'
        ],

        questions: [
            '[data-thumb-field="questions"]',
            '[data-field="questions"]',
            '[data-bind="questions"]',
            '#out-questions',
            '#display-questions',
            '#thumb-questions'
        ],

        time: [
            '[data-thumb-field="time"]',
            '[data-field="time"]',
            '[data-bind="time"]',
            '#out-time',
            '#display-time',
            '#thumb-time'
        ]

    };


    /* ================= FIND PREVIEW ELEMENTS ================= */

    function findOutputElements(key) {

        const banner = getElement("banner");

        if (!banner) {
            return [];
        }


        const selectors = OUTPUT_SELECTORS[key] || [];

        const results = [];


        selectors.forEach(function (selector) {

            try {

                banner.querySelectorAll(selector).forEach(function (element) {

                    if (!results.includes(element)) {
                        results.push(element);
                    }

                });

            } catch (error) {

                console.warn(
                    "Invalid thumbnail preview selector:",
                    selector
                );

            }

        });


        return results;

    }


    /* ================= RENDER PREVIEW TEXT ================= */

    function renderThumb() {

        const banner = getElement("banner");

        if (!banner) {
            return false;
        }


        Object.keys(thumbState).forEach(function (key) {

            if (!OUTPUT_SELECTORS[key]) {
                return;
            }


            const value = safeString(thumbState[key]);

            const elements = findOutputElements(key);


            elements.forEach(function (element) {

                if (element.textContent !== value) {

                    element.textContent = value;

                }

            });

        });


        updateThumbQR();

        return true;

    }


    /* ================= QR IMAGE ================= */

    function getQRImages() {

        const banner = getElement("banner");

        if (!banner) {
            return [];
        }


        const selectors = [

            '[data-thumb-qr]',

            '.qr-code img',

            '.qr-container img',

            '#thumbQR',

            '#qrImage',

            '#bannerQR'

        ];


        const images = [];


        selectors.forEach(function (selector) {

            try {

                banner.querySelectorAll(selector).forEach(function (image) {

                    if (!images.includes(image)) {
                        images.push(image);
                    }

                });

            } catch (error) {

                console.warn(
                    "Invalid QR selector:",
                    selector
                );

            }

        });


        return images;

    }


    function updateThumbQR() {

        const images = getQRImages();

        if (!images.length) {
            return;
        }


        const url = safeString(thumbState.url).trim();


        if (!url) {

            images.forEach(function (image) {

                image.removeAttribute("src");

                image.alt = "QR destination not configured";

            });

            return;
        }


        const qrUrl =
            CONFIG.qrBaseUrl +
            encodeURIComponent(url);


        images.forEach(function (image) {

            if (image.src !== qrUrl) {

                image.src = qrUrl;

            }

            image.alt = "Scan to start";

        });

    }


    /* ================= FORMAT CONTROL ================= */

    function setFormat(format) {

        const normalized = String(format || "").toLowerCase();


        if (
            normalized === "portrait" ||
            normalized === "9:16"
        ) {

            currentFormat = "portrait";

        } else if (
            normalized === "landscape" ||
            normalized === "16:9"
        ) {

            currentFormat = "landscape";

        } else {

            throw new Error(
                "Unsupported thumbnail format. Use portrait or landscape."
            );

        }


        const banner = getElement("banner");


        if (!banner) {

            console.warn(
                "Thumbnail preview #banner was not found."
            );

            return false;

        }


        banner.classList.remove(
            "portrait",
            "landscape"
        );


        banner.classList.add(currentFormat);


        const portraitButton = getElement("portraitBtn");

        const landscapeButton = getElement("landscapeBtn");


        if (portraitButton) {

            portraitButton.classList.toggle(
                "active",
                currentFormat === "portrait"
            );

            portraitButton.setAttribute(
                "aria-pressed",
                String(currentFormat === "portrait")
            );

        }


        if (landscapeButton) {

            landscapeButton.classList.toggle(
                "active",
                currentFormat === "landscape"
            );

            landscapeButton.setAttribute(
                "aria-pressed",
                String(currentFormat === "landscape")
            );

        }


        return true;

    }


    /* ================= INPUT EVENT HANDLING ================= */

    function bindInputs() {

        Object.keys(INPUT_MAP).forEach(function (key) {

            const field = getElement(INPUT_MAP[key]);

            if (!field) {
                return;
            }


            if (field.dataset.thumbListener === "attached") {
                return;
            }


            field.dataset.thumbListener = "attached";


            field.addEventListener("input", function () {

                thumbState[key] = safeString(field.value);

                safeStorageWrite(thumbState);

                renderThumb();

            });


            field.addEventListener("change", function () {

                thumbState[key] = safeString(field.value);

                safeStorageWrite(thumbState);

                renderThumb();

            });

        });

    }


    /* ================= RESET DEFAULTS ================= */

    function resetDefaults() {

        thumbState = cloneObject(DEFAULT_DATA);


        populateInputs();

        safeStorageWrite(thumbState);


        currentFormat = "landscape";

        setFormat("landscape");


        renderThumb();

        return true;

    }


    /* ================= IMAGE WAITING ================= */

    async function waitForImages(container) {

        const images = Array.from(
            container.querySelectorAll("img")
        );


        await Promise.all(

            images.map(function (image) {

                if (image.complete && image.naturalWidth > 0) {
                    return Promise.resolve();
                }


                return new Promise(function (resolve) {

                    const finish = function () {
                        resolve();
                    };


                    image.addEventListener(
                        "load",
                        finish,
                        { once: true }
                    );


                    image.addEventListener(
                        "error",
                        finish,
                        { once: true }
                    );


                    window.setTimeout(
                        finish,
                        15000
                    );

                });

            })

        );

    }


    /* ================= DOWNLOAD FILE NAME ================= */

    function createFileName() {

        const id = safeString(
            thumbState.mtId || "Test"
        );


        const safeId = id
            .trim()
            .replace(/[^a-zA-Z0-9_-]+/g, "_");


        const ratio = currentFormat === "portrait"
            ? "9x16"
            : "16x9";


        return "PrepareKora_" + safeId + "_" + ratio + ".png";

    }


    /* ================= EXPORT CANVAS ================= */

    async function captureBanner() {

        if (typeof window.html2canvas !== "function") {

            throw new Error(
                "html2canvas is unavailable. Check the library script in index.html."
            );

        }


        const banner = getElement("banner");

        if (!banner) {

            throw new Error(
                "Thumbnail preview #banner was not found."
            );

        }


        const rectangle = banner.getBoundingClientRect();


        if (
            rectangle.width <= 0 ||
            rectangle.height <= 0
        ) {

            throw new Error(
                "Thumbnail preview is not visible or has no dimensions."
            );

        }


        const targetWidth =
            currentFormat === "portrait"
                ? CONFIG.portraitWidth
                : CONFIG.landscapeWidth;


        const targetHeight =
            currentFormat === "portrait"
                ? CONFIG.portraitHeight
                : CONFIG.landscapeHeight;


        /*
         * Clone inside the original thumbnail workspace so
         * the existing banner CSS remains available.
         */

        const workspace = getElement("tool-thumb") || document.body;

        const holder = document.createElement("div");


        holder.style.position = "fixed";

        holder.style.left = "-100000px";

        holder.style.top = "0";

        holder.style.width = rectangle.width + "px";

        holder.style.height = rectangle.height + "px";

        holder.style.overflow = "hidden";

        holder.style.pointerEvents = "none";

        holder.style.zIndex = "-9999";


        const clone = banner.cloneNode(true);

        clone.style.width = rectangle.width + "px";

        clone.style.height = rectangle.height + "px";

        clone.style.margin = "0";

        clone.style.maxWidth = "none";

        clone.style.maxHeight = "none";


        holder.appendChild(clone);

        workspace.appendChild(holder);


        try {

            await waitForImages(clone);


            if (document.fonts && document.fonts.ready) {
                await document.fonts.ready;
            }


            const renderedCanvas = await window.html2canvas(
                clone,
                {

                    scale: Math.max(
                        CONFIG.captureScale,
                        targetWidth / rectangle.width
                    ),

                    useCORS: true,

                    allowTaint: false,

                    backgroundColor: null,

                    logging: false,

                    imageTimeout: 15000

                }
            );


            /*
             * Create an exact-resolution final canvas.
             */

            const finalCanvas = document.createElement("canvas");

            finalCanvas.width = targetWidth;

            finalCanvas.height = targetHeight;


            const context = finalCanvas.getContext("2d");


            if (!context) {

                throw new Error(
                    "Unable to create the PNG export canvas."
                );

            }


            context.drawImage(
                renderedCanvas,
                0,
                0,
                targetWidth,
                targetHeight
            );


            renderedCanvas.width = 0;

            renderedCanvas.height = 0;


            return finalCanvas;

        } finally {

            holder.remove();

        }

    }


    /* ================= DOWNLOAD PNG ================= */

    async function downloadBanner() {

        if (isDownloading) {
            return false;
        }


        isDownloading = true;


        const downloadButton = findActionButton("download");

        if (downloadButton) {
            downloadButton.disabled = true;
        }


        try {

            readInputs();

            safeStorageWrite(thumbState);

            renderThumb();


            const canvas = await captureBanner();


            const blob = await new Promise(function (resolve, reject) {

                canvas.toBlob(function (result) {

                    if (!result) {

                        reject(
                            new Error("PNG image export failed.")
                        );

                        return;
                    }

                    resolve(result);

                }, "image/png");

            });


            const objectUrl = URL.createObjectURL(blob);

            const link = document.createElement("a");


            link.href = objectUrl;

            link.download = createFileName();

            link.style.display = "none";


            document.body.appendChild(link);

            link.click();

            link.remove();


            window.setTimeout(function () {

                URL.revokeObjectURL(objectUrl);

            }, 2000);


            canvas.width = 0;

            canvas.height = 0;


            return true;

        } catch (error) {

            console.error(
                "Thumbnail download error:",
                error
            );

            throw error;

        } finally {

            isDownloading = false;

            if (downloadButton) {
                downloadButton.disabled = false;
            }

        }

    }


    /* ================= BUTTON HELPERS ================= */

    function findActionButton(action) {

        const selectors = {

            download: [
                '[data-thumb-action="download"]',
                '#downloadBannerBtn',
                '#downloadBtn',
                '#downloadPNG'
            ],

            reset: [
                '[data-thumb-action="reset"]',
                '#resetBannerBtn',
                '#resetBtn'
            ]

        };


        const candidates = selectors[action] || [];


        for (let i = 0; i < candidates.length; i++) {

            const button = document.querySelector(
                candidates[i]
            );


            if (button) {
                return button;
            }

        }


        return null;

    }


    /* ================= BUTTON EVENT HANDLERS ================= */

    function bindButtons() {

        const portraitButton = getElement("portraitBtn");

        const landscapeButton = getElement("landscapeBtn");


        if (
            portraitButton &&
            portraitButton.dataset.thumbListener !== "attached"
        ) {

            portraitButton.dataset.thumbListener = "attached";

            if (!portraitButton.hasAttribute("onclick")) {

                portraitButton.addEventListener("click", function () {
                    setFormat("portrait");
                });

            }

        }


        if (
            landscapeButton &&
            landscapeButton.dataset.thumbListener !== "attached"
        ) {

            landscapeButton.dataset.thumbListener = "attached";

            if (!landscapeButton.hasAttribute("onclick")) {

                landscapeButton.addEventListener("click", function () {
                    setFormat("landscape");
                });

            }

        }


        const downloadButton = findActionButton("download");


        if (
            downloadButton &&
            downloadButton.dataset.thumbListener !== "attached"
        ) {

            downloadButton.dataset.thumbListener = "attached";

            if (!downloadButton.hasAttribute("onclick")) {

                downloadButton.addEventListener("click", function () {

                    downloadBanner().catch(function (error) {

                        window.alert(error.message);

                    });

                });

            }

        }


        const resetButton = findActionButton("reset");


        if (
            resetButton &&
            resetButton.dataset.thumbListener !== "attached"
        ) {

            resetButton.dataset.thumbListener = "attached";

            if (!resetButton.hasAttribute("onclick")) {

                resetButton.addEventListener("click", function () {
                    resetDefaults();
                });

            }

        }

    }


    /* ================= REFRESH ================= */

    function refresh() {

        populateInputs();

        bindInputs();

        bindButtons();

        renderThumb();

        return true;

    }


    /* ================= INITIALIZE ================= */

    function init() {

        const workspace = getElement("tool-thumb");

        if (!workspace) {
            return false;
        }


        refresh();


        const banner = getElement("banner");

        if (banner) {

            if (!banner.classList.contains("portrait")) {
                setFormat("landscape");
            } else {
                setFormat("portrait");
            }

        }


        return true;

    }


    /* ================= PUBLIC API ================= */

    window.ThumbTool = {

        refresh: refresh,

        render: renderThumb,

        setFormat: setFormat,

        download: downloadBanner,

        reset: resetDefaults,

        getState: function () {
            return cloneObject(thumbState);
        },

        setState: function (newState) {

            if (
                !newState ||
                typeof newState !== "object" ||
                Array.isArray(newState)
            ) {
                throw new Error("Invalid thumbnail state.");
            }


            thumbState = Object.assign(
                {},
                thumbState,
                newState
            );


            populateInputs();

            safeStorageWrite(thumbState);

            renderThumb();

            return true;

        },

        version: "1.0.0"

    };


    /*
     * Preserve compatibility with original inline HTML handlers.
     */

    window.setFormat = setFormat;

    window.downloadBanner = function () {

        downloadBanner().catch(function (error) {

            console.error(error);

            window.alert(error.message);

        });

    };

    window.resetDefaults = resetDefaults;


    /* ================= STARTUP ================= */

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
