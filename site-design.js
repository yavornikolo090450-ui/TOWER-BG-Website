
(() => {
    "use strict";

    const DEFAULTS = {
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

    const ALLOWED_FONTS = [
        "Arial",
        "Verdana",
        "Tahoma",
        "Georgia",
        "Trebuchet MS"
    ];

    function validateDesign(data) {
        if (!data || typeof data !== "object") {
            return null;
        }

        const validColor = value =>
            typeof value === "string" &&
            /^#[0-9a-fA-F]{6}$/.test(value);

        if (
            !validColor(data.accentColor) ||
            !validColor(data.backgroundColor) ||
            !validColor(data.textColor) ||
            !ALLOWED_FONTS.includes(data.fontFamily)
        ) {
            return null;
        }

        if (
            !Number.isInteger(data.headingSize) ||
            data.headingSize < 20 ||
            data.headingSize > 100
        ) {
            return null;
        }

        if (
            !Number.isInteger(data.bodySize) ||
            data.bodySize < 12 ||
            data.bodySize > 25
        ) {
            return null;
        }

        if (!Array.isArray(data.sectionOrder)) {
            return null;
        }

        const allowed = DEFAULTS.sectionOrder;

        if (
            data.sectionOrder.length !== allowed.length ||
            new Set(data.sectionOrder).size !== allowed.length ||
            data.sectionOrder.some(id => !allowed.includes(id))
        ) {
            return null;
        }

        return {
            ...DEFAULTS,
            ...data
        };
    }

    function applyTheme(design) {
        let style = document.getElementById("publishedSiteDesign");

        if (!style) {
            style = document.createElement("style");
            style.id = "publishedSiteDesign";
            document.head.appendChild(style);
        }

        const font = JSON.stringify(design.fontFamily);

        style.textContent = `
            body {
                background-color: ${design.backgroundColor} !important;
                color: ${design.textColor} !important;
                font-family: ${font} !important;
                font-size: ${design.bodySize}px !important;
            }

            h1, h2, h3, p, a, button {
                font-family: ${font} !important;
            }

            .hero h1,
            .section h2,
            .about h2,
            .updates h2,
            .leaderboard h2,
            .support h2,
            .community h2 {
                font-size: ${design.headingSize}px !important;
            }

            .tag,
            .status,
            .logo span,
            h1 span,
            h2 span {
                color: ${design.accentColor} !important;
            }

            .btn.primary,
            .view-more-btn {
                background-color: ${design.accentColor} !important;
                border-color: ${design.accentColor} !important;
            }

            .feature,
            .news-card,
            .update-preview-card,
            .leaderboard-container {
                border-color: ${design.accentColor} !important;
            }
        `;
    }

    function applySectionOrder(order) {
        const sections = order
            .map(id => document.getElementById(id))
            .filter(Boolean);

        if (sections.length !== order.length || sections.length === 0) {
            return;
        }

        const parent = sections[0].parentElement;

        if (!sections.every(section => section.parentElement === parent)) {
            return;
        }

        const fragment = document.createDocumentFragment();

        sections.forEach(section => {
            fragment.appendChild(section);
        });

        const footer = document.querySelector("footer");

        if (footer && footer.parentElement === parent) {
            parent.insertBefore(fragment, footer);
        } else {
            parent.appendChild(fragment);
        }
    }

    async function loadPublishedDesign() {
        try {
            const response = await fetch("/api/design", {
                method: "GET",
                cache: "no-store",
                credentials: "same-origin"
            });

            if (!response.ok) {
                throw new Error("Неуспешно зареждане на дизайна.");
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Грешка в дизайна.");
            }

            if (!result.design) {
                return;
            }

            const design = validateDesign(result.design);

            if (!design) {
                console.error("Невалидни настройки на дизайна.");
                return;
            }

            applyTheme(design);
            applySectionOrder(design.sectionOrder);

        } catch (error) {
            console.error("Website design error:", error);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            loadPublishedDesign
        );
    } else {
        loadPublishedDesign();
    }

})();
