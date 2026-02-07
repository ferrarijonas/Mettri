// Module: marketing.enviar

"use strict";var MettriModule_marketing_enviar=(()=>{var o=Object.defineProperty;var d=Object.getOwnPropertyDescriptor;var u=Object.getOwnPropertyNames;var l=Object.prototype.hasOwnProperty;var m=(e,r)=>{for(var n in r)o(e,n,{get:r[n],enumerable:!0})},p=(e,r,n,t)=>{if(r&&typeof r=="object"||typeof r=="function")for(let i of u(r))!l.call(e,i)&&i!==n&&o(e,i,{get:()=>r[i],enumerable:!(t=d(r,i))||t.enumerable});return e};var s=e=>p(o({},"__esModule",{value:!0}),e);var f={};m(f,{EnviarModule:()=>a,register:()=>c});var a={id:"marketing.enviar",name:"Enviar",parent:"marketing",icon:"\u2709\uFE0F",dependencies:[],defaultSubModuleId:"marketing.enviar.retomar",panelFactory:()=>{throw new Error("EnviarModule \xE9 apenas um container, n\xE3o tem UI pr\xF3pria")},lazy:!1};function c(e){e.register(a)}return s(f);})();

// Auto-register module if register function is available in global scope
(function() {
  try {
    // Try to find register function from parent scope (passed as parameter)
    if (typeof register === 'function') {
      // Find module definition (could be named differently per module)
      var moduleDef = null;
      var moduleNames = ['ReactivationModule', 'RetomarModule', 'EnviarModule', 'HistoryModule', 'DirectoryModule', 'DashboardModule', 'TestsModule', 'MarketingModule', 'AtendimentoModule', 'ClientesModule', 'InfrastructureModule', 'EnviarRetomarModule', 'EnviarResponderModule', 'EnviarDivulgarModule'];
      for (var i = 0; i < moduleNames.length; i++) {
        if (typeof window[moduleNames[i]] !== 'undefined') {
          moduleDef = window[moduleNames[i]];
          break;
        }
      }
      // Also check global variable
      if (!moduleDef && typeof MettriModule_marketing_enviar !== 'undefined') {
        if (MettriModule_marketing_enviar.module) {
          moduleDef = MettriModule_marketing_enviar.module;
        } else if (MettriModule_marketing_enviar.id) {
          moduleDef = MettriModule_marketing_enviar;
        }
      }
      if (moduleDef && moduleDef.id) {
        register(moduleDef);
      }
    }
    // Export to global for fallback access
    if (typeof window !== 'undefined') {
      window.MettriModule_marketing_enviar = typeof MettriModule_marketing_enviar !== 'undefined' ? MettriModule_marketing_enviar : null;
    }
  } catch (e) {
    console.warn('[ModuleLoader] Error auto-registering module:', e);
  }
})();

