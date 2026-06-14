// Module: pedidos

"use strict";var MettriModule_pedidos=(()=>{var n=Object.defineProperty;var a=Object.getOwnPropertyDescriptor;var t=Object.getOwnPropertyNames;var s=Object.prototype.hasOwnProperty;var l=(o,e)=>{for(var i in e)n(o,i,{get:e[i],enumerable:!0})},p=(o,e,i,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let d of t(e))!s.call(o,d)&&d!==i&&n(o,d,{get:()=>e[d],enumerable:!(r=a(e,d))||r.enumerable});return o};var u=o=>p(n({},"__esModule",{value:!0}),o);var f={};l(f,{PedidosModule:()=>c});var c={id:"pedidos",name:"Pedidos",icon:"\u{1F4E6}",dependencies:[],defaultSubModuleId:"pedidos.dashboard",panelFactory:()=>{throw new Error("PedidosModule \xE9 apenas container, n\xE3o tem UI pr\xF3pria.")},lazy:!1};return u(f);})();

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
      if (!moduleDef && typeof MettriModule_pedidos !== 'undefined') {
        if (MettriModule_pedidos.module) {
          moduleDef = MettriModule_pedidos.module;
        } else if (MettriModule_pedidos.id) {
          moduleDef = MettriModule_pedidos;
        }
      }
      if (moduleDef && moduleDef.id) {
        register(moduleDef);
      }
    }
    // Export to global for fallback access
    if (typeof window !== 'undefined') {
      window.MettriModule_pedidos = typeof MettriModule_pedidos !== 'undefined' ? MettriModule_pedidos : null;
    }
  } catch (e) {
    console.warn('[ModuleLoader] Error auto-registering module:', e);
  }
})();

