
(() => {
    "use strict";

    const STORAGE_KEY = "tower_bg_designer_draft_v1";

    const DEFAULT_DESIGN = {
        accentColor: "#934cff",
        backgroundColor: "#080811",
        textColor: "#ffffff",
        fontFamily: "Arial",
        headingSize: 40,
        bodySize: 16,
        sectionOrder: [
            "home",
            "about",
            "updates",
            "leaderboard",
            "support",
            "community"
        ]
    };

    const elements = {
        iframe: document.getElementById("websitePreview"),
        accent: document.getElementById("accentColor"),
        background: document.getElementById("backgroundColor"),
        text: document.getElementById("textColor"),
        font: document.getElementById("fontFamily"),
        headingSize: document.getElementById("headingSize"),
        bodySize: document.getElementById("bodySize"),
        headingOutput: document.getElementById("headingSizeValue"),
        bodyOutput: document.getElementById("bodySizeValue"),
        order: document.getElementById("sectionOrder"),
        status: document.getElementById("editorStatus"),
        previewButton: document.getElementById("previewButton"),
        publishButton: document.getElementById("publishButton"),
        resetButton: document.getElementById("resetButton"),
        desktopButton: document.getElementById("desktopView"),
        mobileButton: document.getElementById("mobileView"),
        aiToggle: document.getElementById("aiToggle"),
        aiPanel: document.getElementById("aiPanel"),
        aiClose: document.getElementById("closeAI"),
        aiForm: document.getElementById("aiForm"),
        aiInput: document.getElementById("aiInput"),
        aiMessages: document.getElementById("aiMessages")
    };

    let design = loadDraft();
    let draggedItem = null;

    function setStatus(message) {
        elements.status.textContent = message;
    }

    function loadDraft() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);

            if (!saved) {
                return { ...DEFAULT_DESIGN };
            }

            const parsed = JSON.parse(saved);

            return {
                ...DEFAULT_DESIGN,
                ...parsed,
                sectionOrder: Array.isArray(parsed.sectionOrder)
                    ? parsed.sectionOrder
                    : [...DEFAULT_DESIGN.sectionOrder]
            };

        } catch (error) {
            console.error("Draft loading error:", error);
            return { ...DEFAULT_DESIGN };
        }
    }

    function saveDraft() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(design)
            );

            setStatus("Черновата е запазена в този браузър.");

        } catch (error) {
            console.error("Draft saving error:", error);
            setStatus("Не успяхме да запазим черновата.");
        }
    }

    function getPreviewDocument() {
        try {
            return elements.iframe.contentDocument;
        } catch (error) {
            console.error("Preview access error:", error);
            setStatus("Отвори редактора през локалния сървър.");
            return null;
        }
    }

    function applyDesign() {
        const doc = getPreviewDocument();

        if (!doc || !doc.head || !doc.body) {
            setStatus("Изчакване на прегледа...");
            return;
        }

        let style = doc.getElementById("towerDesignerStyles");

        if (!style) {
            style = doc.createElement("style");
            style.id = "towerDesignerStyles";
            doc.head.appendChild(style);
        }

        const font = JSON.stringify(design.fontFamily);

        style.textContent = `
            :root {
                --designer-accent: ${design.accentColor};
                --designer-background: ${design.backgroundColor};
                --designer-text: ${design.textColor};
                --designer-font: ${font};
                --designer-heading-size: ${design.headingSize}px;
                --designer-body-size: ${design.bodySize}px;
            }

            body {
                background-color: var(--designer-background) !important;
                color: var(--designer-text) !important;
                font-family: var(--designer-font) !important;
                font-size: var(--designer-body-size) !important;
            }

            h1, h2, h3 {
                font-family: var(--designer-font) !important;
            }

            .hero h1,
            .section-heading h2,
            .about h2,
            .updates h2,
            .leaderboard h2,
            .support h2,
            .community h2 {
                font-size: var(--designer-heading-size) !important;
            }

            .hero h2,
            .logo span,
            h1 span,
            h2 span,
            .tag {
                color: var(--designer-accent) !important;
            }

            .navbar {
                background-color: var(--designer-background) !important;
            }

            .feature,
            .about-card,
            .news-card,
            .update-preview-card,
            .leaderboard-container,
            .support form {
                border-color: var(--designer-accent) !important;
            }

            .btn.primary,
            .view-more-btn {
                background-color: var(--designer-accent) !important;
            }

            .nav-links a:hover,
            .view-more-btn:hover {
                color: var(--designer-accent) !important;
            }
        `;

        applySectionOrder();

        setStatus("Прегледът е обновен.");
    }

    function applySectionOrder() {
        const doc = getPreviewDocument();

        if (!doc) return;

        const parent = doc.body;

        const sections = design.sectionOrder
            .map(id => doc.getElementById(id))
            .filter(Boolean);

        if (!sections.length) return;

        const fragment = doc.createDocumentFragment();

        sections.forEach(section => {
            fragment.appendChild(section);
        });

        const footer = parent.querySelector("footer");

        if (footer) {
            parent.insertBefore(fragment, footer);
        } else {
            parent.appendChild(fragment);
        }
    }

    function updateInputs() {
        elements.accent.value = design.accentColor;
        elements.background.value = design.backgroundColor;
        elements.text.value = design.textColor;
        elements.font.value = design.fontFamily;

        elements.headingSize.value = design.headingSize;
        elements.bodySize.value = design.bodySize;

        elements.headingOutput.textContent =
            design.headingSize + " px";

        elements.bodyOutput.textContent =
            design.bodySize + " px";

        renderSectionOrder();
    }

    function renderSectionOrder() {
        const names = {
            home: "🏠 Начало",
            about: "🎮 За играта",
            updates: "🚀 Новини",
            leaderboard: "🏆 Time Board",
            support: "💬 Support",
            community: "🌐 Общност"
        };

        elements.order.replaceChildren();

        design.sectionOrder.forEach(id => {
            if (!names[id]) return;

            const item = document.createElement("li");

            item.dataset.section = id;
            item.draggable = true;
            item.textContent = "☰ " + names[id];

            elements.order.appendChild(item);
        });

        setupDragging();
    }

    function setupDragging() {
        const items = elements.order.querySelectorAll("li");

        items.forEach(item => {

            item.addEventListener("dragstart", function() {
                draggedItem = this;
                this.classList.add("dragging");
            });

            item.addEventListener("dragend", function() {
                this.classList.remove("dragging");
                draggedItem = null;

                design.sectionOrder = [
                    ...elements.order.querySelectorAll("li")
                ].map(item => item.dataset.section);

                saveDraft();
                applySectionOrder();
            });

            item.addEventListener("dragover", function(event) {
                event.preventDefault();

                if (!draggedItem || draggedItem === this) {
                    return;
                }

                const rect = this.getBoundingClientRect();
                const middle = rect.top + rect.height / 2;

                if (event.clientY < middle) {
                    this.parentNode.insertBefore(
                        draggedItem,
                        this
                    );
                } else {
                    this.parentNode.insertBefore(
                        draggedItem,
                        this.nextSibling
                    );
                }
            });

        });
    }

    function changeDesign(property, value) {
        design[property] = value;

        saveDraft();
        applyDesign();
    }

    // COLOR CONTROLS

    elements.accent.addEventListener("input", event => {
        changeDesign("accentColor", event.target.value);
    });

    elements.background.addEventListener("input", event => {
        changeDesign("backgroundColor", event.target.value);
    });

    elements.text.addEventListener("input", event => {
        changeDesign("textColor", event.target.value);
    });

    // FONT CONTROLS

    elements.font.addEventListener("change", event => {
        changeDesign("fontFamily", event.target.value);
    });

    elements.headingSize.addEventListener("input", event => {
        const value = Number(event.target.value);

        design.headingSize = value;
        elements.headingOutput.textContent = value + " px";

        saveDraft();
        applyDesign();
    });

    elements.bodySize.addEventListener("input", event => {
        const value = Number(event.target.value);

        design.bodySize = value;
        elements.bodyOutput.textContent = value + " px";

        saveDraft();
        applyDesign();
    });

    // PREVIEW

    elements.previewButton.addEventListener("click", function() {
        applyDesign();
        setStatus("Прегледът показва текущите промени.");
    });

    elements.iframe.addEventListener("load", function() {
        applyDesign();
    });

    // DESKTOP VIEW

    elements.desktopButton.addEventListener("click", function() {
        elements.iframe.classList.remove("mobile-preview");

        elements.desktopButton.classList.add("active");
        elements.mobileButton.classList.remove("active");

        setStatus("Преглед: Desktop.");
    });

    // MOBILE VIEW

    elements.mobileButton.addEventListener("click", function() {
        elements.iframe.classList.add("mobile-preview");

        elements.mobileButton.classList.add("active");
        elements.desktopButton.classList.remove("active");

        setStatus("Преглед: Mobile.");
    });

    // RESET DESIGN

    elements.resetButton.addEventListener("click", function() {
        const confirmed = confirm(
            "Искаш ли да възстановиш оригиналния дизайн?"
        );

        if (!confirmed) return;

        design = {
            ...DEFAULT_DESIGN,
            sectionOrder: [...DEFAULT_DESIGN.sectionOrder]
        };

        localStorage.removeItem(STORAGE_KEY);

        updateInputs();
        applyDesign();

        setStatus("Оригиналният дизайн е възстановен.");
    });

    // AI PANEL OPEN AND CLOSE

    elements.aiToggle.addEventListener("click", function() {
        elements.aiPanel.hidden = !elements.aiPanel.hidden;

        if (!elements.aiPanel.hidden) {
            elements.aiInput.focus();
        }
    });

    elements.aiClose.addEventListener("click", function() {
        elements.aiPanel.hidden = true;
    });

    // AI CHAT PLACEHOLDER

    function addAIMessage(message, type) {
        const bubble = document.createElement("div");

        bubble.className = "ai-message";

        if (type === "user") {
            bubble.classList.add("user-message");
        }

        bubble.textContent = message;

        elements.aiMessages.appendChild(bubble);
        elements.aiMessages.scrollTop =
            elements.aiMessages.scrollHeight;
    }

    elements.aiForm.addEventListener("submit", function(event) {
        event.preventDefault();

        const message = elements.aiInput.value.trim();

        if (!message) return;

        addAIMessage(message, "user");

        elements.aiInput.value = "";

        addAIMessage(
            "Благодаря! Визуалният редактор вече работи. " +
            "Истинският AI все още не е свързан със сървъра. " +
            "Ще го активираме в следващата стъпка.",
            "assistant"
        );
    });

    // PUBLISH IS NOT CONNECTED YET

    elements.publishButton.disabled = true;
    elements.publishButton.title =
        "Публикуването ще се активира след свързване със сървъра.";

    // INITIALIZE

    updateInputs();

    if (elements.iframe.contentDocument &&
        elements.iframe.contentDocument.readyState === "complete") {
        applyDesign();
    }

    setStatus(
        "Редакторът е готов. Промените засега са локална чернова."
    );

})();
