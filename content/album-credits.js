/* Genius Toolkit — role-aware credits module. Original implementation.
 * Album-scoped changes use existing, verified Genius artist ids and only the
 * selected credit field. We never generate an artist or contributor profile.
 */
(() => {
  'use strict';
  const tagApi=globalThis.GeniusToolkitTagApi;
  // Exact role labels extracted from the user-provided Genius Standardized Additional Roles guide.
  // Section headings, aliases, navigation, deprecated roles and notes are excluded.
  const ROLE_CATALOG=["Producer","Writer","Adaptation","Book Writer","Composer","Copyist","Librettist","Lyricist","Lyrics Adaptation","Melody Adaptation","Musical Assistance","Translator","Arranger","Assistant Arranger","Background Vocal Arranger","Bass Arranger","Brass Arranger","Celesta Arranger","Chant Arranger","Choir Arranger","Chorus Arranger","Clarinet Arranger","Drum Arranger","Flute Arranger","Flugelhorn Arranger","Guitar Arranger","Horns Arranger","Instruments Arranger","Keyboards Arranger","Lute Arranger","Mandolin Arranger","Organ Arranger","Orchestra Arranger","Percussion Arranger","Piano Arranger","Recording Arranger","Rhythm Arranger","Sample Arranger","Saxophone Arranger","Shakuhachi Arranger","Strings Arranger","Synthesizer Arranger","Theorbo Arranger","Trumpet Arranger","Violin Arranger","Vocal Arranger","Wind Arranger","Woodwind Arranger","Assistant Executive Producer","Assistant Post Producer","Assistant Pre-Producer","Assistant Producer","Associate Producer","Audio Production Coordinator","Audio Supervisor","Beatmaker","Co-Producer","Concert Producer","Creative Consultant","Creative Director","Executive Producer","Pre-Producer","Production Coordinator (Management)","Production Director (Management)","Production Manager (Management)","Reissue Producer","Remixer","Sequencing","Vocal Producer","Assistant Programmer","Bass Programmer","Drum Machine Programmer","Drum Programmer","Fairlight CMI Programmer","Guitar Programmer","Keyboard Programmer","MIDI Programmer","Percussion Programmer","Programmer","Rhythm Programmer","Sample Programmer","Saxophone Programmer","String Programmer","Synthesizer Programmer","Vocal Programmer","Amplifier Technician","Assistant Audio Editor","Assistant Digital Audio Editor","Assistant Engineer","Assistant Immersive Engineer","Assistant Immersive Mixing Engineer","Assistant Mastering Engineer","Assistant Mixing Engineer","Assistant Overdub Recording Engineer","Assistant Recording Engineer","Assistant Remastering Engineer","Assistant Remixer","Assistant Technician","Assistant Vocal Engineer","Audio Editor","Audio Restoration","Bass Technician","Cuts","DAW Systems Engineer","Digital Audio Editor","Direct Metal Mastering Engineer","Dolby Atmos Mastering","Drum Editor","Drum Samples","Drum Sequencing","Drum Technician","Engineer","Guitar Samples","Guitar Sequencing","Guitar Technician","Immersive Engineer","Immersive Mastering Engineer","Immersive Mixing Engineer","Immersive Recording Engineer","Keyboards Technician","Lacquer Cut Engineer","Loops","Mastering Engineer","Mixing Engineer","Overdub Editor","Overdub Recording Engineer","Plating Engineer","Post Engineer","Post Mixing Engineer","Post Producer","Pre-Mastering Engineer","Pre-Mixing Engineer","Premix Editor","Preparer","Recording Engineer","Recording Technician","Remastering Engineer","Sample Clearance","Sampling","Sound Designer","Sound Processing Computer Specialist","Spatial Mastering Engineer","Spatial Mixing Engineer","Tape Loops","Tape Operator","Technician","Transfer Engineer","Vinyl Mastering","Vocal Director","Vocal Editor","Vocal Effects","Vocal Engineer","Vocal Mixing Engineer","Vocal Tuner","Ad-Libs","Alto Vocals","Background Chant","Background Vocals","Baritone Vocals","Bass Vocals","Bass-Baritone Vocals","Beatbox","Caller","Chant","Chorus Vocals","Clean Vocals","Contralto Vocals","Coro","Countertenor Vocals","Dialogue","Grunts","Harsh Vocals","Harmony Vocals","Humming","Lead Vocals","MC","Mezzo-Soprano Vocals","Overtone Voice","Scat","Soprano Vocals","Speaking Voice","Speech","Spoken Word","Tenor Vocals","Throat Singing","Vocal Coach","Vocal Samples","Vocalese","Vocals","Voice Samples","Voice-Over","Voicemail","Whistling","Yodeling","Copyright ©","Distributor","Label","Manufacturer","Phonographic Copyright ℗","Publisher","Reissue Label","Audio Edited At","Engineered At","Glass Mastered At","Lacquer Cut At","Mastered At","Mixed At","Overdubbed At","Presented At","Produced At","Remastered At","Remixed At","Art Concept","Art Direction","Artwork","Artwork 3D Rendering","Artwork Animation","Artwork Body Paint Artist","Artwork Editor","Artwork Hair Stylist","Artwork Makeup Artist","Artwork Nail Technician","Artwork Tattoo Artist","Artwork Wardrobe Stylist","Assistant Artwork Hair Stylist","Assistant Artwork Makeup Artist","Assistant Artwork Wardrobe Stylist","Booklet Designer","Booklet Illustration","Calligraphy","Engraving (Artwork)","Graphic Design","Illustration","Image Editor","Layout","Liner Notes","Painting","Photography","Photography Concept","Photography Editor","Reissue Artwork","Reissue Graphic Design","Sculpture (Artwork)","Typography","Video 1st Assistant Director","Video 2nd Assistant Director","Video 3D Rendering","Video 3D Team","Video Animator","Video Art Department","Video Art Director","Video Art Production Assistant","Video Art Production Designer","Video Assist Operator","Video Assistant Director","Video Assistant Editor","Video Assistant Hair Stylist","Video Assistant Makeup Artist","Video Assistant Prop Master","Video Assistant Wardrobe Stylist","Video Associate Producer","Video Best Boy","Video Best Boy Electric","Video Best Boy Grip","Video Body Paint Artist","Video Boom Operator","Video Camera Crew","Video Camera Operator","Video Casting Director","Video Casting Team","Video CGI Artist","Video Choreographer","Video Clapper Loader","Video Co-Director","Video Co-Producer","Video Colorist","Video Commissioner","Video Compositor","Video Concept Illustrator","Video Construction Coordinator","Video Costume Department","Video Costume Designer","Video Craft Service","Video Digital Imaging Technician","Video Director","Video Director Of Photography","Video Dolly Grip","Video Driver","Video Drone Operator","Video Editor","Video Electrician","Video Executive Producer","Video Focus Puller","Video Foley Artist","Video Gaffer","Video Generator Operator","Video Graphic Designer","Video Grip","Video Hair Stylist","Video Key Grip","Video Key Production Assistant","Video Lightboard Operator","Video Lighting","Video Lighting Technician","Video Line Producer","Video Location Manager","Video Location Scout","Video Makeup Artist","Video Matte Painter","Video Motion Graphics Artist","Video Music Supervisor","Video Nail Technician","Video Office Production Assistant","Video On-Set Editor","Video Post-Production Coordinator","Video Post-Production Department","Video Post-Production Supervisor","Video Producer","Video Production Accountant","Video Production Assistant","Video Production Company","Video Production Coordinator","Video Production Designer","Video Production Director","Video Production Supervisor","Video Production Team","Video Prop Department","Video Prop Master","Video Re-Recording Mixer","Video Roto/Paint Artist","Video Screenwriter","Video Script Supervisor","Video Set Decorator","Video Set Department","Video Set Dresser","Video Set Medic","Video Set Photographer","Video Set Production Assistant","Video SFX Department","Video SFX Makeup Designer","Video SFX Supervisor","Video Shopper","Video Sound Assistant","Video Sound Designer","Video Sound Editor","Video Sound Engineer","Video Sound Mixer","Video Steadicam Operator","Video Storyboard Artist","Video Stunt Coordinator","Video Supervising Editor","Video Tailor","Video Tattoo Artist","Video Technician","Video Transport Captain","Video Transportation Coordinator","Video Typography","Video Unit Production Manager","Video Unit Publicist","Video VFX Artist","Video VFX Department","Video VFX Supervisor","Video Visualizer","Video Wardrobe Stylist","Video Weapons Wrangler","Associate Conductor","Brass Conductor","Brass Orchestration","Choir","Choir Conductor","Choir Director","Choir Leader","Choir Orchestration","Choir Programmer","Choirmaster","Chorus Master","Concertmaster","Conductor","Contractor","Ensemble","Horns Conductor","Horns Leader","Horns Orchestration","Instrumentation","Music Librarian","Orchestra","Orchestra Coordinator","Orchestra Director","Orchestra Manager","Orchestration","String Orchestra","Strings Conductor","Strings Coordinator","Strings Director","Strings Editor","Strings Orchestration","Strings Supervisor","Worship Leader","3D Rendering","A&R","A&R Administrator","A&R Coordinator","A&R Director","A&R Manager","Accompaniment","Agent","Agent Assistant","Assistant A&R","Backing Band","Band Leader","Commentator","Compiler","Coordinator","Copywriter","Curator","DJ","DJ Mix","Field Recording","Game Developer","Game Franchise","Game Publisher","Group Members","Host","Instrumental Coordinator","Interviewee","Interviewer","Legal","Literary Editor","Marching Band","Music Commissioner","Music Consultant","Music Director","Music Production Coordinator","Music Production Director","Music Production Manager","Musical Supervision","Narrator","Official Lyrics Explanation","Parent Group","Presenter","Project Coordinator","Project Manager","Promoter","Proofreader","Public Relations","Reader (Literary)","Restoration","Screen Director","Stage Manager","Tie-In","Transcription (Notation)","Acoustic Guitar Solo","Alto Saxophone Solo","Bass Guitar Solo","Bass Solo","Cavaquinho Solo","Cello Solo","Double Bass Solo","Duduk Solo","Electric Guitar Solo","Flugelhorn Solo","Flute Solo","Grand Piano Solo","Guitar Solo","Gut String Guitar Solo","Harmonica Solo","Keyboard Solo","Organ Solo","Piano Solo","Saxophone Solo","Slide Guitar Solo","Soloist","Soprano Saxophone Solo","Synthesizer Solo","Tenor Saxophone Solo","Tin Whistle Solo","Trombone Solo","Trumpet Solo","Ukulele Solo","Viola Solo","Violin Solo","Vocal Solo","Ace Tone Organ","Akai EWI","Akai MPC","Akai MPC1000 Sequencer/Sampler","Akai MPC2000 Sequencer/Sampler","Akai MPC2000XL Sequencer/Sampler","Akai MPC2500 Sequencer/Sampler","Akai MPC60 Sequencer/Sampler","Akai S900 Sampler","Akai S3000 Sampler","Arco Bass Guitar","ARP 2600 Synthesizer","ARP Avatar Synthesizer","ARP Odyssey Synthesizer","ARP Quartet Synthesizer","ARP Solina String Ensemble Synthesizer","ARP Synthesizer","AudioFrame Sampler","Baldwin Fun Machine Organ/Synthesizer","Baldwin SD-10 Grand Piano","BINA Indian Harmonium","Bontempi Electric Organ","Casio SK-1 Sampling Keyboard","Casio VL-TONE Synthesizer","Cavagnolo MIDY 20 MIDI Controller","Chamberlain Synthesizer","Critter and Guitari Bolsa Bass Synthesizer","Crumar DP-50 Electric Piano","Crumar Stringman Synthesizer","Crumar Synthesizer","Dynacord ADD-one Drum Machine","E-mu Emulator II Synthesizer","E-mu Emulator Synthesizer","Electro-Harmonix Super Space Drum","Electronic Tambura","Elektron Octatrack Sampler","Elka AMK 800 MIDI Controller","Elka Rhapsody Synthesizer","Elka Synthex Synthesizer","EML Synthesizer","EML ElectroComp 101 Synthesizer","EML ElectroComp 200 Synthesizer","EMS Synthi AKS Synthesizer","EMS VCS 3 Synthesizer","Ensoniq EPS Sampler","Ensoniq ESQ-1 Synthesizer","Eventide H910 Harmonizer Synthesizer","Fairlight CMI","Fairlight CMI Series II","Fairlight CMI Series III","Farfisa Matador Organ","Farfisa Organ","Fender Bass Guitar","Fender Guitar","Fender Mandocaster Electric Mandolin","Fender Telecaster Guitar","Fender VI Bass Guitar","Hammond A100 Organ","Hammond B-3 Organ","Hammond C-3 Organ","Hammond Electric Organ","Hammond Organ","Hammond Sk-1 Keyboard","HAPI Drum","Hofner Guitar","Hohner Basset Synthesizer","Hohner Cembalet I Electric Piano","Hohner Clavinet I","Hohner Electra Piano T Electric Piano","Hohner Pianet L Electric Piano","Hohner Symphonic 30N Electric Organ","Kawai K5 Synthesizer","Korg Kronos Synthesizer","Korg M1 Synthesizer","Korg microKORG Synthesizer","Korg miniKORG Synthesizer","Korg MS-20 Synthesizer","Korg Pepe MIDI Wind Controller","Korg Polysix Synthesizer","Korg Synthesizer","Korg Triton Synthesizer","Korg Wavestation Synthesizer","Kurzweil K2000 Synthesizer","Lowrey Organ","Moog Liberation Synthesizer","Moog Minimoog Synthesizer","Moog Minimoog Voyager Synthesizer","Moog Polymoog Synthesizer","Moog Prodigy Synthesizer","Moog Rogue Synthesizer","Moog Synthesizer","Moog Synthesizer Programmer","Moog Taurus Synthesizer","Nord Electro Synthesizer","Nord Lead Synthesizer","Nord Piano Synthesizer","Nord Wave Synthesizer","Northumbrian Smallpipes","Oberheim Sequencer","Oberheim Synthesizer","Optigan Organ","OSC OSCar Synthesizer","Prophet-5 Synthesizer","Prophet-6 Synthesizer","Rhodes Piano","RMI Electra-Piano","Roland BOSS HC-2 Hand Clapper","Roland D-50 Synthesizer","Roland D-550 Synthesizer","Roland Drum Machine","Roland JD-990 Synthesizer","Roland JUNO-106 Synthesizer","Roland JUNO-6 Synthesizer","Roland JUNO-60 Synthesizer","Roland JUNO-Di Synthesizer","Roland JUPITER-6 Synthesizer","Roland JUPITER-8 Synthesizer","Roland JX-3P Synthesizer","Roland OCTAPAD Percussion Pad","Roland R-70 Drum Machine","Roland SH-101 Synthesizer","Roland Space Echo","Roland Synthesizer","Roland System-100M Synthesizer","Roland TR-606 Drum Machine","Roland TR-808 Drum Machine","Roland V-Drums","Simmons SDX Electronic Drums","Steinberger Guitar","Suzuki MX-32C Alto Melodeon","Synclavier Synthesizer","Teenage Engineering OP-1 Synthesizer","Vox Continental Organ","Vox Jaguar Organ","Vox Organ","Wurlitzer Electric Piano","Wurlitzer Organ","Yamaha B3 Upright Piano","Yamaha CS-10 Synthesizer","Yamaha CS-15 Synthesizer","Yamaha CS1x Synthesizer","Yamaha CS-60 Synthesizer","Yamaha CS-80 Synthesizer","Yamaha DTXPLORER Electronic Drums","Yamaha DX7 Synthesizer","Yamaha GX-1 Synthesizer Organ","Yamaha Organ","Yamaha PSR-70 Electronic Keyboard","Yamaha Synthesizer","Yamaha VSS-200 Synthesizer","4.5 Octave Marimba","5.0 Octave Marimba","3.5 Octave Vibraphone","4.0 Octave Vibraphone","Accordina","Accordion","Acoustic Baritone Guitar","Acoustic Bass","Acoustic Bass Guitar","Acoustic Double Bass","Acoustic Drums","Acoustic Guitar","Acoustic Lead Guitar","Acoustic Rhythm Guitar","Acoustic Slide Guitar","Acoustic Steel Guitar","Aerophone","Afoxé","Agogô","Ajaeng","Alfaia","Alghoza","Alphorn","Alto Chalumeau","Alto Clarinet","Alto Cornamuse","Alto Cornett","Alto Crumhorn","Alto Flute","Alto Gemshorn","Alto Horn","Alto Hurdy-Gurdy","Alto Melodeon","Alto Rauschpfeife","Alto Recorder","Alto Sackbut","Alto Saxophone","Alto Shawm","Alto Sopilka","Alto Trombone","Alto Viol","Alto Viola","Alto Violin","Amadinda","Ambient Sounds","Analog Synthesizer","Analog Vocoder","Angklung","Anglo Concertina","Antara","Anvil","Appalachian Dulcimer","Arch Harp Guitar","Archlute","Arghul","Arpa Legüera","Arpeggiator","Ashiko","Atabaque","Autoharp","Baby Piano","Bağlama","Bagpipes","Bahian Guitar","Bajo Quinto","Bajo Sexto","Balaban","Balafon","Balalaika","Bamboo Flute","Bamboo Saxophone","Bandola","Bandora","Bandolin","Bandoneón","Bandura","Bandurria","Banjo","Banjo Guitar","Banjo Ukulele","Banjola","Bansuri","Baritone Guitar","Baritone Horn","Baritone Sarrusophone","Baritone Saxophone","Baritone Ukelele","Baroque Guitar","Baroque Rackett","Baroque Trumpet","Barrel Organ","Baryton","Basolia","Bass","Bass Accordion","Bass Balalaika","Bass Chalumeau","Bass Clarinet","Bass Courtaut","Bass Crumhorn","Bass Curtal","Bass Drum","Bass Dulcian","Bass Flute","Bass Guitar","Bass Harmonica","Bass Hurdy-Gurdy","Bass Kortholt","Bass Marimba","Bass Melodeon","Bass Oboe","Bass Pedals","Bass Rackett","Bass Rebec","Bass Recorder (Woodwind)","Bass Sackbut","Bass Sarrusophone","Bass Saxophone","Bass Shawm","Bass Sordun","Bass Synthesizer","Bass Trombone","Bass Trumpet","Bass Tuba","Bass Viol","Bass Violin","Basset Clarinet","Basset Horn","Bassoon","Batá Drum","Bawu","Bayan","Bazooka","Beat Juggling","Beatwave","Bell Tree","Bells","Bendir","Berimbau","Bhapang","Biniou","Birbynė","Birch Lur","Bladder Pipe","Boatswain's Pipe","Bodhrán","Body Percussion","Bombard","Bombo Legüero","Bonang Barung","Bones","Bongos","Boobam","Boomwhacker","Bougarabou","Bouzouki","Bowed Banjo","Bowed Bass","Bowed Cymbal","Bowed Dulcimer","Bowed Guitar","Bowed Vibraphone","Brass","Brass Bass","Brass Section","Brass Synthesizer","Bronze Lur","Brushed Cymbal","Brushed Snare Drum","Brushes","Bugle","Buisine","Buk","Bulbul Tarang","Bullroarer","Button Accordion","Buzuk","C Melody Saxophone","Cabasa","Cabrette","Çağlama","Caixa","Caja Vallenata","Cajón","Calabash","Calliope","Cántaro","Carillon","Carnyx","Castanets","Cavaquinho","Caxixi","Celesta","Cello","Cello Da Spalla","Celtic Harp","Cembalet","Ceterone","Chácaras","Chak'chas","Chalumeau","Chamber Organ","Chamberlin","Chapman Stick","Charango","Chimes","Chin-Cello","Ching-Dong","Chirimía","Chord Harmonica","Chromatic Button Accordion","Chromatic Harmonica","Çifteli","Cigar Box Guitar","Cimbalom","Cimbasso","Cimpoi","Cittern","Clapsticks","Clarinet","Clarion","Clàrsach","Clash Cymbals","Classical Guitar","Claves","Clavichord","Clavicytherium","Clavinet","Claviola","Clavioline","Claviorgan","Cò Ke","Comb","Computer","Concertina","Conch","Công","Congas","Contra-Alto Clarinet","Contrabass Banjo","Contrabass Clarinet","Contrabass Flute","Contrabass Recorder","Contrabass Sarrusophone","Contrabass Saxophone","Contrabass Trombone","Contrabassoon","Cornamuse","Cornemuse du Centre","Cornet","Cornett","Cornettino","Cowbell","Cowhorn","Craviola","Cretan Lyra","Cristal Baschet","Crotales","Crumhorn","Crwth","Cuatro","Cuatro Puertorriqueño","Cuíca","Cultrum","Cümbüş","Cura","Cymbal","D Trumpet","Daegeum","Daf","Đàn Bầu","Đàn Nhị","Đàn Nguyệt","Đàn Tam Thập Lục","Đàn Tranh","Đàn Tứ","Đàn Tỳ Bà","Danso","Darbuka","Davul","Delay Pedal","Dhol","Dholak","Diatonic Harmonica","Didgeridoo","Dikanza","Dilruba","Đing Buốt","Đing Năm","Đing Tăc Ta","Distortion Pedal","Dizi","Djembe","Dobro","Dohulla","Doira","Dojo","Dombra","Domra","Double Bass","Dramyin","Drone Pedal","Drum","Drum Fills","Drum Line","Drum Loops","Drum Machine","Drum Pad","Drum Synthesizer","Drums","Drymba","Duck Call","Dūdmaišis","Duduk","Dudy","Dudy Podhalańskie","Dudy Wielkopolskie","Dulcian","Dulcimer","Dulcitone","Dulzaina","Dunun","Dvoyanka","E-Bow","Echo Pedal","Effects Pedal","Eight-String Bass","Electric Autoharp","Electric Baritone Guitar","Electric Bass","Electric Bass Clarinet","Electric Bass Guitar","Electric Bass Trombone","Electric Cello","Electric Guitar","Electric Harmonium","Electric Harp","Electric Harpsichord","Electric Hurdy-Gurdy","Electric Lap Steel Guitar","Electric Mandolin","Electric Marimba","Electric Organ","Electric Piano","Electric Rothphone","Electric Saxophone","Electric Saz","Electric Sitar","Electric Slide Guitar","Electric Soprano Saxophone","Electric Trumpet","Electric Ukulele","Electric Upright Bass","Electric Viola","Electric Violin","Electronic Drums","Electronic Percussion","Electronics","Engalabi","English Concertina","English Flagolet","English Horn","Erhu","Esraj","Euphonium","EWI","Feedback Pedal","Fiddle","Fife","Finger Snaps","First Violin","Fiscorn","Five-String Banjo","Five-String Bass","Five-String Violin","Flabiol","Flageolet","Flamenco Guitar","Flanger Pedal","Flexatone","Floor Tom","Flugabone","Flugelhorn","Fluier","Flumpet","Flute","Flûte D'amour","Flutina","Foot Stomping","Footbass","Fortepiano","Frame Drum","French Horn","Fretless Bass Guitar","Fretless Guitar","Friction Drum","Frottoir","Frula","Fujara","Fuzz Pedal","Gadulka","Gaida","Gaita Asturiana","Gaita De Boto","Gaita Gallega","Gaita Sanabresa","Gajdy","Gambang","Gamelan","Ganzá","Garklein Recorder","Garmon","Gayageum","Gemshorn","Gendèr","Gendèr Barung","Gendèr Panembung","Gendèr Panerus","Gendèr Wayang","Geomungo","German Concertina","Ghatam","Ghaychak","Ghungroo","Gittern","Gizmotron","Glass Harmonica","Glass Harp","Glockenspiel","Goat Horn","Goblet Drum","Gong","Gong Chime","Gralla","Grand Piano","Great-Bass Rackett","Great-Bass Recorder","Great Highland Bagpipe","Guacharaca","Güira","Güiro","Guitalele","Guitar","Guitar Fills","Guitar Loops","Guitar Synthesizer","Guitar Zither","Guitaret","Guitarra de Canya","Guitarra Morisca","Guitarro","Guitarrón","GuitarViol","Guitorgan","Gürio","Gusle","Gusli","Gut String Acoustic Guitar","Gut String Guitar","Gutbucket","Guzheng","Gyil","Haegeum","Halldorophone","Hammered Dulcimer","Hand Drums","Hand-Repique","Handbell","Handclaps","Handpan","Hang","Hardanger Fiddle","Härjedalspipa","Harmonica","Harmonium","Harp","Harp Synthesizer","Harpejji","Harpsichord","Hawaiian Guitar","Heckelphone","Helicon","Hi-hat","Hichiriki","High Strung Acoustic Guitar","High Strung Electric Guitar","High Strung Guitar","Hmông Flute","Horns","Hotchiku","Hue Puruhau","Hue Puruwai","Hulusi","Hümmelchen","Hurdy-Gurdy","Idiophone","Indian Harmonium","Instruments","Irish Bouzouki","Irish Dance","Irish Flute","Jaggo","Janggu","Jarana","Jawbone","Jew's Harp","Joze","Jug","K'lông Pút","Kabosy","Kagurabue","Kalimba","Kamancheh","Kanjira","Kantele","Kanun","Kaval","Kawala","Kazoo","Kemenche","Kempul","Kèn Bầu","Kèn Lá","Kendang","Keyboard Glockenspiel","Keyboards","Keytar","Khèn Mèo","Khene","Khishba","Khlui","Ki Pah","Kick Drum","Kithara","Kkwaenggwari","Klong Khaek","Kōauau","Kōauau Ponga Ihu","Kobyz","Kokle","Kokyū","Kolintang","Komuz","Kora","Kortholt","Koto","Koza (Ukrainian Bagpipe)","Kozioł","Krakeb","Kravik Lyre","Kulintang","Laouto","Lap Steel Guitar","Laúd","Launeddas","Lead Guitar","Limbe","Lion's Roar","Loriman Pipe","Low Whistle","Lumatone","Lur","Lute","Luthéal","Lyre","Lyricon","Madal","Magyar Duda","Mallets","Mando Guitar","Mandobass","Mandocello","Mandola","Mandolin","Mandora","Maracas","Mariachi Guitar","Mariachis","Marimba","Marímbula","Mark Tree","Marxophone","Mashak","Mbira","Megaphone","Mellophone","Mellotron","Mellotron Flute","Melodeon","Melodica","Melodion","Melophone","Metallophone","Metronome","Mey","MIDI Controller","Mijwiz","Mizmar","Mizwad","Mô","Moraharpa","Morin Khuur","Morsing","Mouth Organ","Mridangam","Murchunga","Musette","Musette de Cour","Music Box","Musical Bow","Musical Leaf","Musical Saw","Nakers","Não Bạt","Native American Flute","Natural Horn","Natural Trumpet","Ney","Ney-Anbān","Ngoni","Nguru","Noises","Nose Flute","Nyckelharpa","Nylon String Acoustic Bass Guitar","Nylon String Acoustic Guitar","Nylon String Guitar","Oboe","Ocarina","Octave Electric Guitar","Octave Harmonica","Octave Mandolin","Octave Viola","Octoban","Octophone","Odaiko","Olifant","Omnichord","Ondes Martenot","Ondioline","Organ","Orpharion","Oscillator","Oud","Outi","Pads","Pakhavaj","Pan Flute","Pandeiro","Pandeirola","Pang Gu Ly Hu Hmông","Paraguayan Harp","Paranku","Parlor Piano","Pedabro","Pedal Harp","Pedal Steel Guitar","Pedalboard","Pedals","Percussion","Phách","Phaser Pedal","Philicorda","Phin","Piano","Piano Accordion","Pibgorn","Piccolo","Piccolo Bass","Piccolo Flute","Piccolo Trumpet","Pipa","Pipe","Pipe Organ","Pixiephone","Player Piano","Pocket Piano","Pocket Saxophone","Pocket Trumpet","Porotiti","Portative Organ","Portuguese Guitar","Positive Organ","Prempensua","Prepared Piano","Psaltery","Pump Organ","Pūkaea","Pūmotomoto","Pūpakapaka","Pūrerehua","Pūtātara","Putipù","Pūtōrino","Qanun","Qilaut","Quart-Bass Rackett","Quart-Bass Recorder","Quena","Quenacho","Quinto","Quray","Rabeca","Rackett","Rainstick","Ranat Ek","Ratchet","Rattle","Rauschpfeiffe","Ravanahatha","Rebab","Rebec","Reco-reco","Recorder (Woodwind)","Reed Organ","Reed Pipe","Reeds","Regal","Repinique","Requinto Guitar","Resonator Guitar","Reverb Pedal","Rhythm Guitar","Rhythm Section","Ride Cymbal","Riq","Rondador","Rōria","Rothphone","Rototom","Ruan","Rubab","Rubber Bridge Acoustic Guitar","Rubber Bridge Baritone Guitar","Rubber Bridge Guitar","Sabar","Sackbut","Sampler","Sanshin","Sansula","Santoor","Santur","Sanxian","Sáo Mèo","Sáo Ôi","Sarangi","Sarod","Sarrusophone","Sáo Trúc","Saw U","Saxello","Saxhorn","Saxophone","Saz","Sazbüş","Scratches","Second Violin","Sequencer","Serpent","Setar","Seven-String Acoustic Guitar","Shaker","Shakuhachi","Shamisen","Shawm","Shehnai","Shekere","Sheng","Shinobue","Shō","Shofar","Shruti Box","Shudraga","Shvi","Siku","Simsimiyya","Singing Bowl","Sinh Tiên","Sintir","Siren","Sistrum","Sitar","Six-String Bass","Six-String Bass Guitar","Six-String Guitar","Six-String Electric Guitar","Slapstick","Sleigh Bells","Slentho","Slide Guitar","Slide Saxophone","Slide Trumpet","Slide Whistle","Slit Drum","Snare Drum","Song Loan (Percussion)","Sopilka","Sopranino Clarinet","Sopranino Rauschpfeife","Sopranino Recorder","Sopranino Saxophone","Soprano Chalumaeu","Soprano Clarinet","Soprano Cornet","Soprano Cornamuse","Soprano Crumhorn","Soprano Curtal","Soprano Dulcian","Soprano Gemshorn","Soprano Hurdy-Gurdy","Soprano Rauschpfeife","Soprano Recorder","Soprano Sackbut","Soprano Sarrusophone","Soprano Saxophone","Soprano Shawm","Sound Effects","Soundscape","Sousaphone","Spanish Guitar","Spinet","Spoons","Spring Drum","Steel Acoustic Guitar","Steel Guitar","Steelpan","Stomp Box","String Loops","String Quartet","String Quintet","String Synthesizer","Strings","Stylophone","Sub Bass","Suka","Suling","Suona","Surdo","Swanee Whistle","Swarmandal","Symphonie","Synth Pads","Synthesizer","T'rưng","Tabla","Tabor","Tack Piano","Taepyeongso","Taiko","Taishōgoto","Talharpa","Talk Box","Talking Drum","Tam Ảm","Tam-Tam","Tambora","TamborI","Tamborim","Tambourine","Tambura","Tamburica","Tan-Tan","Tangent Piano","Tannerin","Tap Dance","Tar (Lute)","Tar Drum","Tárogató","Te Kū","Tea Chest Bass","Telenka","Temple Blocks","Tenor Banjo","Tenor Cornett","Tenor Crumhorn","Tenor Curtal","Tenor Dulcian","Tenor Flute","Tenor Gemshorn","Tenor Guitar","Tenor Hurdy-Gurdy","Tenor Kortholt","Tenor Rackett","Tenor Recorder","Tenor Rothphone","Tenor Sackbut","Tenor Sarrusophone","Tenor Saxophone","Tenor Shawm","Tenor Trombone","Tenor Viol","Tenora","Thavil","Theorbo","Theremin","Three-Hole Pipe","Timbales","Timbau","Timpani","Timple","Tin Whistle","Tiple","Tlapitzalli","Tololoche","Tom-Tom","Tombak","Torpedo","Touch Guitar","Tovshuur","Toy Accordion","Toy Drums","Toy Guitar","Toy Harp","Toy Instruments","Toy Organ","Toy Piano","Toy Saxophone","Toy Tuba","Tràm Plè","Trắng Jâu","Trắng Lu","Transverse Flute","Trautonium","Treble Rebec","Treble Viol","Trembita","Tres","Triangle","Tremolo Harmonica","Tricórdio","Trikiti","Tromba Marina","Trombone","Trompeta","Trống Bông","Trumpet","Trutruca","Tuba","Tubular Bells","Tulum","Tumbi","Tuner","Tungehorn","Tungna","Tungso","Turntables","Twelve-String Acoustic Baritone Guitar","Twelve-String Acoustic Guitar","Twelve-String Bass Guitar","Twelve-String Electric Guitar","Twelve-String Guitar","Twelve-String Slide Guitar","Txalaparta","Udu","Uilleann Pipes","Ukulele","Upright Piano","Valiha","Valve Trombone","Vibrachime","Vibrandoneon","Vibraphone","Vibraslap","Vielle","Vietnamese Guitar","Vihuela","Viol","Viola","Viola Braguesa","Viola Caipira","Violin","Violone","Virginals","Vocoder","Wadaiko","Wah-Wah Pedal","Washboard","Washtub Bass","Waterphone","Wheelharp","Whip","Whirly Tube","Whistle","White Noise Generator","Willow Flute","Wind Chime","Wind Harp","Wind Instrument","Wind Machine","Wood Block","Woodwind","Xalam","Xiao","Xylophone","Xylorimba","Yangqin","Yatga","Yoochin","Zabumba","Zhaleika","Zills","Zither","Złóbcoki","Zurna","Additional Arranger","Additional Horn Arranger","Additional Keyboards Arranger","Additional String Arranger","Additional Vocal Arranger","Additional Production","Additional Vocal Production","Additional Bass Programming","Additional Drum Programming","Additional Keyboard Programming","Additional Piano Programming","Additional Programming","Additional Rhythm Programming","Additional Synthesizer Programming","Additional Audio Editing","Additional Drum Engineering","Additional Drum Sequencing","Additional Engineering","Additional Guitar Engineering","Additional Mastering","Additional Mixing","Additional Overdubs","Additional Recording","Additional Samples","Additional Sequencer","Additional Sequencing","Additional Sound Design","Additional Strings Recording","Additional Studio Personnel","Additional Synthesizer Sequencing","Additional Vocal Editing","Additional Vocal Engineering","Additional Ad-Libs","Additional Background Vocals","Additional Chorus Vocals","Additional Speaking Voice","Additional Harsh Vocals","Additional Vocal Samples","Additional Vocals","Additional Art Direction","Additional Artwork","Additional Graphic Design","Additional Layout","Additional Photography","Additional Orchestration","Additional Acoustic Guitar","Additional Banjo","Additional Baritone Saxophone","Additional Bass","Additional Bass Guitar","Additional Bass Synthesizer","Additional Bells","Additional Brass","Additional Bouzouki","Additional Cabrette","Additional Cello","Additional Cymbal","Additional Drums","Additional Electric Guitar","Additional Electric Piano","Additional Flute","Additional Glockenspiel","Additional Guitar","Additional Handclaps","Additional Harmonica","Additional Horns","Additional Hurdy-Gurdy","Additional Instrumentation","Additional Keyboards","Additional Loops","Additional Mandolin","Additional Organ","Additional Percussion","Additional Piano","Additional Rhythm Guitar","Additional Saxophone","Additional Scratches","Additional Sound Effects","Additional Steel Guitar","Additional Strings","Additional Synthesizer","Additional Tenor Saxophone","Additional Timbales","Additional Tom-Tom","Additional Tràm Plè","Additional Trombone","Additional Trumpet","Additional Tuba","Additional Vibraphone","Additional Viola","Additional Violin","Additional Whistles"];

  const norm=x=>String(x||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
  const id=x=>{const n=Number(x);return Number.isSafeInteger(n)&&n>0?n:null;};
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};

  function normalizeRole(raw) {
    const role=String(raw||'').replace(/\s+/g,' ').trim();
    const key=role.toLocaleLowerCase();
    if(key==='producer'||key==='writer')return {type:key,label:null};
    if(!role||role.length>70||/[\u0000-\u001f<>]/.test(role))throw Error('Choose a valid credit role label.');
    return {type:'custom',label:role};
  }
  function readCredits(song) {
    if(!song || !Array.isArray(song.producer_artists) || !Array.isArray(song.writer_artists) ||
       !Array.isArray(song.custom_performances))
      throw Error('Genius did not supply all credit fields. No changes submitted.');
    for(const arr of [song.producer_artists,song.writer_artists])
      if(arr.some(a=>!id(a?.id)))throw Error('Genius returned an unrecognized credited artist.');
    for(const entry of song.custom_performances) {
      if(typeof entry?.label!=='string'||!Array.isArray(entry?.artists)||
         entry.artists.some(a=>!id(a?.id)))throw Error('Genius returned an unrecognized extra credit.');
    }
    return song;
  }
  function snapshot(song) {
    const credits=readCredits(song);
    const ids=arr=>arr.map(a=>id(a.id)).sort((a,b)=>a-b).join(',');
    return {
      producer:ids(credits.producer_artists),
      writer:ids(credits.writer_artists),
      custom:credits.custom_performances.map(e=>[norm(e.label),ids(e.artists)]).sort((a,b)=>a[0].localeCompare(b[0])),
      title:String(credits.title||''),
      tags:Array.isArray(credits.tags)?credits.tags.map(t=>id(t?.id)).sort((a,b)=>a-b).join(','):null,
      date:JSON.stringify(credits.release_date_components||credits.release_date||null)
    };
  }
  function unchangedExcept(before,after,role) {
    const a=snapshot(before),b=snapshot(after);
    if(a.title!==b.title || (a.tags!==null&&b.tags!==null&&a.tags!==b.tags) || a.date!==b.date)
      throw Error('Credits saved but unrelated song metadata also changed. Review this song.');
    if(role.type!=='producer' && a.producer!==b.producer)throw Error('Producer credits changed unexpectedly.');
    if(role.type!=='writer' && a.writer!==b.writer)throw Error('Writer credits changed unexpectedly.');
    if(role.type!=='custom' && JSON.stringify(a.custom)!==JSON.stringify(b.custom))
      throw Error('Extra credits changed unexpectedly.');
    if(role.type==='custom') {
      const others=groups=>groups.filter(group=>group[0]!==norm(role.label));
      if(JSON.stringify(others(a.custom))!==JSON.stringify(others(b.custom)))
        throw Error('An unrelated extra-credit role changed unexpectedly. Review this song.');
    }
  }
  function exactIds(song,role) {
    readCredits(song);
    if(role.type==='producer')return song.producer_artists.map(a=>id(a.id));
    if(role.type==='writer')return song.writer_artists.map(a=>id(a.id));
    return song.custom_performances.filter(e=>norm(e.label)===norm(role.label))
      .flatMap(e=>e.artists.map(a=>id(a.id)));
  }
  function mergeCredit(song,role,artists,action) {
    if(!['add','remove'].includes(action))throw Error('Invalid credit action.');
    readCredits(song);
    const desired=new Set(artists.map(a=>id(a?.id)));
    if(!desired.size||desired.has(null))throw Error('Choose existing Genius artists first.');
    const before=new Set(exactIds(song,role));
    const target=new Set(before);
    if(action==='add')for(const item of desired)target.add(item);
    else for(const item of desired)target.delete(item);
    if(target.size===before.size && [...target].every(v=>before.has(v)))
      return {changed:false,payload:null,expected:[...before].sort((a,b)=>a-b)};
    const field=role.type==='producer'?'producer_artists':role.type==='writer'?'writer_artists':'custom_performances';
    // Genius's tag editor uses {id,name}, not bare ids. The credits API is private:
    // send only the minimal identity fields from existing verified profiles.
    const named=new Map();
    for(const artist of [...song.producer_artists,...song.writer_artists,
        ...song.custom_performances.flatMap(entry=>entry.artists),...artists]) {
      const artistId=id(artist?.id);
      if(artistId&&typeof artist.name==='string'&&artist.name.trim())
        named.set(artistId,artist.name.trim());
    }
    const asArtist=artistId=>{
      const name=named.get(artistId);
      if(!name)throw Error(`A Genius artist's name is missing (id ${artistId}). No edit was made.`);
      return {id:artistId,name};
    };
    let updated;
    if(role.type!=='custom') {
      updated=[...target].map(asArtist);
    } else {
      updated=song.custom_performances
        .filter(entry=>norm(entry.label)!==norm(role.label))
        .map(entry=>({label:entry.label,artists:entry.artists.map(a=>asArtist(id(a.id)))}));
      const original=song.custom_performances.find(entry=>norm(entry.label)===norm(role.label));
      if(target.size)updated.push({label:original?.label||role.label,artists:[...target].map(asArtist)});
    }
    return {changed:true,payload:{song:{[field]:updated}},expected:[...target].sort((a,b)=>a-b)};
  }
  function csrf(){
    const cookie=(document.cookie.split(';').map(t=>t.trim()).find(t=>t.startsWith('_csrf_token='))||'').slice(12);
    const raw=cookie||document.querySelector('meta[name="csrf-token"],meta[name="csrf_token"]')?.content||'';
    if(!raw||raw.length>1024)throw Error('Genius sign-in / CSRF token unavailable. Reload your album.');
    try{return decodeURIComponent(raw);}catch{return raw;}
  }
  async function req(path,init={},signal,label='Genius request'){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort('timeout'),20000);
    const stop=()=>controller.abort('user');signal?.addEventListener('abort',stop,{once:true});
    try {
      if(signal?.aborted)throw Error('Stopped.');
      const response=await fetch(`${location.origin}/api${path}`,{
        ...init,credentials:'same-origin',redirect:'error',signal:controller.signal,
        headers:{Accept:'application/json',...(init.headers||{})}
      });
      if(!response.ok){
        const text=await response.text().catch(()=>'');
        let detail='';
        try{const json=JSON.parse(text);detail=String(json?.error||json?.message||json?.meta?.message||'');}catch{}
        detail=detail.replace(/[\r\n<>]/g,' ').replace(/\s+/g,' ').slice(0,140);
        const e=Error(`${label}: Genius returned HTTP ${response.status}${detail?` (${detail})`:''}.`);
        e.status=response.status;throw e;
      }
      const data=await response.json();
      if(globalThis.GeniusToolkitApiErrors.hasErrors(data))throw Error(`${label}: Genius rejected the request.`);
      return data;
    } catch(e){
      if(signal?.aborted)throw Error('Stopped.');
      if(controller.signal.aborted)throw Error(`${label} timed out; check the song before retrying.`);
      throw e;
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);}
  }
  async function getSong(songId,signal){
    const data=await req(`/songs/${songId}`,{},signal,'Reading song credits');
    const song=data?.response?.song;
    if(!song||id(song.id)!==songId)throw Error('Unexpected song returned by Genius.');
    return readCredits(song);
  }
  async function verifiedSongId(track,signal){
    const {songs}=await tagApi.resolveAlbumSongs(document,[track],signal);
    const key=tagApi.sameGeniusUrl(track?.url);
    const row=key&&songs.find(item=>item.key===key);
    if(!row||!id(row.id))throw Error('Song could not be verified as belonging to this album.');
    return id(row.id);
  }
  async function updateCredit(track,roleInput,artists,action,signal){
    const role=normalizeRole(roleInput),songId=await verifiedSongId(track,signal);
    const before=await getSong(songId,signal);
    const change=mergeCredit(before,role,artists,action);
    if(!change.changed)return {state:'skipped',message:'already correct'};
    if(signal?.aborted)throw Error('Stopped.');
    try{
      await req(`/songs/${songId}`,{
        method:'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf()},
        body:JSON.stringify({text_format:'html,markdown',...change.payload})
      },signal,'Saving credits');
    }catch(error){
      if(error.status>=500 && !signal?.aborted){
        // Genius occasionally returns 5xx after processing a write.
        // Read back once instead of automatically retrying a potentially committed edit.
        try{
          const observed=await getSong(songId,signal);
          if(JSON.stringify(exactIds(observed,role).sort((a,b)=>a-b))===JSON.stringify(change.expected)){
            unchangedExcept(before,observed,role);
            return {state:'done',message:'saved despite server error; verified by read-back'};
          }
        }catch(readError){
          if(/unexpectedly|unrelated/i.test(readError.message))throw readError;
        }
      }
      throw error;
    }
    const after=await getSong(songId,signal);
    const actual=exactIds(after,role).sort((a,b)=>a-b);
    if(JSON.stringify(actual)!==JSON.stringify(change.expected))
      throw Error('Genius responded but the credit change could not be verified. Review this song.');
    unchangedExcept(before,after,role);
    return {state:'done',message:'saved and verified'};
  }
  function parseSearch(data){
    const sections=data?.response?.sections;
    if(!Array.isArray(sections))throw Error('Genius returned no artist search results.');
    const seen=new Set();
    return sections.flatMap(section=>Array.isArray(section?.hits)?section.hits.map(hit=>({hit,section})):[])
      .filter(({hit,section})=>hit?.type==='artist' || (section?.type==='artist'&&hit?.type!=='song'))
      .map(({hit})=>hit.result)
      .filter(artist=>{
        const artistId=id(artist?.id), url=String(artist?.url||'');
        if(!artistId||!artist?.name||seen.has(artistId)||!/^https:\/\/genius\.com\/artists\//i.test(url))return false;
        seen.add(artistId);return true;
      })
      .slice(0,10).map(artist=>({id:id(artist.id),name:String(artist.name).slice(0,140),url:artist.url}));
  }
  async function searchArtists(query,signal){
    const data=await req('/search/multi?per_page=5&q='+encodeURIComponent(query),{},signal,'Searching artists');
    return parseSearch(data);
  }
  function init(panel,getTracks){
    const root=panel.querySelector('.gt-credits-editor');
    const tracksBox=root.querySelector('.gt-credits-tracks');
    const summary=root.querySelector('.gt-credits-tracks-heading');
    const roleSearch=root.querySelector('#gt-credit-role-search');
    const roleSuggestions=root.querySelector('.gt-credit-role-suggestions');
    const roleChips=root.querySelector('.gt-credit-role-selected');
    const search=root.querySelector('#gt-credit-artist');
    const suggestions=root.querySelector('.gt-credit-suggestions');
    const chips=root.querySelector('.gt-credit-artists');
    const addButton=root.querySelector('.gt-credits-add');
    const removeButton=root.querySelector('.gt-credits-remove');
    const stopButton=root.querySelector('.gt-credits-stop');
    const status=root.querySelector('.gt-credits-status');
    const results=root.querySelector('.gt-credits-results');
    let tracks=[],chosen=[],chosenRoles=[],working=false,controller=null,searchAbort=null,searchCount=0,searchDelay=null;
    const roleCatalog=[{value:'producer',name:'Producer'},{value:'writer',name:'Writer'},
      ...ROLE_CATALOG.filter(r=>r!=='Producer'&&r!=='Writer').map(name=>({value:name,name}))]
      .map(role=>({...role,searchKey:norm(role.name)}));
    // The bundled guide catalog is authoritative. No network fetch needed.
    const selected=()=>[...tracksBox.querySelectorAll('input:checked')]
      .map(input=>tracks[Number(input.value)]).filter(Boolean);
    const roles=()=>chosenRoles.slice();
    const showRoleOptions=()=>{roleSuggestions.hidden=false;roleSearch.setAttribute('aria-expanded','true');};
    const hideRoleOptions=()=>{roleSuggestions.hidden=true;roleSearch.setAttribute('aria-expanded','false');};
    function addRole(value){
      let role;
      try{role=normalizeRole(value);}catch(e){setStatus(e.message);return;}
      const canonical=role.type==='custom'?role.label:role.type;
      if(!chosenRoles.some(r=>norm(r)===norm(canonical)))chosenRoles.push(canonical);
      roleSearch.value='';hideRoleOptions();renderRoleChips();roleSearch.focus();
    }
    function renderRoleChips(){
      roleChips.replaceChildren();
      for(const role of chosenRoles){
        const wrapper=make('span','gt-credit-chip');
        wrapper.append(make('span','',role==='writer'?'Writer':role==='producer'?'Producer':role));
        const remove=make('button','','×');remove.type='button';
        remove.setAttribute('aria-label','Remove '+role+' role');remove.title='Remove '+role+' role';
        remove.addEventListener('click',()=>{chosenRoles=chosenRoles.filter(r=>r!==role);renderRoleChips();});
        wrapper.append(remove);roleChips.append(wrapper);
      }
      refreshControls();
    }
    function renderRoleOptions(){
      const query=norm(roleSearch.value),existing=new Set(chosenRoles.map(norm));
      const matches=roleCatalog
        .filter(x=>!existing.has(norm(x.value)))
        .filter(x=>!query || x.searchKey.includes(query))
        .sort((a,b)=>{
          if(!query)return 0;
          const pa=a.searchKey===query?0:a.searchKey.startsWith(query)?1:2;
          const pb=b.searchKey===query?0:b.searchKey.startsWith(query)?1:2;
          return pa-pb;
        })
        .slice(0,55);
      roleSuggestions.replaceChildren();
      for(const item of matches){
        const option=make('button','gt-credit-role-option',item.name);
        option.type='button';option.setAttribute('role','option');option.dataset.value=item.value;
        option.addEventListener('click',()=>addRole(item.value));
        roleSuggestions.append(option);
      }
      const raw=roleSearch.value.trim();
      if(raw && !roleCatalog.some(x=>norm(x.name)===norm(raw)) && !chosenRoles.some(x=>norm(x)===norm(raw))){
        try{normalizeRole(raw);
          const custom=make('button','gt-credit-role-option gt-credit-role-custom',`Use “${raw}” as a custom role`);
          custom.type='button';custom.setAttribute('role','option');custom.addEventListener('click',()=>addRole(raw));
          roleSuggestions.append(custom);
        }catch{}
      }
      if(!roleSuggestions.children.length)roleSuggestions.append(make('div','gt-credit-role-empty','No matching roles'));
      showRoleOptions();
    }
    roleSearch.addEventListener('focus',renderRoleOptions);
    roleSearch.addEventListener('input',renderRoleOptions);
    roleSearch.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();hideRoleOptions();return;}
      if(event.key==='ArrowDown'&&!roleSuggestions.hidden){
        event.preventDefault();roleSuggestions.querySelector('button')?.focus();
      }
      if(event.key==='Enter'){
        event.preventDefault();
        const exact=roleCatalog.find(x=>norm(x.name)===norm(roleSearch.value));
        if(exact)addRole(exact.value);
        else if(roleSearch.value.trim())addRole(roleSearch.value.trim());
      }
    });
    roleSuggestions.addEventListener('keydown',event=>{
      const buttons=[...roleSuggestions.querySelectorAll('button')];
      const i=buttons.indexOf(document.activeElement);
      if(event.key==='Escape'){event.preventDefault();hideRoleOptions();roleSearch.focus();}
      if(event.key==='ArrowDown'){event.preventDefault();buttons[Math.min(i+1,buttons.length-1)]?.focus();}
      if(event.key==='ArrowUp'){event.preventDefault();if(i<=0)roleSearch.focus();else buttons[i-1]?.focus();}
    });
    document.addEventListener('pointerdown',event=>{
      if(!root.isConnected)return;
      if(!roleSearch.contains(event.target)&&!roleSuggestions.contains(event.target))hideRoleOptions();
    });
    const setStatus=x=>{status.textContent=x;};
    const validRole=()=>{try{return roles().length>0&&roles().every(r=>{normalizeRole(r);return true;});}catch{return false;}};
    function refreshControls(){
      const enabled=!working&&selected().length>0&&chosen.length>0&&validRole();
      addButton.disabled=!enabled;removeButton.disabled=!enabled;
      roleSearch.disabled=working;search.disabled=working;
      if(working)hideRoleOptions();
    }
    function syncCount(){
      const linked=tracks.filter(t=>tagApi?.sameGeniusUrl?.(t.url)).length;
      summary.textContent=`Choose tracks (${selected().length}/${linked})`;
      refreshControls();
    }
    function loadTracks(){
      if(working)return;
      tracks=getTracks();tracksBox.replaceChildren();
      tracks.forEach((track,i)=>{
        const label=make('label','gt-credits-track');
        const checkbox=make('input');checkbox.type='checkbox';checkbox.value=String(i);
        checkbox.checked=!!tagApi?.sameGeniusUrl?.(track.url);checkbox.disabled=!checkbox.checked;
        checkbox.setAttribute('aria-label','Select '+track.title);
        const name=make('span','',`${track.number||track.position||i+1}. ${track.title}`);
        label.classList.toggle('gt-track-selected',checkbox.checked);
        checkbox.addEventListener('change',()=>{label.classList.toggle('gt-track-selected',checkbox.checked);syncCount();});
        label.append(checkbox,name);tracksBox.append(label);
      });syncCount();
    }
    function renderChips(){
      chips.replaceChildren();
      chosen.forEach(artist=>{
        const wrap=make('span','gt-credit-chip');
        wrap.append(make('span','',artist.name));
        const close=make('button','', '×');close.type='button';close.title='Remove '+artist.name;
        close.setAttribute('aria-label','Remove '+artist.name);
        close.addEventListener('click',()=>{chosen=chosen.filter(item=>item.id!==artist.id);renderChips();});
        wrap.append(close);chips.append(wrap);
      });refreshControls();
    }
    function cancelSearch(){if(searchDelay)clearTimeout(searchDelay);searchAbort?.abort();searchAbort=null;}
    function clearOptions(){suggestions.replaceChildren();suggestions.hidden=true;search.setAttribute('aria-expanded','false');}
    async function runSearch(query,seq){
      const abort=new AbortController();searchAbort=abort;
      try{
        const options=await searchArtists(query,abort.signal);
        if(seq!==searchCount||working)return;
        clearOptions();
        if(!options.length){suggestions.append(make('div','gt-credit-option','No matching Genius artist profiles'));suggestions.hidden=false;search.setAttribute('aria-expanded','true');return;}
        options.forEach(item=>{
          const option=make('button','gt-credit-option',item.name);
          option.type='button';option.setAttribute('role','option');
          option.addEventListener('click',()=>{
            if(!chosen.some(a=>a.id===item.id))chosen.push(item);
            search.value='';searchCount++;cancelSearch();clearOptions();renderChips();search.focus();
          });suggestions.append(option);
        });suggestions.hidden=false;search.setAttribute('aria-expanded','true');
      } catch(e){if(seq===searchCount&&!abort.signal.aborted){clearOptions();setStatus(e.message);}}
    }
    search.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();clearOptions();return;}
      if(event.key==='ArrowDown'&&!suggestions.hidden){event.preventDefault();suggestions.querySelector('button')?.focus();}
    });
    suggestions.addEventListener('keydown',event=>{
      const buttons=[...suggestions.querySelectorAll('button')];
      const i=buttons.indexOf(document.activeElement);
      if(event.key==='Escape'){event.preventDefault();clearOptions();search.focus();}
      else if(event.key==='ArrowDown'){event.preventDefault();buttons[Math.min(i+1,buttons.length-1)]?.focus();}
      else if(event.key==='ArrowUp'){event.preventDefault();if(i<=0)search.focus();else buttons[i-1]?.focus();}
    });
    document.addEventListener('pointerdown',event=>{
      if(!root.isConnected)return;
      if(!search.closest('.gt-credit-artist-field').contains(event.target) && !suggestions.contains(event.target))clearOptions();
    });
    search.addEventListener('input',()=>{
      searchCount++;cancelSearch();const q=search.value.trim();clearOptions();
      if(q.length<2)return;
      const seq=searchCount;searchDelay=setTimeout(()=>runSearch(q,seq),260);
    });
    root.querySelector('.gt-credits-all').addEventListener('click',()=>{
      for(const x of tracksBox.querySelectorAll('input:not(:disabled)')){x.checked=true;x.closest('label').classList.add('gt-track-selected');}syncCount();
    });
    root.querySelector('.gt-credits-none').addEventListener('click',()=>{
      for(const x of tracksBox.querySelectorAll('input')){x.checked=false;x.closest('label').classList.remove('gt-track-selected');}syncCount();
    });
    root.addEventListener('toggle',event=>{if(event.target===root && root.open)loadTracks();},true);
    root.querySelector('.gt-credits-track-picker').addEventListener('toggle',()=>{if(!working)loadTracks();});
    stopButton.addEventListener('click',()=>controller?.abort());
    async function apply(action){
      if(working)return;
      const chosenTracks=selected(),people=chosen.slice(),selectedRoles=roles();
      if(!chosenTracks.length||!people.length||!validRole())return;
      working=true;controller=new AbortController();cancelSearch();clearOptions();refreshControls();
      results.replaceChildren();stopButton.hidden=false;
      let done=0,skipped=0,failed=0;
      for(let i=0;i<chosenTracks.length;i++){
        if(controller.signal.aborted)break;
        const track=chosenTracks[i];
        setStatus(`${action==='add'?'Adding':'Removing'} ${selectedRoles.length} role(s) · ${i+1}/${chosenTracks.length}`);
        const row=make('div','gt-credits-result');results.append(row);
        try{
          let updated=false,completed=0;
          for(const selectedRole of selectedRoles){
            if(controller.signal.aborted)break;
            const response=await updateCredit(track,selectedRole,people,action,controller.signal);
            if(response.state==='done')updated=true;
            completed++;
          }
          if(controller.signal.aborted)break;
          if(updated)done++;else skipped++;
          row.textContent=`${track.title}: ${updated?'Saved and verified':'Already correct'}`;
        }catch(e){
          failed++;row.textContent=`${track.title}: ${e.message}${selectedRoles.length>1?' Check this song before retrying; earlier roles may have saved.':''}`;
          // Avoid repeating a malformed/unaccepted credit write across the album.
          if(controller.signal.aborted||[401,403,429,500,502,503,504].includes(e.status)||/timed out/i.test(e.message)){
            controller.abort();break;
          }
        }
      }
      setStatus(`Batch ${controller.signal.aborted?'stopped':'finished'} · ${done} updated · ${skipped} unchanged · ${failed} failed.`);
      working=false;controller=null;stopButton.hidden=true;refreshControls();
    }
    addButton.addEventListener('click',()=>apply('add'));
    removeButton.addEventListener('click',()=>apply('remove'));
    renderRoleChips();
    loadTracks();
  }
  globalThis.GeniusToolkitCredits={init,normalizeRole,mergeCredit,exactIds,parseSearch,updateCredit,ROLE_CATALOG};
})();
