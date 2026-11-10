/* Genius Toolkit v0.4.1: album tag editor with independent add/remove workflows. */
(() => {
  'use strict';
  const api=globalThis.GeniusToolkitTagApi;
  const normalize=api.norm;
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const make=(tag,cls='',value)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=value;return el;};
  // Strict CSV grammar, including quoted newlines, doubled quotes and BOM.
  function parseCSV(source) {
    const rows=[];let row=[],part='',quoted=false;
    const csv=String(source||'').replace(/^\ufeff/,'');
    for(let i=0;i<csv.length;i++){
      const c=csv[i];
      if(c==='"'){
        if(quoted&&csv[i+1]==='"'){part+='"';i++;}else quoted=!quoted;
      }else if(c===','&&!quoted){row.push(part);part='';}
      else if((c==='\n'||c==='\r')&&!quoted){
        if(c==='\r'&&csv[i+1]==='\n')i++;
        row.push(part);if(row.some(x=>x.trim()))rows.push(row);row=[];part='';
      }else part+=c;
    }
    if(quoted)throw Error('Malformed CSV (unclosed quotation mark).');
    row.push(part);if(row.some(x=>x.trim()))rows.push(row);
    return rows;
  }
  function parseApprovedTags(csv) {
    const rows=parseCSV(csv);
    if(rows.length<3)throw Error('This file does not contain enough rows to be an official tag list.');
    const firstRows=rows.slice(0,8);
    let col=-1, header=-1;
    for(let i=0;i<firstRows.length;i++){
      for(let j=0;j<firstRows[i].length;j++){
        const v=normalize(firstRows[i][j]);
        if(v==='name' || /^(?:approved |official |existing |genius )?(?:genre |music )?tags?(?: names?| list)?$/.test(v)){
          col=j;header=i;break;
        }
      }
      if(col>=0)break;
    }
    if(col<0){
      // Fallback for the official sheet using unlabelled columns: choose the
      // single column with the most short, plausible, distinct tag names.
      const width=Math.min(12,rows.reduce((max,row)=>Math.max(max,row.length),0));
      let bestScore=0;
      for(let j=0;j<width;j++){
        const values=rows.slice(0,700).map(row=>String(row[j]||'').trim());
        const sample=values.filter(v=>v.length>=2&&v.length<=65&&!/^(https?:|#|\d+$|\W+$)/.test(v) && !/[\n\r]/.test(v));
        const unique=new Set(sample.map(normalize));
        // Require enough data to prevent treating explanatory prose as a tag catalog.
        const score=unique.size - Math.max(0,values.length-sample.length)/2;
        if(unique.size>=8 && score>bestScore){col=j;bestScore=score;}
      }
    }
    if(col<0)throw Error('Cannot identify a tag column in the official CSV.');
    const forbidden=/^(?:approved |official |existing )?(?:tags?|genre|name|type|category|notes?|description|status|examples?|links?|id|url|genres? list|n\/a|none)$/i;
    const found=new Map();
    for(const row of rows.slice(header+1)){
      const name=String(row[col]||'').replace(/\s+/g,' ').trim();
      if(name.length<2||name.length>70||forbidden.test(name)||/^\d+\.?$/.test(name)||
          /^https?:\/\//i.test(name)||name.includes('@')||/[{}<>\[\]\n\r]/.test(name))continue;
      if(/\b(?:click here|do not|example|please|spreadsheet|these tags|use only)\b/i.test(name))continue;
      const key=normalize(name);
      if(!found.has(key))found.set(key,name);
    }
    if(found.size<8||found.size>6000)throw Error('The official CSV did not yield a reliable tag list.');
    return [...found.values()].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
  }

  function init(panel,readAlbumTracks){
    const bulk=panel.querySelector('.gt-bulk');
    const status=panel.querySelector('.gt-bulk-status');
    const source=panel.querySelector('.gt-bulk-approved-status');
    const tracksBox=panel.querySelector('.gt-bulk-tracks');
    const picker=panel.querySelector('.gt-bulk-picker-summary');
    const stop=panel.querySelector('.gt-bulk-stop');
    const results=panel.querySelector('.gt-bulk-results');
    const idStatus=panel.querySelector('.gt-tag-id-status');
    const addButton=panel.querySelector('.gt-bulk-apply');
    const removeButton=panel.querySelector('.gt-bulk-remove');
    const modes={
      add:{input:panel.querySelector('#gt-approved-tag-search'),
        options:panel.querySelector('#gt-approved-tag-options'),
        chips:panel.querySelector('.gt-bulk-selected'),
        selected:[],button:addButton},
      remove:{input:panel.querySelector('#gt-remove-tag-search'),
        options:panel.querySelector('#gt-remove-tag-options'),
        chips:panel.querySelector('.gt-remove-selected'),
        selected:[],button:removeButton}
    };
    let approvedNames=[],available=[],tracks=[],running=false,submitting=false,abort=null;
    const selectedTracks=()=>[...tracksBox.querySelectorAll('input[type="checkbox"]:checked')]
      .map(el=>tracks[Number(el.value)]).filter(Boolean);
    const approved=name=>available.some(tag=>normalize(tag.name)===normalize(name));
    const setStatus=message=>{status.textContent=message;};
    function updateButtons(){
      const eligible=available.length>0 && selectedTracks().length>0;
      const adds=modes.add.selected;
      addButton.disabled=running || submitting || !eligible || !adds.length;
      removeButton.disabled=running || !eligible || !modes.remove.selected.length;
      for(const mode of Object.values(modes)){
        mode.input.disabled=running||!available.length;
      }
      // Resolution remains mandatory, but progress is not shown in the editor.
      // Failures remain actionable through the chip's retry button and batch status.
      idStatus.textContent='';
    }
    function updateCount(){
      const linked=tracks.filter(t=>api.sameGeniusUrl(t.url)).length;
      picker.textContent=`Choose tracks (${selectedTracks().length}/${linked})`;
      updateButtons();
    }
    function loadTracks(){
      if(running)return;
      tracks=readAlbumTracks();
      tracksBox.replaceChildren();
      tracks.forEach((track,i)=>{
        const label=make('label','gt-bulk-track');
        const check=make('input');check.type='checkbox';check.value=String(i);
        check.checked=Boolean(api.sameGeniusUrl(track.url));check.disabled=!check.checked;
        check.setAttribute('aria-label', `Select ${track.title}`);
        check.addEventListener('change',()=>{label.classList.toggle('gt-track-selected',check.checked);updateCount();});
        label.classList.toggle('gt-track-selected',check.checked);
        label.append(check,make('span','',`${track.number??track.position}. ${track.title}${check.disabled?' (unlinked)':''}`));
        tracksBox.append(label);
      });
      syncTrackHighlights();
      updateCount();
    }
    function syncTrackHighlights(){
      tracksBox.querySelectorAll('.gt-bulk-track').forEach(label=>{
        label.classList.toggle('gt-track-selected',Boolean(label.querySelector('input')?.checked));
      });
    }
    function renderChips(kind){
      const mode=modes[kind];mode.chips.replaceChildren();
      for(const entry of mode.selected){
        const label=entry.name;
        const chip=make('span','gt-bulk-chip'+(entry.state==='failed'?' gt-tag-failed':''),label);
        if(kind==='add'&&entry.state==='failed'){
          const retry=make('button','gt-tag-retry','retry');retry.type='button';
          retry.setAttribute('aria-label',`Retry resolving ${entry.name}`);
          retry.addEventListener('click',()=>void resolveSelection(entry));
          chip.append(retry);
        }
        const del=make('button','gt-tag-clear','×');del.type='button';
        del.setAttribute('aria-label',`Deselect ${entry.name}`);del.title=`Deselect ${entry.name}`;
        del.disabled=running;
        del.addEventListener('click',()=>{
          if(running)return;
          mode.selected=mode.selected.filter(x=>x!==entry);
          renderChips(kind);suggest(kind);
        });
        chip.append(del);mode.chips.append(chip);
      }
      updateButtons();
    }
    async function resolveSelection(entry){
      if(!modes.add.selected.includes(entry) || running)return;
      // The ID lookup happens at tag selection time (not when Apply is clicked).
      entry.token=(entry.token||0)+1;
      const token=entry.token;
      entry.state='resolving';entry.id=null;entry.error=null;
      renderChips('add');
      try{
        const tag=await api.resolveGeniusTag(entry.name);
        if(!modes.add.selected.includes(entry)||entry.token!==token)return;
        if(!tag || normalize(tag.name)!==normalize(entry.name) || !api.positiveId(tag.id))
          throw Error('Genius returned no matching verified tag ID.');
        entry.id=api.positiveId(tag.id);entry.state='ready';
      }catch(error){
        if(!modes.add.selected.includes(entry)||entry.token!==token)return;
        entry.state='failed';entry.error=String(error.message||error);
        setStatus(`${entry.name}: ${entry.error}`);
      }
      renderChips('add');
    }
    function chooseTag(kind,tag){
      const mode=modes[kind];
      if(!approved(tag.name)||running)return;
      if(!mode.selected.some(t=>normalize(t.name)===normalize(tag.name))){
        if(mode.selected.length>=12){setStatus('Choose at most 12 tags per operation.');return;}
        const entry={name:tag.name,state:kind==='add'?'resolving':'ready',id:null};
        mode.selected.push(entry);
        if(kind==='add')entry.lookup=resolveSelection(entry);
      }
      mode.input.value='';mode.options.replaceChildren();mode.options.hidden=true;
      mode.input.setAttribute('aria-expanded','false');
      renderChips(kind);
      mode.input.focus();
    }
    function suggest(kind){
      const mode=modes[kind];mode.options.replaceChildren();
      const q=normalize(mode.input.value);
      if(q){
        const chosen=new Set(mode.selected.map(t=>normalize(t.name)));
        for(const tag of available.filter(t=>t.key.includes(q)&&!chosen.has(t.key)).slice(0,9)){
          const button=make('button','gt-bulk-suggestion',tag.name);
          button.type='button';button.setAttribute('role','option');
          button.addEventListener('mousedown',event=>event.preventDefault());
          button.addEventListener('click',()=>chooseTag(kind,tag));
          mode.options.append(button);
        }
      }
      mode.options.hidden=!mode.options.childElementCount;
      mode.input.setAttribute('aria-expanded',String(!mode.options.hidden));
    }
    function intersect(){
      available=approvedNames.map(name=>({name,key:normalize(name)}));
      for(const [kind,mode] of Object.entries(modes)){
        mode.selected=mode.selected.filter(t=>approved(t.name));
        renderChips(kind);suggest(kind);
      }
      updateButtons();
    }
    async function loadOfficial(refresh=false){
      source.dataset.error='false';source.textContent='Loading official Genius tag names…';
      for(const mode of Object.values(modes))mode.input.disabled=true;
      try{
        const sheet=await browser.runtime.sendMessage({scope:'gt-approved-tags',action:'load',refresh});
        if(!sheet?.ok)throw Error(sheet?.error||'Could not load the approved spreadsheet.');
        approvedNames=parseApprovedTags(sheet.csv);intersect();
        source.textContent=`${available.length} official tags loaded. IDs resolve as you select tags and stay cached.`+
          (sheet.cached?' (sheet cached)':'')+(sheet.warning?' '+sheet.warning:'');
      }catch(error){
        approvedNames=[];available=[];
        for(const [kind,mode] of Object.entries(modes)){mode.selected=[];renderChips(kind);}
        source.dataset.error='true';source.textContent=String(error.message||error);
      }
      updateButtons();
    }
    for(const [kind,mode] of Object.entries(modes)){
      mode.input.addEventListener('input',()=>suggest(kind));
      mode.input.addEventListener('keydown',event=>{
        if(event.key==='Escape'){
          event.preventDefault();mode.options.hidden=true;mode.input.setAttribute('aria-expanded','false');return;
        }
        if(event.key==='ArrowDown'&&!mode.options.hidden){
          event.preventDefault();mode.options.querySelector('button')?.focus();return;
        }
        if(event.key==='Enter'){
          const exact=available.find(t=>normalize(t.name)===normalize(mode.input.value));
          const first=mode.options.querySelector('button');
          const tag=exact||available.find(t=>t.name===first?.textContent);
          if(tag){event.preventDefault();chooseTag(kind,tag);}
        }
      });
      mode.options.addEventListener('keydown',event=>{
        const buttons=[...mode.options.querySelectorAll('button')];
        const i=buttons.indexOf(document.activeElement);
        if(event.key==='Escape'){event.preventDefault();mode.options.hidden=true;mode.input.setAttribute('aria-expanded','false');mode.input.focus();}
        else if(event.key==='ArrowDown'){event.preventDefault();buttons[Math.min(i+1,buttons.length-1)]?.focus();}
        else if(event.key==='ArrowUp'){event.preventDefault();if(i<=0)mode.input.focus();else buttons[i-1]?.focus();}
      });
      mode.input.addEventListener('blur',()=>setTimeout(()=>{
        if(!mode.input.contains(document.activeElement) && !mode.options.contains(document.activeElement)){
          mode.options.hidden=true;mode.input.setAttribute('aria-expanded','false');
        }
      },150));
    }
    panel.querySelector('.gt-bulk-all').addEventListener('click',()=>{
      if(running)return;
      tracksBox.querySelectorAll('input:not(:disabled)').forEach(input=>input.checked=true);
      syncTrackHighlights();updateCount();
    });
    panel.querySelector('.gt-bulk-none').addEventListener('click',()=>{
      if(running)return;
      tracksBox.querySelectorAll('input:not(:disabled)').forEach(input=>input.checked=false);
      syncTrackHighlights();updateCount();
    });
    panel.querySelector('.gt-bulk-reload').addEventListener('click',loadTracks);
    panel.querySelector('.gt-bulk-refresh-tags').addEventListener('click',()=>void loadOfficial(true));
    panel.querySelector('.gt-bulk-clear-id-cache').addEventListener('click',async()=>{
      if(running)return;
      const button=panel.querySelector('.gt-bulk-clear-id-cache');button.disabled=true;
      try{
        await api.clearCachedTags();
        for(const entry of modes.add.selected)void resolveSelection(entry);
        setStatus('Cached tag IDs cleared. Selected add-tags are being verified again.');
      }catch(error){setStatus('Could not clear cached IDs: '+String(error.message||error));}
      finally{button.disabled=false;}
    });
    bulk.addEventListener('toggle',()=>{if(bulk.open&&!tracks.length)loadTracks();});
    stop.addEventListener('click',()=>{
      abort?.abort();stop.disabled=true;setStatus('Stopping in-flight requests…');
    });
    async function runBatch(kind){
      if(running||submitting)return;
      if(!tracks.length)loadTracks();
      const selection=modes[kind].selected;
      if(!selection.length||!selectedTracks().length||!available.length){
        setStatus('Select official tags and album tracks first.');return;
      }
      if(selection.some(t=>!approved(t.name))){
        setStatus('A selected tag is not on the official list. Refresh it first.');return;
      }
      if(kind==='add'){
        // Keep submission available while selection-time lookups run. Await them
        // here, then retry failed lookups once before touching any song.
        submitting=true;updateButtons();
        try{
          setStatus('Verifying selected tags…');
          await Promise.all(selection.map(async entry=>{
            if(entry.lookup)await entry.lookup;
            if(entry.state!=='ready'||!api.positiveId(entry.id)){
              entry.lookup=resolveSelection(entry);
              await entry.lookup;
            }
          }));
          if(selection.some(t=>t.state!=='ready'||!api.positiveId(t.id))){
            setStatus('Some tag IDs could not be verified. Retry the failed tags and submit again.');
            return;
          }
        }finally{submitting=false;updateButtons();}
      }
      const seen=new Set(),items=[];
      for(const track of selectedTracks()){
        const key=api.sameGeniusUrl(track.url);
        if(!key||seen.has(key))continue;
        seen.add(key);items.push({title:track.title,url:track.url,key,song:null});
      }
      if(!items.length){setStatus('No eligible linked tracks found.');return;}
      if(items.length>75){setStatus('Select at most 75 tracks per batch.');return;}
      const tags=kind==='add'
        ?selection.map(t=>({name:t.name,id:t.id}))
        :selection.map(t=>t.name);
      running=true;abort=new AbortController();const signal=abort.signal;
      addButton.disabled=true;removeButton.disabled=true;
      for(const mode of Object.values(modes))mode.input.disabled=true;
      tracksBox.querySelectorAll('input').forEach(input=>input.disabled=true);
      stop.hidden=false;stop.disabled=false;results.replaceChildren();
      let done=0,unchanged=0,failed=0,unmatched=0;
      try{
        setStatus('Verifying song IDs before editing…');
        const resolved=await api.resolveAlbumSongs(document,items,signal,message=>setStatus(message));
        const indexed=new Map(resolved.songs.map(song=>[song.key,song]));
        for(const entry of items)entry.song=indexed.get(entry.key)||null;
        const missing=items.filter(entry=>!entry.song);
        if(missing.length){
          for(const entry of missing){
            const reason=resolved.unresolved.find(item=>item.key===entry.key)?.reason||'No verified ID';
            results.append(make('div','gt-bulk-result gt-failed',`${entry.title}: ${reason}`));
          }
          setStatus(`Could not verify ${missing.length} of ${items.length} song IDs. No tags were changed. Deselect those tracks and retry.`);
          return;
        }
        if(signal.aborted){setStatus('Stopped. No tags were changed.');return;}
        let nextIndex=0,halted=false;
        const process=async()=>{
          while(!signal.aborted&&!halted){
            const i=nextIndex++;
            if(i>=items.length)return;
            const entry=items[i];
            setStatus(`${kind==='add'?'Adding':'Removing'} tags: ${Math.min(nextIndex,items.length)}/${items.length} started; ${done} verified, ${failed} failed`);
            if(!entry.song){
              unmatched++;
              results.append(make('div','gt-bulk-result gt-failed',`${entry.title}: missing album song ID (skipped).`));
              continue;
            }
            try{
              const outcome=kind==='add'
                ?await api.applyToSong(entry.song,tags,signal)
                :await api.removeFromSong(entry.song,tags,signal);
              if(outcome.status==='done')done++;else unchanged++;
              results.append(make('div','gt-bulk-result '+(outcome.status==='done'?'gt-done':''),`${entry.title}: ${outcome.message}`));
            }catch(error){
              if(signal.aborted)return;
              failed++;
              const reason=String(error.message||error);
              results.append(make('div','gt-bulk-result gt-failed',`${entry.title}: ${reason}`));
              if([401,403,429].includes(error.status)||/CSRF|login|rate limit|within \d+ seconds/i.test(reason)){
                halted=true;
                setStatus('Batch halted due to authentication, rate limiting, or request timeout. In-flight songs may finish.');
              }
            }
          }
        };
        await Promise.all(Array.from({length:Math.min(2,items.length)},()=>process()));
        const phase=signal.aborted?'Stopped':halted?'Halted':'Finished';
        setStatus(`${phase} ${kind==='add'?'adding':'removing'} tags: ${done} verified, ${unchanged} unchanged, ${failed} failed, ${unmatched} unmatched.`);
      }catch(error){
        setStatus(`${String(error.message||error)} No additional tags were changed after this error.`);
      }finally{
        running=false;abort=null;stop.hidden=true;
        tracksBox.querySelectorAll('input').forEach(input=>{input.disabled=!api.sameGeniusUrl(tracks[Number(input.value)]?.url);});
        renderChips('add');renderChips('remove');updateButtons();
      }
    }
    addButton.addEventListener('click',()=>void runBatch('add'));
    removeButton.addEventListener('click',()=>void runBatch('remove'));
    void loadOfficial();
  }
  globalThis.GeniusToolkitAlbumTags={init,parseCSV,parseApprovedTags};
})();
