/* Task-Manager is a module, not a second independently branded application. */
(() => {
  "use strict";
  let embedded=false;
  try { embedded=window.parent!==window&&window.parent.location.origin===location.origin&&new URLSearchParams(location.search).get("embedded")==="1"&&Boolean(window.parent.ClientLiteStore); } catch { /* unrelated embedding is not trusted */ }
  if(!embedded){location.replace("lite-demo.html#task-manager");return;}
  document.documentElement.classList.add("embedded-module");
  window.ClientLiteStore=window.parent.ClientLiteStore;
})();
