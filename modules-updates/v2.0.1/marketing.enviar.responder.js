// Module: marketing.enviar.responder

"use strict";var MettriModule_marketing_enviar_responder=(()=>{var s=Object.defineProperty;var d=Object.getOwnPropertyDescriptor;var l=Object.getOwnPropertyNames;var c=Object.prototype.hasOwnProperty;var u=(n,e)=>{for(var t in e)s(n,t,{get:e[t],enumerable:!0})},m=(n,e,t,o)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of l(e))!c.call(n,r)&&r!==t&&s(n,r,{get:()=>e[r],enumerable:!(o=d(e,r))||o.enumerable});return n};var p=n=>m(s({},"__esModule",{value:!0}),n);var y={};u(y,{EnviarResponderModule:()=>a,register:()=>f});var i=class{container=null;constructor(){}async render(){let e=document.createElement("div");return e.className="flex flex-col gap-3",this.container=e,e.innerHTML=`
      <div class="glass-subtle rounded-xl p-3">
        <div class="text-sm font-semibold text-foreground">Responder</div>
        <div class="text-xs text-muted-foreground mt-1">
          Mock: aqui ficar\xE1 o fluxo de responder (com aprova\xE7\xE3o humana).
        </div>
      </div>

      <button
        type="button"
        class="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        disabled
      >
        Enviar (mock)
      </button>
    `,e}destroy(){this.container&&(this.container.innerHTML=""),this.container=null}};var v=async(n,e)=>{let t=new i;return{async render(){let o=await t.render();n.appendChild(o)},destroy(){t.destroy(),n&&(n.innerHTML="")}}},a={id:"marketing.enviar.responder",name:"Responder",parent:"marketing.enviar",icon:"\u{1F4AC}",dependencies:[],panelFactory:v,lazy:!0};function f(n){n.register(a)}return p(y);})();

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
      if (!moduleDef && typeof MettriModule_marketing_enviar_responder !== 'undefined') {
        if (MettriModule_marketing_enviar_responder.module) {
          moduleDef = MettriModule_marketing_enviar_responder.module;
        } else if (MettriModule_marketing_enviar_responder.id) {
          moduleDef = MettriModule_marketing_enviar_responder;
        }
      }
      if (moduleDef && moduleDef.id) {
        register(moduleDef);
      }
    }
    // Export to global for fallback access
    if (typeof window !== 'undefined') {
      window.MettriModule_marketing_enviar_responder = typeof MettriModule_marketing_enviar_responder !== 'undefined' ? MettriModule_marketing_enviar_responder : null;
    }
  } catch (e) {
    console.warn('[ModuleLoader] Error auto-registering module:', e);
  }
})();

