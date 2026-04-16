// preview.js  (core)
// Layer: Preview Build
// Orchestrates preview package creation and bridge injection.
// buildBridgeScript  → bridge-script.js
// bridge commands    → bridge-commands.js
//
      // ZONE: Preview Build & Bridge Bootstrap
      // buildPreviewPackage, injectBridge, buildBridgeScript — creates iframe blob URL
      // =====================================================================
      function buildPreviewPackage() {
        return buildRenderedOutputPackage({
          renderMode: "preview",
          applyAssetResolver: Boolean(state.assetResolverMap),
          keepEditorArtifacts: true,
          includeBridge: true,
          auditAssets: true,
          captureAuditToState: true,
          manualBaseUrl: getManualBaseUrl(),
        });
      }

      // injectBridge
      // Встраивает внутрь preview минимальный runtime-мост. Он отвечает за выбор
      // элементов, операции над DOM и обратные сообщения в shell.
      function injectBridge(doc) {
        const bridgeScript = doc.createElement("script");
        bridgeScript.id = "__presentation_editor_bridge__";
        bridgeScript.textContent = buildBridgeScript(state.bridgeToken);
        doc.body.appendChild(bridgeScript);
      }

      // buildBridgeScript
      // Возвращает строку JS, которая выполняется внутри iframe. Важно: код моста
      // живёт внутри превью, чтобы работать с реальным DOM презентации, не ломая
      // исходный head/body и не втаскивая в iframe весь shell-UI редактора.