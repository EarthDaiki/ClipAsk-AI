document.addEventListener("DOMContentLoaded", async () => {
    const result = await getData([
        "openaiApiKey",
        "extraPrompt",
        "textModel",
        "imageModel",
        "summaryModel",
        "maxOutputTokens",
        "store",
        "summary",
        "summaryCount",
    ]);

    let models = [];

    if (result.openaiApiKey) {
        document.getElementById("apiKey").value = result.openaiApiKey;
        document.getElementById("settingContainer").hidden = false;
        models = await setModel(result.openaiApiKey);
        handleAdvancedMenuBtn();
    } else {
        createContinueBtn();
        handleApiKeyInput();
    }

    if (result.extraPrompt) {
        document.getElementById("extraPrompt").value = result.extraPrompt;
    }

    const textModel = document.getElementById("textModel");
    if (result.textModel) {
        const exist = models.some(model => model.id === result.textModel);
        if (exist) {
            textModel.value = result.textModel;
        } else {
            textModel.value = "";
        }
    } else {
        textModel.value = "";
    }

    const imageModel = document.getElementById("imageModel");
    if (result.imageModel) {
        const exist = models.some(model => model.id === result.imageModel);
        if (exist) {
            imageModel.value = result.imageModel;
        }
    } else {
        imageModel.value = "";
    }

    const summaryModel = document.getElementById("summaryModel");
    if (result.summaryModel) {
        const exist = models.some(model => model.id === result.summaryModel);
        if (exist) {
            summaryModel.value = result.summaryModel;
        }
    } else {
        summaryModel.value = "";
    }

    if (result.maxOutputTokens) {
        document.getElementById("maxOutputTokens").value = result.maxOutputTokens;
    }

    if (result.store) {
        document.getElementById("chatOn").checked = true;
        const advancedSettingsContainer = document.getElementById("advancedSettingsContainer");
        advancedSettingsContainer.hidden = false;
    } else {   
        document.getElementById("chatOff").checked = true;    
        const advancedSettingsContainer = document.getElementById("advancedSettingsContainer");
        advancedSettingsContainer.hidden = true;
    }

    if (result.summary) {
        document.getElementById("summaryOn").checked = true;
    }

    if (result.summaryCount) {
        document.getElementById("summaryCount").value = result.summaryCount;
    }

    // Run after checking whether "summaryOn" is enabled
    handleSummaryBtn();
    handleChatModeRadio();
    await handlePage();

    document.getElementById("saveBtn").addEventListener("click", async () => {
        const apiKey = document.getElementById("apiKey").value.trim();
        const extraPrompt = document.getElementById("extraPrompt").value.trim();
        const textModel = document.getElementById("textModel").value.trim();
        const imageModel = document.getElementById("imageModel").value.trim();
        const summaryModel = document.getElementById("summaryModel").value.trim();
        const summaryCount = Number(document.getElementById("summaryCount").value.trim());
        const maxOutputTokens = Number(document.getElementById("maxOutputTokens").value.trim());
        let store = false;
        if (document.getElementById("chatOn").checked) {
            store = true;
        }
        let summary = false;
        if (document.getElementById("summaryOn").checked) {
            summary = true;
        }
        const status = document.getElementById("status");
        
        if (maxOutputTokens < 100) {
            setMessage("Need to set 100 or more.");
            return;
        }
        await chrome.storage.local.set({
            openaiApiKey: apiKey,
            extraPrompt: extraPrompt,
            textModel: textModel,
            imageModel: imageModel,
            summaryModel: summaryModel,
            maxOutputTokens: maxOutputTokens,
            store: store,
            summary: summary,
            summaryCount: summaryCount,
        });

        status.textContent = "Settings saved.";

        setTimeout(() => {
            status.textContent = "";
        }, 2000);
    });
});

function createContinueBtn() {
    const apiKeyContainer = document.getElementById("apiKeyContainer");
    const continueBtn = document.createElement("button");
    continueBtn.id = "continueBtn";
    continueBtn.textContent = "Save & Continue";
    continueBtn.disabled = true;

    continueBtn.addEventListener("click", handleContinueClick);

    apiKeyContainer.appendChild(continueBtn);

    return continueBtn;
}

function handleApiKeyInput() {
    const input = document.getElementById("apiKey");
    const btn = document.getElementById("continueBtn");

    input.addEventListener("input", () => {
        btn.disabled = input.value.trim().length === 0;
    });
}

async function handleContinueClick() {
    const apiKey = document.getElementById("apiKey").value.trim();

    const models = await setModel(apiKey);
    if (models.length > 0) {
        await chrome.storage.local.set({
            openaiApiKey: apiKey
        });
    } else {
        setMessage("API Key is invalid.")
    }
}

function handleChatModeRadio() {
    const chatOn = document.getElementById("chatOn");
    const chatOff = document.getElementById("chatOff");
    const container = document.getElementById("advancedSettingsContainer");
    chatOn.addEventListener("change", () => {
        container.hidden = !chatOn.checked;
    });
    chatOff.addEventListener("change", () => {
        container.hidden = !chatOn.checked;
    });
}

function handleAdvancedMenuBtn() {
    const btn = document.getElementById("advancedMenuBtn");
    const menuContainer = document.getElementById("advancedExpandedGroup");
    btn.addEventListener("click", () => {
        menuContainer.hidden = !menuContainer.hidden;
        if (menuContainer.hidden){
            btn.textContent = "Advanced Settings ▼";
            btn.classList.remove("active");
            menuContainer.classList.remove("active");
        } else {
            btn.textContent = "Advanced Settings ▲";
            btn.classList.add("active");
            menuContainer.classList.add("active");
        }
    });
}

function handleSummaryBtn() {
    const checkbox = document.getElementById("summaryOn");
    const summaryDetails = document.getElementById("summaryDetails");
    summaryDetails.hidden = !checkbox.checked;
    checkbox.addEventListener("change", () => {
        summaryDetails.hidden = !checkbox.checked;
    });
}

async function handlePage() {
    const tabs = document.querySelectorAll(".tab-btn");
    const pages = document.querySelectorAll(".page");
    tabs.forEach(btn => {
        btn.addEventListener("click", async () => {
            if (btn.classList.contains("active")) return;
            tabs.forEach(tab => {
                tab.classList.remove("active");
            })
            pages.forEach(page => {
                page.classList.remove("active");
            })
            btn.classList.add("active");
            document.getElementById(btn.dataset.tab).classList.add("active");

            const activePage = document.querySelector(".page.active");
            if (activePage.id === "memoryPage") {
                await createDomainList();
            }
        });
    });
}

function handleConfirm(message) {
    return new Promise((resolve) => {

        const modal = document.getElementById("confirmModal");
        const text = document.getElementById("confirmText");

        modal.classList.add("active");
        text.textContent = message;

        document.getElementById("confirmYes").onclick = () => {
            modal.classList.remove("active");
            resolve(true);
        };

        document.getElementById("confirmNo").onclick = () => {
            modal.classList.remove("active");
            resolve(false);
        };

    });
}

async function createDomainList() {
    const domainList = document.getElementById("domainList");
    // clear domainList to update it.
    domainList.innerHTML = "";
    const {conversations} = await getData(["conversations"]);
    const conv = conversations || {};
    if (Object.keys(conv).length === 0) {
        const span = document.createElement("span");
        const row = document.createElement("div");
        span.textContent = "No saved domains yet.";
        row.className = "item-row";
        row.appendChild(span);
        domainList.appendChild(row);
    }
    for (const domain of Object.keys(conv)) {
        const span = document.createElement("span");
        const button = document.createElement("button");
        const row = document.createElement("div");
        span.textContent = domain;
        button.textContent = "🗑";
        button.addEventListener("click", async () => {
            if (await handleConfirm(`Do you want to delete ${domain} chat history`)) {
                console.log(domain);
                const {conversations} = await getData(["conversations"]);
                const tempConv = conversations || {};
                delete tempConv[domain];
                await chrome.storage.local.set({
                    conversations: tempConv
                });

                createDomainList();
            }
        })
        row.className = "item-row";
        row.appendChild(span);
        row.appendChild(button);
        domainList.appendChild(row);
    }
}

function setMessage(text) {
    const message = document.getElementById("message");
    message.hidden = false;
    const p = message.querySelector("p");
    p.textContent = text;
}

async function setModel(apiKey) {
    const data = await getModels(apiKey);
    if (!data) { return []; }

    document.getElementById("settingContainer").hidden = false;

    const modelLabels = {
        "gpt-6.1-sol": "Recommended",
        "gpt-6.1-terra": "Balanced",
        "gpt-6-luna": "Budget"
    };

    let models = data.data.filter(model =>
        Object.hasOwn(modelLabels, model.id)
    );
    if (models.length === 0) {
        models = data.data.filter(model => 
            /^gpt-[56](\.|-|$)/.test(model.id)
        );
    }

    const textModelSelect = document.getElementById("textModel");
    const imageModelSelect = document.getElementById("imageModel");
    const summaryModelSelect = document.getElementById("summaryModel");
    const selects = [textModelSelect, imageModelSelect, summaryModelSelect];
    for (const select of selects) {
        if (!select.value) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "Select a model";
            option.disabled = true;
            option.selected = true;
            option.hidden = true;
            select.appendChild(option);
        }
        for (const model of models) {
            let textContent = `${model.id}`;
            if (modelLabels[model.id]) {
                textContent = `${model.id} - ${modelLabels[model.id]}`;
            }
            const option = document.createElement("option");
            option.value = model.id;
            option.textContent = textContent;
            select.appendChild(option);
        }
    }

    if (models.length > 0) {
        const continueBtn = document.getElementById("continueBtn");
        if (continueBtn) {
            continueBtn.remove();
        }
    }

    return models;
}

async function getModels(apiKey) {
    try {
        const res = await fetch("https://api.openai.com/v1/models", {
            headers: {
                Authorization: `Bearer ${apiKey}`
            }
        });

        const data = await res.json();
        if (res.status != 200) {
            setMessage(data.error.message);
            return;
        }
        return data
    } catch (error){
        setMessage("Error: " + error.message);
        return;
    }
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