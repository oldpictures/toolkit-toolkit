/* Common Genius API error handling. Empty `errors: []` is not a failure. */
(() => {
 'use strict';
 function present(value){
  if(value==null||value===false)return false;
  if(typeof value==='string')return value.trim().length>0;
  if(Array.isArray(value))return value.some(present);
  if(typeof value==='object')return Object.values(value).some(present);
  return Boolean(value);
 }
 function hasErrors(payload){
  return Number(payload?.meta?.status)>=400||present(payload?.error)||present(payload?.errors);
 }
 globalThis.GeniusToolkitApiErrors={present,hasErrors};
})();
