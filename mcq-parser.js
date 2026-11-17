
/* =====================================================
   PREPAREKORA STUDIO
   MCQ Parser and Validator
   File: mcq-parser.js

   Responsibilities:
   1. Read English and Assamese sections.
   2. Parse questions, options and answers.
   3. Pair matching question numbers.
   4. Validate the complete MCQ structure.
   5. Return structured test data.

   Does not generate PDFs or thumbnails.
===================================================== */

(function (window) {
    "use strict";


    /* ================= CONSTANTS ================= */

    const SECTION_ENGLISH = "@@ENGLISH";
    const SECTION_ASSAMESE = "@@ASSAMESE";

    const OPTION_LABELS = ["A", "B", "C", "D"];

    const MARKER_PATTERN = /^@@(ENGLISH|ASSAMESE)$/i;

    const QUESTION_PATTERN = /^Q\s*(\d+)\s*[.)]\s*(.*)$/i;

    const OPTION_PATTERN = /^([A-D])\s*[.)]\s*(.*)$/i;

    const ANSWER_PATTERN = /^Ans\s*:\s*([A-D])\s*$/i;


    /* ================= HELPERS ================= */

    function normalizeLine(line) {
        return String(line || "").trim();
    }


    function addError(errors, message, lineNumber) {

        errors.push({
            message: message,
            line: lineNumber || null
        });

    }


    function formatError(error) {

        if (error.line) {
            return "Line " + error.line + ": " + error.message;
        }

        return error.message;

    }


    /* =================================================
       PARSE ONE LANGUAGE SECTION
    ================================================= */

    function parseSection(section) {

        const errors = [];

        const lines = section.lines;

        let questionNumber = null;
        let questionText = "";

        const options = {};

        let answer = null;

        let currentTarget = null;

        let questionFound = false;
        let answerFound = false;


        for (let i = 0; i < lines.length; i++) {

            const currentLine = lines[i];

            const line = normalizeLine(currentLine.text);

            const lineNumber = currentLine.number;


            /* Ignore empty lines */

            if (!line) {
                continue;
            }


            /* ================= QUESTION ================= */

            const questionMatch = line.match(QUESTION_PATTERN);

            if (questionMatch) {

                if (questionFound) {

                    addError(
                        errors,
                        "A section must contain exactly one question.",
                        lineNumber
                    );

                    continue;
                }

                questionFound = true;

                questionNumber = Number(questionMatch[1]);

                questionText = questionMatch[2].trim();

                currentTarget = "question";

                if (!questionText) {

                    addError(
                        errors,
                        "Question text is missing.",
                        lineNumber
                    );

                }

                continue;
            }


            /* Detect malformed question lines */

            if (!questionFound && /^Q\s*\d+/i.test(line)) {

                addError(
                    errors,
                    "Invalid question format. Use Q1. Question text?",
                    lineNumber
                );

                continue;
            }


            /* ================= OPTIONS ================= */

            const optionMatch = line.match(OPTION_PATTERN);

            if (optionMatch) {

                if (!questionFound) {

                    addError(
                        errors,
                        "Question must appear before its options.",
                        lineNumber
                    );

                    continue;
                }

                if (answerFound) {

                    addError(
                        errors,
                        "Options cannot appear after the answer.",
                        lineNumber
                    );

                    continue;
                }

                const label = optionMatch[1].toUpperCase();

                const optionText = optionMatch[2].trim();


                if (Object.prototype.hasOwnProperty.call(options, label)) {

                    addError(
                        errors,
                        "Duplicate option " + label + ".",
                        lineNumber
                    );

                    continue;
                }


                options[label] = {
                    label: label,
                    text: optionText,
                    line: lineNumber
                };

                currentTarget = label;


                if (!optionText) {

                    addError(
                        errors,
                        "Option " + label + " has no text.",
                        lineNumber
                    );

                }

                continue;
            }


            /* ================= ANSWER ================= */

            if (/^Ans\s*:/i.test(line)) {

                if (answerFound) {

                    addError(
                        errors,
                        "Duplicate answer declaration.",
                        lineNumber
                    );

                    continue;
                }

                const answerMatch = line.match(ANSWER_PATTERN);

                if (!answerMatch) {

                    addError(
                        errors,
                        "Invalid answer. Use Ans: A, Ans: B, Ans: C or Ans: D.",
                        lineNumber
                    );

                    answerFound = true;
                    continue;
                }


                answer = answerMatch[1].toUpperCase();

                answerFound = true;

                currentTarget = "answer";

                continue;
            }


            /* ================= CONTINUATION TEXT ================= */

            if (answerFound) {

                addError(
                    errors,
                    "Unexpected text after the answer declaration.",
                    lineNumber
                );

                continue;
            }


            if (!questionFound) {

                addError(
                    errors,
                    "Unexpected text before the question.",
                    lineNumber
                );

                continue;
            }


            if (currentTarget === "question") {

                questionText += (questionText ? " " : "") + line;

                continue;
            }


            if (currentTarget && OPTION_LABELS.includes(currentTarget)) {

                options[currentTarget].text +=
                    (options[currentTarget].text ? " " : "") + line;

                continue;
            }


            addError(
                errors,
                "Unexpected text in this question section.",
                lineNumber
            );

        }


        /* ================= REQUIRED FIELDS ================= */

        if (!questionFound) {

            addError(
                errors,
                "Question is missing."
            );

        }


        if (questionNumber !== null && questionNumber <= 0) {

            addError(
                errors,
                "Question number must be greater than zero."
            );

        }


        if (questionFound && !questionText.trim()) {

            addError(
                errors,
                "Question text cannot be empty."
            );

        }


        if (questionFound) {

            OPTION_LABELS.forEach(function (label) {

                if (!Object.prototype.hasOwnProperty.call(options, label)) {

                    addError(
                        errors,
                        "Missing option " + label + "."
                    );

                }

            });

        }


        /* Enforce A, B, C, D order */

        const providedLabels = Object.keys(options);

        const expectedLabels = providedLabels
            .slice()
            .sort(function (a, b) {
                return OPTION_LABELS.indexOf(a) -
                    OPTION_LABELS.indexOf(b);
            });


        if (providedLabels.some(function (label, index) {
            return label !== expectedLabels[index];
        })) {

            addError(
                errors,
                "Options must appear in A, B, C, D order."
            );

        }


        if (!answerFound) {

            addError(
                errors,
                "Answer declaration is missing."
            );

        }


        if (answerFound && answer && !options[answer]) {

            addError(
                errors,
                "The answer refers to a missing option " + answer + "."
            );

        }


        /* Empty option text validation */

        OPTION_LABELS.forEach(function (label) {

            if (
                options[label] &&
                !options[label].text.trim()
            ) {

                addError(
                    errors,
                    "Option " + label + " cannot be empty.",
                    options[label].line
                );

            }

        });


        /* ================= RESULT ================= */

        if (errors.length > 0) {

            return {
                valid: false,
                errors: errors,
                data: null
            };

        }


        const finalOptions = OPTION_LABELS.map(function (label) {

            return {
                label: label,
                text: options[label].text.trim()
            };

        });


        return {
            valid: true,
            errors: [],

            data: {
                number: questionNumber,
                question: questionText.trim(),
                options: finalOptions,
                answer: answer
            }
        };

    }


    /* =================================================
       MAIN PARSER
    ================================================= */

    function parse(input) {

        const errors = [];

        const questionsMap = new Map();

        const questionOrder = [];

        let sections = [];

        let currentSection = null;

        let currentLanguage = null;


        /* ================= INPUT CHECK ================= */

        if (typeof input !== "string" || !input.trim()) {

            return {
                valid: false,
                errors: [
                    {
                        message: "Please enter your MCQ questions."
                    }
                ],
                questions: [],
                totalQuestions: 0
            };

        }


        const inputLines = input
            .replace(/^\uFEFF/, "")
            .replace(/\r\n?/g, "\n")
            .split("\n");


        /* ================= SECTION EXTRACTION ================= */

        inputLines.forEach(function (rawLine, index) {

            const line = normalizeLine(rawLine);

            const lineNumber = index + 1;


            /* Ignore blank lines outside sections */

            if (!line && !currentSection) {
                return;
            }


            const markerMatch = line.match(MARKER_PATTERN);


            if (markerMatch) {

                const language = markerMatch[1].toUpperCase();


                if (currentSection) {

                    sections.push(currentSection);

                }


                /* Enforce English -> Assamese order */

                const expectedLanguage =
                    currentLanguage === null
                        ? "ENGLISH"
                        : currentLanguage === "ENGLISH"
                            ? "ASSAMESE"
                            : "ENGLISH";


                if (language !== expectedLanguage) {

                    addError(
                        errors,
                        "Expected " + expectedLanguage +
                        " section but found " + language + ".",
                        lineNumber
                    );

                }


                currentLanguage = language;


                currentSection = {
                    language: language,
                    startLine: lineNumber,
                    lines: []
                };


                return;
            }


            /* Detect unknown section markers */

            if (line.startsWith("@@")) {

                addError(
                    errors,
                    "Unknown section marker. Use @@ENGLISH or @@ASSAMESE.",
                    lineNumber
                );

                return;
            }


            /* Reject content before the first marker */

            if (!currentSection) {

                if (line) {

                    addError(
                        errors,
                        "Content found before @@ENGLISH.",
                        lineNumber
                    );

                }

                return;
            }


            currentSection.lines.push({
                text: rawLine,
                number: lineNumber
            });

        });


        if (currentSection) {
            sections.push(currentSection);
        }


        if (sections.length === 0) {

            addError(
                errors,
                "No valid language sections found. Use @@ENGLISH and @@ASSAMESE."
            );

        }


        /* ================= SECTION PAIRING ================= */

        const languageSections = new Map();

        const englishOrder = [];


        sections.forEach(function (section) {

            const parsed = parseSection(section);

            parsed.errors.forEach(function (error) {

                addError(
                    errors,
                    section.language + ": " + error.message,
                    error.line || section.startLine
                );

            });


            if (!parsed.data) {
                return;
            }


            const questionNumber = parsed.data.number;


            if (!languageSections.has(questionNumber)) {

                languageSections.set(questionNumber, {
                    english: null,
                    assamese: null
                });

            }


            const pair = languageSections.get(questionNumber);


            if (pair[section.language.toLowerCase()]) {

                addError(
                    errors,
                    "Duplicate " + section.language +
                    " section for Q" + questionNumber + ".",
                    section.startLine
                );

                return;
            }


            pair[section.language.toLowerCase()] = parsed.data;


            if (section.language === "ENGLISH") {

                englishOrder.push(questionNumber);

            }

        });


        /* ================= FINAL QUESTION PAIRING ================= */

        const questions = [];

        const processedNumbers = new Set();


        englishOrder.forEach(function (number) {

            if (processedNumbers.has(number)) {
                return;
            }

            processedNumbers.add(number);


            const pair = languageSections.get(number);


            if (!pair) {
                return;
            }


            if (!pair.english) {

                addError(
                    errors,
                    "English section is missing for Q" + number + "."
                );

                return;
            }


            if (!pair.assamese) {

                addError(
                    errors,
                    "Assamese section is missing for Q" + number + "."
                );

                return;
            }


            /* Answers must agree */

            if (pair.english.answer !== pair.assamese.answer) {

                addError(
                    errors,
                    "Answer mismatch in Q" + number +
                    ". English answer is " + pair.english.answer +
                    " but Assamese answer is " + pair.assamese.answer + "."
                );

            }


            questions.push({

                number: number,

                english: {
                    question: pair.english.question,

                    options: pair.english.options.map(function (option) {
                        return {
                            label: option.label,
                            text: option.text
                        };
                    }),

                    answer: pair.english.answer
                },


                assamese: {
                    question: pair.assamese.question,

                    options: pair.assamese.options.map(function (option) {
                        return {
                            label: option.label,
                            text: option.text
                        };
                    }),

                    answer: pair.assamese.answer
                }

            });

        });


        /* ================= MISSING ENGLISH SECTION ================= */

        languageSections.forEach(function (pair, number) {

            if (!pair.english && pair.assamese) {

                addError(
                    errors,
                    "English section is missing for Q" + number + "."
                );

            }

        });


        /* ================= EMPTY TEST CHECK ================= */

        if (questions.length === 0) {

            addError(
                errors,
                "No complete bilingual question pairs were found."
            );

        }


        /* ================= FINAL RESULT ================= */

        return {

            valid: errors.length === 0,

            errors: errors,

            formattedErrors: errors.map(formatError),

            questions: errors.length === 0 ? questions : [],

            totalQuestions: errors.length === 0 ? questions.length : 0

        };

    }


    /* =================================================
       PUBLIC API
    ================================================= */

    window.MCQParser = {

        parse: parse,

        version: "1.0.0"

    };


})(window);
