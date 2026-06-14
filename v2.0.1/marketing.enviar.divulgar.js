// Module: marketing.enviar.divulgar

"use strict";var MettriModule_marketing_enviar_divulgar=(()=>{var a=Object.defineProperty;var s=Object.getOwnPropertyDescriptor;var d=Object.getOwnPropertyNames;var u=Object.prototype.hasOwnProperty;var c=(n,e)=>{for(var t in e)a(n,t,{get:e[t],enumerable:!0})},m=(n,e,t,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of d(e))!u.call(n,r)&&r!==t&&a(n,r,{get:()=>e[r],enumerable:!(i=s(e,r))||i.enumerable});return n};var v=n=>m(a({},"__esModule",{value:!0}),n);var g={};c(g,{EnviarDivulgarModule:()=>l,register:()=>f});var o=class{container=null;constructor(){}async render(){let e=document.createElement("div");return e.className="flex flex-col gap-3",this.container=e,e.innerHTML=`
      <div class="glass-subtle rounded-xl p-3">
        <div class="text-sm font-semibold text-foreground">Divulgar</div>
        <div class="text-xs text-muted-foreground mt-1">
          Mock: aqui ficar\xE1 o fluxo de divulgar (campanha/aviso) com aprova\xE7\xE3o humana.
        </div>
      </div>

      <button
        type="button"
        class="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        disabled
      >
        Enviar (mock)
      </button>
    `,e}destroy(){this.container&&(this.container.innerHTML=""),this.container=null}};var p=async(n,e)=>{let t=new o;return{async render(){let i=await t.render();n.appendChild(i)},destroy(){t.destroy(),n&&(n.innerHTML="")}}},l={id:"marketing.enviar.divulgar",name:"Divulgar",parent:"marketing.enviar",icon:"\u{1F4E2}",dependencies:[],panelFactory:p,lazy:!0};function f(n){n.register(l)}return v(g);})();

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
      if (!moduleDef && typeof MettriModule_marketing_enviar_divulgar !== 'undefined') {
        if (MettriModule_marketing_enviar_divulgar.module) {
          moduleDef = MettriModule_marketing_enviar_divulgar.module;
        } else if (MettriModule_marketing_enviar_divulgar.id) {
          moduleDef = MettriModule_marketing_enviar_divulgar;
        }
      }
      if (moduleDef && moduleDef.id) {
        register(moduleDef);
      }
    }
    // Export to global for fallback access
    if (typeof window !== 'undefined') {
      window.MettriModule_marketing_enviar_divulgar = typeof MettriModule_marketing_enviar_divulgar !== 'undefined' ? MettriModule_marketing_enviar_divulgar : null;
    }
  } catch (e) {
    console.warn('[ModuleLoader] Error auto-registering module:', e);
  }
})();

