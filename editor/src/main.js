// main.js — entry point
// All module scripts have been evaluated at this point.
// Execute the two module-level bootstraps that kick off the shell.

      if (
        els.slideTemplateBar &&
        els.slideTemplateBar.parentElement !== document.body
      ) {
        document.body.appendChild(els.slideTemplateBar);
      }

      init();
