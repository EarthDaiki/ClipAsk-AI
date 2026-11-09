/* background.js */
const injectedTabs = new Set();

chrome.runtime.onInstalled.addListener(async () => {
    const current = await getData();

    const defaults = {
        openaiApiKey: "",
        extraPrompt: "",
        textModel: "",
        imageModel: "",
        summaryModel: "",
        maxOutputTokens: 500,
        store: false,
        summary: true,
        summaryCount: 30,
        conversations: {},
    };

    await chrome.storage.local.set({
        openaiApiKey: current.openaiApiKey ?? defaults.openaiApiKey,
        extraPrompt: current.extraPrompt ?? defaults.extraPrompt,
        textModel: current.textModel ?? defaults.textModel,
        imageModel: current.imageModel ?? defaults.imageModel,
        summaryModel: current.summaryModel ?? defaults.summaryModel,
        maxOutputTokens: current.maxOutputTokens ?? defaults.maxOutputTokens,
        store: current.store ?? defaults.store,
        summary: current.summary ?? defaults.summary,
        summaryCount: current.summaryCount ?? defaults.summaryCount,
        conversations: current.conversations ?? defaults.conversations,
    });

    chrome.contextMenus.create({
        id: "ask-chatgpt-text",
        title: "Ask ChatGPT (selected text)",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "ask-chatgpt-image",
        title: "Ask ChatGPT (crop image area)",
        contexts: ["page", "selection"]
    });
});

chrome.tabs.onUpdated.addListener((tabId) => {
    injectedTabs.delete(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
    injectedTabs.delete(tabId);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;

    if (!tab.url || tab.url.startsWith("chrome://")) return;

    const { openaiApiKey, extraPrompt } = await getData([
        "openaiApiKey", "extraPrompt"
    ]);

    if (!openaiApiKey) {
        chrome.action.openPopup();
        return;
    }

    try {
        if (!injectedTabs.has(tab.id)) {
            await inject(tab.id);
            injectedTabs.add(tab.id);
        }

        // summarize the chat if the chat count is higher than threshold.
        const storageData = await getData();
        const domain = getDomain(tab.url);
        const count = storageData.conversations?.[domain]?.count ?? 0;
        if (
            storageData.store &&
            storageData.summary && 
            (count >= storageData.summaryCount)

        ) {
            // This is a box to display an ai output.
            await executeScript({ tabId: tab.id }, createTextBox, []);
            await executeScript({ tabId: tab.id }, loadingMessage, ["Summarizing..."]);
            await summarizeConversation(storageData, domain);
            await executeScript({ tabId: tab.id }, removeLoadingMessage, []);
        }

        /* ---------------- TEXT ---------------- */
        if (info.menuItemId === "ask-chatgpt-text") {
            // This is a box to display an ai output.
            await executeScript({ tabId: tab.id }, createTextBox, []);
            await executeScript({ tabId: tab.id }, loadingMessage, ["Loading..."]);

            const finalInput =
                extraPrompt
                    ? extraPrompt +
                    "\n\n" +
                    info.selectionText
                    : info.selectionText;

            const answer =
                await askChatGPT(
                    true,
                    openaiApiKey,
                    finalInput,
                    null,
                    false,
                    domain
                );

            if (answer != null) {
                await executeScript({ tabId: tab.id }, removeLoadingMessage, []);
                await executeScript({ tabId: tab.id }, showAnswer, [answer]);
            }
            return;
        }

        /* ---------------- IMAGE ---------------- */
        if (info.menuItemId === "ask-chatgpt-image") {

            const result = await executeScript({ tabId: tab.id }, startCropMode, []);

            const area = result?.[0]?.result;

            if (!area) return;

            /* 画面全体スクショ */
            const screenshot =
                await chrome.tabs.captureVisibleTab(
                    tab.windowId,
                    { format: "png" }
                );

            /* page側でcrop */
            const cropResult = await executeScript({ tabId: tab.id }, cropImageOnPage, [screenshot, area]);

            const croppedImage =
                cropResult?.[0]?.result;

            // This is a box to display an ai output.
            await executeScript({ tabId: tab.id }, createTextBox, []);
            await executeScript({ tabId: tab.id }, loadingMessage, ["Loading..."]);

            if (!croppedImage)
                throw new Error(
                    "Crop failed"
                );
            
            const finalInput =
                extraPrompt ||
                "Analyze this image.";

            const answer =
                await askChatGPT(
                    false,
                    openaiApiKey,
                    finalInput,
                    croppedImage,
                    false,
                    domain
                );

            if (answer != null) {
                await executeScript({ tabId: tab.id }, removeLoadingMessage, []);
                await executeScript({ tabId: tab.id }, showAnswer, [answer]);
            }
            return;
        }

    } catch (e) {
        await executeScript({ tabId: tab.id }, removeLoadingMessage, []);
        await executeScript({ tabId: tab.id }, showAnswer, ["Error: " + e.message]);
    }
});

async function executeScript(target, func, args) {
    return await chrome.scripting.executeScript({
        target: target,
        func: func,
        args: args
    });
}

function getDomain(currentUrl) {
    const hostname = new URL(currentUrl).hostname;

    return hostname.replace(/^www\./, "");
}

function getPreviousId(domain, conversations) {
    // console.log(`Previous ID: ${conversations?.[domain]?.id ?? null}`);
    return conversations?.[domain]?.id ?? null;
}

// If you want to post only text, you don't need an image.
function buildApiBody(isText, storageData, text, image=null, previousId=null, isSummary=false) {
    const body = {
        input: text,
        store: storageData.store,
        max_output_tokens: storageData.maxOutputTokens
    };
    if (isSummary) {
        if (!storageData.summaryModel) {
            throw new Error("Please select a summary model.");
        }
        body.model = storageData.summaryModel;
    } else if (isText) {
        if (!storageData.textModel) {
            throw new Error("Please select a text model.");
        }
        body.model = storageData.textModel;
    } else if(image) {
        if (!storageData.imageModel) {
            throw new Error("Please select an image model.");
        }

        body.model = storageData.imageModel
        body.input = [
            {
                role: "user",
                content: [
                    {
                        type: "input_text",
                        text: text
                    },
                    {
                        type: "input_image",
                        image_url: image
                    }
                ]
            }
        ];
    } else {
        throw new Error("Invalid request.");
    }

    if (storageData.store && previousId) {
        body.previous_response_id = previousId;
    }

    return body;
}

async function loadTextFile(textFileUrl) {
    const url = chrome.runtime.getURL(textFileUrl);

    const res = await fetch(url);

    return await res.text();
}

/* ---------------- TEXT API ---------------- */
async function askChatGPT(isText, apiKey, text, image=null, isSummary=false, domainOverride=null) {
    const storageData = await getData();
    let domain = null;
    let previousId = null;

    if (storageData.store) {
        if (domainOverride) {
            domain = domainOverride;
        } else {
            const tabs = await chrome.tabs.query({
                active: true,
                currentWindow: true
            });
            domain = getDomain(tabs[0].url);
        }
        // console.log("START ASKING!!!");
        previousId = getPreviousId(domain, storageData.conversations ?? {});

        if (storageData.conversations?.[domain]?.reset) {
            text = storageData.conversations?.[domain]?.summary + "\n\n" + text;
        }
    }

    const body = buildApiBody(isText, storageData, text, image, previousId, isSummary);

    const res = await fetch(
        "https://api.openai.com/v1/responses",
        {
            method: "POST",
            headers: {
                Authorization:
                    "Bearer " + apiKey,
                "Content-Type":
                    "application/json"
            },
            body: JSON.stringify(body)
        }
    );

    const data = await res.json();

    if (!res.ok) {
        // This error will be displayed in the answer textbox.
        throw new Error(
            data.error?.message ||
            "API request failed"
        );
    }

    if (storageData.store) {
        if (storageData.conversations?.[domain]?.reset) {
            storageData.conversations[domain].reset = false;
            storageData.conversations[domain].summary = null;
            await chrome.storage.local.set({
                conversations: storageData.conversations
            });
        }
    }

    if (!isSummary && storageData.store) {
        const oldCount = storageData.conversations?.[domain]?.count ?? 0;
        storageData.conversations[domain] = {
            id: data.id,
            count: oldCount + 1
        };
        await chrome.storage.local.set({
            conversations: storageData.conversations
        });
    }


    return extractText(data);
}

async function summarizeConversation(storageData, domain) {
    try {
        const { openaiApiKey } = await getData(["openaiApiKey"]);

        const summary = await askChatGPT(
            false,
            openaiApiKey,
            await loadTextFile("summary.txt"),
            null,
            true,
            domain
        );

        if (summary == null) {
            throw new Error("Summary failed.");
        }
        
        storageData.conversations[domain] = {
            id: null,
            count: 0,
            reset: true,
            summary: summary
        };

        await chrome.storage.local.set({
            conversations: storageData.conversations
        });
    } catch (e) {
        console.error("Summary failed:", e);
    }
}

/* ---------------- RESPONSE ---------------- */
function extractText(data) {
    return data.output
        ?.filter(item => item.type === "message")
        .flatMap(item => item.content ?? [])
        .filter(item => item.type === "output_text")
        .map(item => item.text)
        .join("\n") || "No response.";
}

/* ---------------- CROP UI ---------------- */
async function startCropMode() {
    if (
        document.getElementById(
            "crop-overlay"
        )
    ) return null;

    return await new Promise(
        resolve => {

            let startX = 0;
            let startY = 0;
            let dragging = false;

            const overlay =
                document.createElement(
                    "div"
                );

            overlay.id =
                "crop-overlay";

            overlay.style.position =
                "fixed";

            overlay.style.left = "0";
            overlay.style.top = "0";

            overlay.style.width =
                "100vw";

            overlay.style.height =
                "100vh";

            overlay.style.zIndex =
                "2147483647";

            overlay.style.cursor =
                "crosshair";

            overlay.style.background =
                "rgba(0,0,0,.15)";

            const box =
                document.createElement(
                    "div"
                );

            box.style.position =
                "fixed";

            box.style.border =
                "2px solid #00ff99";

            box.style.background =
                "rgba(0,255,120,.15)";

            box.style.pointerEvents =
                "none";

            box.style.display =
                "none";

            overlay.appendChild(box);

            document.body.appendChild(
                overlay
            );

            function move(ev) {

                if (!dragging) return;

                const x =
                    Math.min(
                        startX,
                        ev.clientX
                    );

                const y =
                    Math.min(
                        startY,
                        ev.clientY
                    );

                const w =
                    Math.abs(
                        ev.clientX -
                        startX
                    );

                const h =
                    Math.abs(
                        ev.clientY -
                        startY
                    );

                box.style.display =
                    "block";

                box.style.left =
                    x + "px";

                box.style.top =
                    y + "px";

                box.style.width =
                    w + "px";

                box.style.height =
                    h + "px";
            }

            function up(ev) {

                if (!dragging)
                    return;

                dragging = false;

                document.removeEventListener(
                    "mousemove",
                    move,
                    true
                );

                document.removeEventListener(
                    "mouseup",
                    up,
                    true
                );

                const x =
                    Math.min(
                        startX,
                        ev.clientX
                    );

                const y =
                    Math.min(
                        startY,
                        ev.clientY
                    );

                const w =
                    Math.abs(
                        ev.clientX -
                        startX
                    );

                const h =
                    Math.abs(
                        ev.clientY -
                        startY
                    );

                overlay.remove();

                if (
                    w < 10 ||
                    h < 10
                ) {
                    resolve(null);
                    return;
                }

                resolve({
                    x: x,
                    y: y,
                    width: w,
                    height: h,
                    scale:
                        window.devicePixelRatio ||
                        1
                });
            }

            overlay.addEventListener(
                "mousedown",
                e => {

                    e.preventDefault();

                    dragging =
                        true;

                    startX =
                        e.clientX;

                    startY =
                        e.clientY;

                    document.addEventListener(
                        "mousemove",
                        move,
                        true
                    );

                    document.addEventListener(
                        "mouseup",
                        up,
                        true
                    );
                },
                true
            );
        }
    );
}

/* ---------------- IMAGE CROP ---------------- */
async function cropImageOnPage(
    dataUrl,
    area
) {

    return await new Promise(resolve => {

        const img =
            new Image();

        img.onload = () => {

            const canvas =
                document.createElement(
                    "canvas"
                );

            canvas.width =
                area.width;

            canvas.height =
                area.height;

            const ctx =
                canvas.getContext(
                    "2d"
                );

            ctx.drawImage(
                img,
                area.x *
                area.scale,
                area.y *
                area.scale,
                area.width *
                area.scale,
                area.height *
                area.scale,
                0,
                0,
                area.width,
                area.height
            );

            resolve(
                canvas.toDataURL(
                    "image/png"
                )
            );
        };

        img.onerror = () => {
            resolve(null);
        };

        img.src = dataUrl;
    });
}

function getRandom(length) {
    return Array.from({ length: length }, () => Math.floor(Math.random() * 36).toString(36)).join('');
}

async function getData(keys=null) {
    if (Array.isArray(keys)) {
        return await chrome.storage.local.get(keys);
    }
    return await chrome.storage.local.get([
        "openaiApiKey",
        "extraPrompt",
        "textModel",
        "imageModel",
        "summaryModel",
        "maxOutputTokens",
        "store",
        "summary",
        "summaryCount",
        "conversations"
    ]);
}

/* ---------------- UI ---------------- */
function createTextBox() {
    let box = document.getElementById("clip-ask-ai-box");
    if (!box) {
        box = document.createElement("div");
        box.id = "clip-ask-ai-box";

        box.style.position = "fixed";
        box.style.left = "0";
        box.style.right = "0";
        box.style.bottom = "0";
        box.style.maxHeight = "35vh";
        box.style.overflowY = "auto";
        box.style.padding = "20px";
        box.style.boxSizing = "border-box";
        box.style.zIndex = "2147483647";
        box.style.background = "#111";
        box.style.color = "#fff";
        box.style.fontSize = "14px";
        box.style.borderTop = "1px solid #333";
        box.style.whiteSpace = "pre-wrap";

        document.body.appendChild(box);
    }

    let spacer = document.getElementById("clip-ask-ai-box-spacer");
    if (!spacer) {
        spacer = document.createElement("div");
        spacer.id = "clip-ask-ai-box-spacer";
        document.body.appendChild(spacer);
    }

    let closeBtn = document.getElementById("clip-ask-ai-closebtn");
    if (!closeBtn) {
        closeBtn = document.createElement("span");
        closeBtn.id = "clip-ask-ai-closebtn";
        closeBtn.innerHTML = "&times;";
        closeBtn.style.float = "right";
        closeBtn.style.fontSize = "52px";
        closeBtn.style.cursor = "pointer";
        closeBtn.style.color = "#ff4d4d";

        box.appendChild(closeBtn);

        closeBtn.onclick = function () {
            box.remove();
            spacer.remove();
        };
    }

    //Match spacer height to the box height to prevent content overlap.
    requestAnimationFrame(() => {
        spacer.style.height = box.offsetHeight + "px";
    });

    return box;
}

function loadingMessage(message) {
    const box = document.getElementById("clip-ask-ai-box");
    if (!box) return;
    const text = document.getElementById("clip-ask-ai-text");
    if (text) {
        text.innerHTML = ``;
    }
    let container = document.getElementById("clip-ask-ai-loading");
    if (!container) {
        container = document.createElement("div");
        container.id = "clip-ask-ai-loading";
        container.style.display = "flex";
        container.style.alignItems = "center";
        container.style.gap = "12px";

        box.appendChild(container);
    }

    let spinner = document.getElementById("clip-ask-ai-spinner");
    if (!spinner) {
        spinner = document.createElement("div");
        spinner.className = "clip-ask-ai-spinner";
        spinner.style.width = "32px";
        spinner.style.height = "32px";
        spinner.style.border = "4px solid rgba(255, 255, 255, 0.2)";
        spinner.style.borderTopColor = "rgba(255, 255, 255, 0.5)";
        spinner.style.borderRadius = "50%";
        spinner.style.animation = "clip-ask-ai-spin 0.8s linear infinite";

        container.appendChild(spinner);
    }

    // @keyframes
    let style = document.getElementById("clip-ask-ai-spinner-style");
    if (!style) {
        style = document.createElement("style");
        style.id = "clip-ask-ai-spinner-style";
        style.textContent = `
            @keyframes clip-ask-ai-spin {
                to {
                    transform: rotate(360deg);
                }
            }
        `;
        document.head.appendChild(style);
    }

    let loadingText = document.getElementById("clip-ask-ai-loading-text");
    if (!loadingText) {
        loadingText = document.createElement("div");
        loadingText.id = "clip-ask-ai-loading-text";
        loadingText.style.color = "rgba(255, 255, 255, 0.5)";
        container.appendChild(loadingText);
    }

    loadingText.textContent = message;
}

function removeLoadingMessage() {
    const loadingContainer = document.getElementById("clip-ask-ai-loading");
    if (loadingContainer) loadingContainer.remove();
}

function showAnswer(answer) {
    const box = document.getElementById("clip-ask-ai-box");
    if (!box) return;

    let text = document.getElementById("clip-ask-ai-text");
    if (!text) {
        text = document.createElement("div");
        text.id = "clip-ask-ai-text"
    }
    text.innerHTML = DOMPurify.sanitize(marked.parse(answer));

    box.appendChild(text);
}

async function inject(id) {
    await chrome.scripting.executeScript({
        target: { tabId: id },
        files: [
            "marked.umd.js",
            "purify.min.js"
        ]
    });
}