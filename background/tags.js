/* Independent read-only tag-source loader. Never submits data to Genius.
 * The source is the exact, user-supplied Google Sheet (gid=0).
 */
(() => {
  'use strict';
  const ID='1lTGIoizY0MfGXsPnErK-cFxmdf25PjnWKexhBq_KF0Y';
  const KEY='gt-approved-tags-source-v1';
  const URLS=[
    `https://docs.google.com/spreadsheets/d/${ID}/export?format=csv&gid=0`,
    `https://docs.google.com/spreadsheets/d/${ID}/gviz/tq?tqx=out%3Acsv&gid=0`
  ];
  const MAX_SIZE=1024*1024;
  let pending=null;

  async function getSource(refresh=false) {
    const stored=(await browser.storage.local.get(KEY))[KEY];
    const validCache=stored && typeof stored.csv==='string' && stored.csv.length>20 && stored.csv.length<MAX_SIZE;
    if (!refresh && validCache && Date.now()-stored.checked<12*60*60*1000)
      return {ok:true,csv:stored.csv,updated:stored.checked,cached:true};
    let lastError='unknown error';
    for(const url of URLS) {
      try {
        const response=await fetch(url,{headers:{Accept:'text/csv,text/plain,*/*'},credentials:'omit',redirect:'follow',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(14000)});
        if(!response.ok) throw Error('http '+response.status);
        const csv=await response.text();
        if(!csv || csv.length>MAX_SIZE || /<html|<!doctype|accounts\.google\.com/i.test(csv.slice(0,600)))
          throw Error('Google returned an HTML/login page rather than CSV.');
        if(!csv.includes('\n'))throw Error('The sheet did not return a usable table.');
        const checked=Date.now();
        await browser.storage.local.set({[KEY]:{csv,checked}});
        return {ok:true,csv,updated:checked,cached:false};
      }catch(error) {lastError=error?.message||String(error);}
    }
    if(validCache) return {ok:true,csv:stored.csv,updated:stored.checked,cached:true,warning:'Could not refresh the official sheet; using the last downloaded list.'};
    return {ok:false,error:'Could not load the official tag sheet ('+lastError+'). Use Refresh official list to try again.'};
  }
  browser.runtime.onMessage.addListener(message=> {
    if(message?.scope!=='gt-approved-tags'||message?.action!=='load')return undefined;
    if(!pending || message.refresh) {
      const promise=getSource(Boolean(message.refresh));pending=promise;
      promise.finally(()=>{if(pending===promise)pending=null;});
    }
    return pending;
  });
})();
