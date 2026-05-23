    (function () {
      var GEN_PATH = "/v1/images/generations";
      var EDIT_PATH = "/v1/images/edits";
      var HISTORY_KEY = "imageStudioHistory";
      var MAX_HISTORY = 24;
      var baseUrlEl = document.getElementById("baseUrl");
      var apiKeyEl = document.getElementById("apiKey");
      var logEl = document.getElementById("log");
      var galleryEl = document.getElementById("gallery");
      var historyGalleryEl = document.getElementById("historyGallery");
      var modeStatus = document.getElementById("modeStatus");
      var promptStatus = document.getElementById("promptStatus");
      var modelStatus = document.getElementById("modelStatus");
      var urlStatus = document.getElementById("urlStatus");
      var keyStatus = document.getElementById("keyStatus");
      var resultSubtitle = document.getElementById("resultSubtitle");
      var resultModelTag = document.getElementById("resultModelTag");
      var resultModeTag = document.getElementById("resultModeTag");
      var resultCountTag = document.getElementById("resultCountTag");
      var credentialsPanel = document.getElementById("credentialsPanel");
      var settingsOverlay = document.getElementById("settingsOverlay");
      var historyOverlay = document.getElementById("historyOverlay");
      var batchOverlay = document.getElementById("batchOverlay");
      var templateOverlay = document.getElementById("templateOverlay");
      var batchPromptsEl = document.getElementById("batchPrompts");
      var templateGridEl = document.getElementById("templateGrid");
      var credentialUrlText = document.getElementById("credentialUrlText");
      var credentialKeyText = document.getElementById("credentialKeyText");
      var currentMode = "gen";

      function stripSlash(s) {
        return String(s || "").replace(/\/+$/, "");
      }

      function maskValue(value) {
        var text = String(value || "");
        if (text.length <= 10) return text;
        return text.slice(0, 6) + "…" + text.slice(-4);
      }

      function activeCount() {
        if (currentMode !== "gen") return 1;
        var model = document.getElementById("genModel").value;
        var n = parseInt(document.getElementById("genN").value, 10) || 1;
        return model === "gpt-image-2" ? n : 1;
      }

      function extensionFromMime(mime) {
        if (/jpe?g/i.test(mime)) return "jpg";
        if (/webp/i.test(mime)) return "webp";
        return "png";
      }

      function setBatchOpen(open) {
        batchOverlay.classList.toggle("open", open);
        batchOverlay.setAttribute("aria-hidden", open ? "false" : "true");
      }

      function setTemplateOpen(open) {
        templateOverlay.classList.toggle("open", open);
        templateOverlay.setAttribute("aria-hidden", open ? "false" : "true");
      }

      function log(msg, obj) {
        var text = typeof obj !== "undefined" ? msg + "\n" + JSON.stringify(obj, null, 2) : String(msg);
        logEl.textContent = text;
      }

      function setBusy(btn, busy) {
        btn.disabled = !!busy;
        btn.textContent = busy ? "请求中…" : btn.dataset.label || btn.textContent;
      }

      function ensureKey() {
        var k = (apiKeyEl.value || "").trim();
        if (!k) {
          alert("请填写 Bearer Token（sk-…）");
          return null;
        }
        return k;
      }

      function setSettingsOpen(open) {
        settingsOverlay.classList.toggle("open", open);
        settingsOverlay.setAttribute("aria-hidden", open ? "false" : "true");
      }

      function setHistoryOpen(open) {
        historyOverlay.classList.toggle("open", open);
        historyOverlay.setAttribute("aria-hidden", open ? "false" : "true");
        if (open) renderHistory();
      }

      async function generateImages(promptText, options) {
        var token = ensureKey();
        if (!token) return null;
        var base = stripSlash(baseUrlEl.value.trim());
        var model = options.model;
        var n = options.n;
        var body = {
          model: model,
          prompt: promptText,
          response_format: "b64_json",
          image_size: options.imageSize,
          aspect_ratio: options.aspectRatio || "1:1",
          n: n
        };

        var resp = await fetch(base + GEN_PATH, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify(body)
        });
        var text = await resp.text();
        var json = null;
        try {
          json = JSON.parse(text);
        } catch (e) {
          throw new Error("非 JSON 响应 (" + resp.status + "):\n" + text.slice(0, 8000));
        }
        if (!resp.ok) {
          throw new Error("HTTP " + resp.status + "\n" + JSON.stringify(json, null, 2));
        }
        return json;
      }

      function activePromptEl() {
        return currentMode === "gen" ? document.getElementById("genPrompt") : document.getElementById("editPrompt");
      }

      function readPromptByMode() {
        return activePromptEl().value.trim();
      }

      function setPromptByMode(text) {
        activePromptEl().value = text;
        updateStatus();
      }

      function saveCredentials() {
        var base = baseUrlEl.value.trim();
        var key = apiKeyEl.value.trim();
        localStorage.setItem("imageStudioBaseUrl", base);
        localStorage.setItem("imageStudioApiKey", key);
        setSettingsOpen(false);
        updateStatus();
      }

      function activeModel() {
        return currentMode === "gen" ? document.getElementById("genModel").value : document.getElementById("editModel").value;
      }

      function activeSize() {
        return currentMode === "gen" ? document.getElementById("genImageSize").value : document.getElementById("editImageSize").value;
      }

      function currentGenerationOptions() {
        return {
          model: document.getElementById("genModel").value,
          imageSize: document.getElementById("genImageSize").value,
          aspectRatio: document.getElementById("genAspect").value || "1:1",
          n: parseInt(document.getElementById("genN").value, 10) || 1
        };
      }

      async function runBatchGeneration() {
        var prompts = batchPromptsEl.value.split(/\n+/).map(function (line) { return line.trim(); }).filter(Boolean);
        if (!prompts.length) {
          alert("请先输入批量提示词");
          return;
        }
        var baseOptions = currentGenerationOptions();
        var btn = document.getElementById("btnRunBatch");
        btn.disabled = true;
        btn.textContent = "批量执行中…";
        try {
          for (var i = 0; i < prompts.length; i++) {
            log("批量生成 " + (i + 1) + "/" + prompts.length, { prompt: prompts[i] });
            var json = await generateImages(prompts[i], {
              model: baseOptions.model,
              imageSize: baseOptions.imageSize,
              aspectRatio: baseOptions.aspectRatio,
              n: baseOptions.model === "gpt-image-2" ? baseOptions.n : 1
            });
            showImagesFromData(json.data || []);
          }
          setHistoryOpen(true);
        } catch (err) {
          log("批量生成异常: " + (err && err.message ? err.message : String(err)));
        } finally {
          btn.disabled = false;
          btn.textContent = "开始批量";
        }
      }

      function bindTemplateButtons() {
        templateGridEl.addEventListener("click", function (event) {
          var btn = event.target.closest(".template-card[data-prompt]");
          if (!btn) return;
          setPromptByMode(btn.dataset.prompt);
          setTemplateOpen(false);
        });
      }

      function imageSrc(item) {
        return "data:" + (item.mime || "image/png") + ";base64," + item.b64;
      }

      function makeFilename(item, index) {
        return "ai-image-" + (item.createdAt || Date.now()) + "-" + (index + 1) + "." + extensionFromMime(item.mime || "image/png");
      }

      function readHistory() {
        try {
          var saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
          return Array.isArray(saved) ? saved : [];
        } catch (e) {
          return [];
        }
      }

      function writeHistory(items) {
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
        } catch (e) {
          log("历史保存失败：浏览器本地存储空间可能已满。");
        }
      }

      function buildImageFigure(item, index) {
        var fig = document.createElement("figure");
        var img = document.createElement("img");
        var cap = document.createElement("figcaption");
        var actions = document.createElement("div");
        var download = document.createElement("a");
        img.alt = "result-" + (index + 1);
        img.src = imageSrc(item);
        cap.textContent = item.label || ("#" + (index + 1) + " · " + (item.mime || "image/png"));
        actions.className = "image-actions";
        download.className = "download-link";
        download.href = img.src;
        download.download = makeFilename(item, index);
        download.textContent = "下载图片";
        actions.appendChild(download);
        fig.appendChild(img);
        fig.appendChild(cap);
        fig.appendChild(actions);
        return fig;
      }

      function renderHistory() {
        var history = readHistory();
        historyGalleryEl.innerHTML = "";
        if (!history.length) {
          historyGalleryEl.className = "history-grid empty";
          historyGalleryEl.textContent = "暂无历史图片";
          return;
        }
        historyGalleryEl.className = "history-grid";
        history.forEach(function (item, index) {
          historyGalleryEl.appendChild(buildImageFigure(item, index));
        });
      }

      function saveImagesToHistory(items) {
        if (!items.length) return;
        var history = items.concat(readHistory());
        writeHistory(history);
        renderHistory();
      }

      function renderEmpty() {
        galleryEl.className = "images empty";
        galleryEl.innerHTML = '<div class="empty-state"><div><span class="empty-icon">+</span><strong>生成后的图片将显示在这里</strong><p>输入提示词并点击“开始生成”</p></div></div>';
      }

      function updateStatus() {
        var isGen = currentMode === "gen";
        var modeLabel = isGen ? "文生图" : "参考图";
        var count = activeCount();
        var baseValue = baseUrlEl.value.trim();
        var keyValue = apiKeyEl.value.trim();
        modeStatus.textContent = modeLabel;
        promptStatus.textContent = isGen ? "纯提示词" : "参考图编辑";
        modelStatus.textContent = activeModel();
        urlStatus.textContent = baseValue ? "已填写 URL" : "未填写 URL";
        keyStatus.textContent = keyValue ? "本次已填写" : "未填写";
        credentialUrlText.textContent = baseValue ? maskValue(baseValue) : "未填写 URL";
        credentialKeyText.textContent = keyValue ? maskValue(keyValue) : "未填写";
        resultModelTag.textContent = activeModel();
        resultModeTag.textContent = modeLabel;
        resultCountTag.textContent = String(count);
        resultSubtitle.textContent = modeLabel + " · " + activeSize() + " · PNG";
      }

      function setMode(nextMode) {
        currentMode = nextMode;
        var isGen = nextMode === "gen";
        ["tabGen", "modeGen"].forEach(function (id) { document.getElementById(id).classList.toggle("active", isGen); });
        ["tabEdit", "modeEdit"].forEach(function (id) { document.getElementById(id).classList.toggle("active", !isGen); });
        document.getElementById("panelGen").classList.toggle("active", isGen);
        document.getElementById("panelEdit").classList.toggle("active", !isGen);
        updateStatus();
      }

      function showImagesFromData(dataArr) {
        galleryEl.innerHTML = "";
        galleryEl.className = "images";
        if (!dataArr || !dataArr.length) {
          renderEmpty();
          return;
        }
        var createdAt = Date.now();
        var items = [];
        dataArr.forEach(function (item, i) {
          var b64 = item.b64_json;
          var mime = item.mime_type || "image/png";
          if (!b64) return;
          items.push({
            b64: b64,
            mime: mime,
            mode: currentMode === "gen" ? "文生图" : "参考图",
            model: activeModel(),
            size: activeSize(),
            createdAt: createdAt,
            label: "#" + (i + 1) + " · " + mime
          });
        });
        if (!items.length) {
          renderEmpty();
          return;
        }
        items.forEach(function (item, index) {
          galleryEl.appendChild(buildImageFigure(item, index));
        });
        saveImagesToHistory(items);
      }

      ["tabGen", "modeGen"].forEach(function (id) {
        document.getElementById(id).addEventListener("click", function () { setMode("gen"); });
      });
      ["tabEdit", "modeEdit"].forEach(function (id) {
        document.getElementById(id).addEventListener("click", function () { setMode("edit"); });
      });

      document.querySelectorAll(".ratio-grid").forEach(function (grid) {
        grid.addEventListener("click", function (event) {
          var btn = event.target.closest("button[data-value]");
          if (!btn) return;
          grid.querySelectorAll("button").forEach(function (item) { item.classList.remove("active"); });
          btn.classList.add("active");
          document.getElementById(grid.dataset.target).value = btn.dataset.value;
          updateStatus();
        });
      });

      document.getElementById("btnClear").addEventListener("click", function (event) {
        event.preventDefault();
        log("已清空。");
        renderEmpty();
      });

      document.getElementById("btnClearHistory").addEventListener("click", function () {
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
      });

      document.getElementById("openBatchRail").addEventListener("click", function (event) {
        event.preventDefault();
        setBatchOpen(true);
      });

      document.getElementById("openTemplateRail").addEventListener("click", function (event) {
        event.preventDefault();
        setTemplateOpen(true);
      });

      document.getElementById("closeBatch").addEventListener("click", function () {
        setBatchOpen(false);
      });

      document.getElementById("closeTemplates").addEventListener("click", function () {
        setTemplateOpen(false);
      });

      batchOverlay.addEventListener("click", function (event) {
        if (event.target === batchOverlay) setBatchOpen(false);
      });

      templateOverlay.addEventListener("click", function (event) {
        if (event.target === templateOverlay) setTemplateOpen(false);
      });

      document.getElementById("btnRunBatch").addEventListener("click", runBatchGeneration);
      bindTemplateButtons();

      document.getElementById("openHistoryRail").addEventListener("click", function (event) {
        event.preventDefault();
        setHistoryOpen(true);
      });

      document.getElementById("closeHistory").addEventListener("click", function () {
        setHistoryOpen(false);
      });

      historyOverlay.addEventListener("click", function (event) {
        if (event.target === historyOverlay) setHistoryOpen(false);
      });

      document.getElementById("openSettings").addEventListener("click", function () {
        setSettingsOpen(true);
      });

      document.getElementById("openSettingsRail").addEventListener("click", function (event) {
        event.preventDefault();
        setSettingsOpen(true);
      });

      document.getElementById("closeSettings").addEventListener("click", function () {
        setSettingsOpen(false);
      });

      settingsOverlay.addEventListener("click", function (event) {
        if (event.target === settingsOverlay) setSettingsOpen(false);
      });

      document.getElementById("saveCredentials").addEventListener("click", saveCredentials);

      [baseUrlEl, apiKeyEl, document.getElementById("genModel"), document.getElementById("editModel"), document.getElementById("genImageSize"), document.getElementById("editImageSize"), document.getElementById("genN")].forEach(function (el) {
        el.addEventListener("input", updateStatus);
        el.addEventListener("change", updateStatus);
      });

      var genBtn = document.getElementById("btnGenerate");
      genBtn.dataset.label = genBtn.textContent;

      genBtn.addEventListener("click", async function () {
        var token = ensureKey();
        if (!token) return;
        var base = stripSlash(baseUrlEl.value.trim());
        var model = document.getElementById("genModel").value;
        var n = parseInt(document.getElementById("genN").value, 10) || 1;
        if (model !== "gpt-image-2") n = 1;

        var body = {
          model: model,
          prompt: document.getElementById("genPrompt").value.trim(),
          response_format: "b64_json",
          image_size: document.getElementById("genImageSize").value,
          aspect_ratio: document.getElementById("genAspect").value || "1:1",
          n: n
        };

        var url = base + GEN_PATH;
        setBusy(genBtn, true);
        log("POST " + url, body);
        updateStatus();

        try {
          var resp = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token
            },
            body: JSON.stringify(body)
          });
          var text = await resp.text();
          var json = null;
          try {
            json = JSON.parse(text);
          } catch (e) {
            log("非 JSON 响应 (" + resp.status + "):\n" + text.slice(0, 8000));
            return;
          }
          if (!resp.ok) {
            log("HTTP " + resp.status, json);
            return;
          }
          showImagesFromData(json.data || []);
          log("完整响应", json);
        } catch (err) {
          log("请求异常: " + (err && err.message ? err.message : String(err)));
        } finally {
          setBusy(genBtn, false);
          updateStatus();
        }
      });

      var editBtn = document.getElementById("btnEdit");
      editBtn.dataset.label = editBtn.textContent;

      editBtn.addEventListener("click", async function () {
        var token = ensureKey();
        if (!token) return;

        var filesInput = document.getElementById("editFiles");
        if (!filesInput.files || !filesInput.files.length) {
          alert("请至少选择一张 image 文件");
          return;
        }

        var base = stripSlash(baseUrlEl.value.trim());
        var fd = new FormData();
        fd.append("model", document.getElementById("editModel").value);
        fd.append("prompt", document.getElementById("editPrompt").value.trim());
        fd.append("response_format", "b64_json");
        fd.append("image_size", document.getElementById("editImageSize").value);
        fd.append("aspect_ratio", document.getElementById("editAspect").value || "1:1");
        fd.append("n", "1");

        for (var i = 0; i < filesInput.files.length; i++) {
          fd.append("image", filesInput.files[i], filesInput.files[i].name || "image.png");
        }

        var url = base + EDIT_PATH;
        setBusy(editBtn, true);
        log("POST multipart " + url + "\n(字段: model, prompt, response_format, image_size, aspect_ratio, n, image×" + filesInput.files.length + ")");
        updateStatus();

        try {
          var resp = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: "Bearer " + token
            },
            body: fd
          });
          var text = await resp.text();
          var json = null;
          try {
            json = JSON.parse(text);
          } catch (e) {
            log("非 JSON 响应 (" + resp.status + "):\n" + text.slice(0, 8000));
            return;
          }
          if (!resp.ok) {
            log("HTTP " + resp.status, json);
            return;
          }
          showImagesFromData(json.data || []);
          log("完整响应", json);
        } catch (err) {
          log("请求异常: " + (err && err.message ? err.message : String(err)));
        } finally {
          setBusy(editBtn, false);
          updateStatus();
        }
      });

      document.getElementById("genModel").addEventListener("change", function () {
        var m = document.getElementById("genModel").value;
        var nEl = document.getElementById("genN");
        if (m !== "gpt-image-2") {
          nEl.value = 1;
          nEl.disabled = true;
        } else {
          nEl.disabled = false;
        }
        updateStatus();
      });

      var savedBaseUrl = localStorage.getItem("imageStudioBaseUrl") || "";
      var savedApiKey = localStorage.getItem("imageStudioApiKey") || "";
      baseUrlEl.value = savedBaseUrl;
      apiKeyEl.value = savedApiKey;
      renderEmpty();
      renderHistory();
      setSettingsOpen(false);
      setHistoryOpen(false);
      setMode("gen");
    })();
