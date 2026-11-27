
const COOKIE_NAME = "tower_bg_admin";

const ALLOWED_SECTIONS = [
    "home",
    "about",
    "updates",
    "leaderboard",
    "support",
    "community"
];

const ALLOWED_FONTS = [
    "Arial",
    "Verdana",
    "Tahoma",
    "Georgia",
    "Trebuchet MS"
];

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
        }
    });
}

function safeEqual(a, b) {
    const encoder = new TextEncoder();
    const first = encoder.encode(String(a));
    const second = encoder.encode(String(b));

    let difference = first.length ^ second.length;
    const length = Math.max(first.length, second.length);

    for (let i = 0; i < length; i++) {
        difference |= (first[i] || 0) ^ (second[i] || 0);
    }

    return difference === 0;
}

async function makeSignature(value, secret) {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(value)
    );

    return btoa(
        String.fromCharCode(...new Uint8Array(signature))
    )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

async function verifyAdmin(request, secret) {
    try {
        const cookies = request.headers.get("Cookie") || "";

        const cookie = cookies
            .split(";")
            .map(value => value.trim())
            .find(value => value.startsWith(COOKIE_NAME + "="));

        if (!cookie) return false;

        const token = cookie.slice(COOKIE_NAME.length + 1);
        const parts = token.split(".");

        if (parts.length !== 2) return false;

        const [expires, suppliedSignature] = parts;

        if (!/^\d+$/.test(expires)) return false;
        if (Number(expires) < Date.now()) return false;

        const expectedSignature = await makeSignature(
            expires,
            secret
        );

        return safeEqual(suppliedSignature, expectedSignature);

    } catch {
        return false;
    }
}

async function ensureDesignTable(db) {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS site_design (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            design_json TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
}

function validateDesign(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("Невалидни настройки на дизайна.");
    }

    const isColor = value =>
        typeof value === "string" &&
        /^#[0-9a-fA-F]{6}$/.test(value);

    if (!isColor(input.accentColor)) {
        throw new Error("Невалиден основен цвят.");
    }

    if (!isColor(input.backgroundColor)) {
        throw new Error("Невалиден цвят на фона.");
    }

    if (!isColor(input.textColor)) {
        throw new Error("Невалиден цвят на текста.");
    }

    if (!ALLOWED_FONTS.includes(input.fontFamily)) {
        throw new Error("Невалиден шрифт.");
    }

    const headingSize = Number(input.headingSize);
    const bodySize = Number(input.bodySize);

    if (!Number.isInteger(headingSize) ||
        headingSize < 20 ||
        headingSize > 100) {
        throw new Error("Невалиден размер на заглавията.");
    }

    if (!Number.isInteger(bodySize) ||
        bodySize < 12 ||
        bodySize > 25) {
        throw new Error("Невалиден размер на текста.");
    }

    if (!Array.isArray(input.sectionOrder)) {
        throw new Error("Невалиден ред на секциите.");
    }

    const order = input.sectionOrder;

    if (
        order.length !== ALLOWED_SECTIONS.length ||
        new Set(order).size !== ALLOWED_SECTIONS.length ||
        order.some(id => !ALLOWED_SECTIONS.includes(id))
    ) {
        throw new Error("Списъкът със секции е невалиден.");
    }

    return {
        accentColor: input.accentColor,
        backgroundColor: input.backgroundColor,
        textColor: input.textColor,
        fontFamily: input.fontFamily,
        headingSize,
        bodySize,
        sectionOrder: order
    };
}


// PUBLIC: LOAD THE PUBLISHED DESIGN

export async function onRequestGet({ env }) {
    try {
        if (!env.DB) {
            return json({
                success: false,
                error: "D1 базата данни не е свързана."
            }, 503);
        }

        await ensureDesignTable(env.DB);

        const record = await env.DB.prepare(`
            SELECT design_json, updated_at
            FROM site_design
            WHERE id = 1
        `).first();

        if (!record) {
            return json({
                success: true,
                design: null,
                updatedAt: null
            });
        }

        let design;

        try {
            design = JSON.parse(record.design_json);
        } catch {
            return json({
                success: false,
                error: "Запазеният дизайн е повреден."
            }, 500);
        }

        return json({
            success: true,
            design,
            updatedAt: record.updated_at
        });

    } catch (error) {
        console.error("Design GET error:", error);

        return json({
            success: false,
            error: "Не успяхме да заредим дизайна."
        }, 500);
    }
}


// ADMIN ONLY: PUBLISH THE DESIGN

export async function onRequestPost({ request, env }) {
    try {
        const origin = request.headers.get("Origin");

        if (origin && origin !== new URL(request.url).origin) {
            return json({
                success: false,
                error: "Невалидна заявка."
            }, 403);
        }

        if (!env.ADMIN_SESSION_SECRET) {
            return json({
                success: false,
                error: "Липсва настройка за администраторска сесия."
            }, 500);
        }

        const authenticated = await verifyAdmin(
            request,
            env.ADMIN_SESSION_SECRET
        );

        if (!authenticated) {
            return json({
                success: false,
                error: "Трябва да влезеш като администратор."
            }, 401);
        }

        if (!env.DB) {
            return json({
                success: false,
                error: "D1 базата данни не е свързана."
            }, 503);
        }

        const contentLength = Number(
            request.headers.get("Content-Length") || 0
        );

        if (contentLength > 50_000) {
            return json({
                success: false,
                error: "Настройките са прекалено големи."
            }, 413);
        }

        const body = await request.json();

        if (body.action !== "publish") {
            return json({
                success: false,
                error: "Непозната команда."
            }, 400);
        }

        const design = validateDesign(body.design);

        await ensureDesignTable(env.DB);

        await env.DB.prepare(`
            INSERT INTO site_design (id, design_json, updated_at)
            VALUES (1, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                design_json = excluded.design_json,
                updated_at = CURRENT_TIMESTAMP
        `).bind(JSON.stringify(design)).run();

        return json({
            success: true,
            message: "Дизайнът на TOWER BG е публикуван!"
        });

    } catch (error) {
        console.error("Design POST error:", error);

        return json({
            success: false,
            error: error.message || "Грешка при публикуване на дизайна."
        }, 400);
    }
}
