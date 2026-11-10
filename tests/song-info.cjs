const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const sharedArt=fs.readFileSync(require('node:path').join(__dirname,'../content/artwork-utils.js'),'utf8');
const src=fs.readFileSync(path.join(__dirname,'../content/song-media.js'),'utf8');
const songArt='https://images.genius.com/song-id.600x600x1.jpg';
const albumArt='https://images.genius.com/album-id.600x600x1.jpg';
const song={id:1234,title:'Hypebeast',apple_music_id:6811734323,primary_artist:{name:'smokedope2016',apple_music_id:1616723183},album:{name:'THE COMEUP',cover_art_url:albumArt},song_art_image_url:songArt};
const document={
 querySelectorAll(query){if(query.includes('meta[content^='))return [{content:'genius://songs/1234'}];return [];},
 querySelector(){return null;},getElementById(){return null;},documentElement:{}
};
const globalThis={};
const sandbox={document,globalThis,location:{pathname:'/Smokedope2016-hypebeast-lyrics'},window:{addEventListener(){}},
 MutationObserver:class{observe(){}},setTimeout(){},clearTimeout(){},fetch:async()=>({ok:true,json:async()=>({response:{song}})}),
 AbortController,URL};
vm.runInNewContext(sharedArt,sandbox);
vm.runInNewContext(src,sandbox);
(async()=>{
 const t=globalThis.GeniusToolkitSongArtTests;
 const result=await t.fromGenius();
 assert.equal(result.title,'Hypebeast');
 assert.equal(result.artist,'smokedope2016');
 assert.equal(result.appleArtistId,'1616723183');
 assert.equal(result.appleId,'6811734323');
 assert.equal(result.geniusArtwork,'https://images.genius.com/song-id.1000x1000x1.jpg');
 assert.equal(t.standaloneGeniusArt({...song,song_art_image_url:albumArt}),null);
 assert.equal(t.standaloneGeniusArt({...song,album:{name:'THE COMEUP'}}),null);
 assert.equal(t.standaloneGeniusArt({...song,song_art_image_url:'https://untrusted.example/image.jpg'}),null);
 console.log('song metadata tests passed (artist/apple ids, verified Genius song art, album-art suppression, URL safety)');
})().catch(e=>{console.error(e);process.exitCode=1});
