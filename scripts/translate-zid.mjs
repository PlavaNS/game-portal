// Builds the English "Wall of Riddles" from the Serbian Zid zagonetki source.
// usage: node translate-zid.mjs <src.html> <out.html>
import fs from 'node:fs';
const [src, out] = process.argv.slice(2);
let s = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n');
const R = [
// ---- head
['<html lang="sr-Latn">', '<html lang="en">'],
['<title>Zid zagonetki | Besplatna online escape igra Door 404</title>', '<title>Wall of Riddles | Free online escape game by Door 404</title>'],
['content="Besplatna online escape igra Door 404 iz Novog Sada. Devet zaključanih kutija, devet dragulja i jedan zid. Igrajte u browseru, bez registracije."', 'content="Free online escape game by Door 404. Nine locked chests, nine gems and one wall. Play in your browser, no sign-up."'],
['<link rel="canonical" href="https://www.escaperoom.co.rs/besplatna-escape-igra">', '<link rel="canonical" href="https://ilovewebgames.com/games/wall-of-riddles/">'],
['<link rel="icon" href="/favicon.png">', '<link rel="icon" href="/favicon.svg" type="image/svg+xml">'],
// ---- header
['<small>Door 404 · online igra</small><b>Zid zagonetki</b>', '<small>Door 404 · online escape game</small><b>Wall of Riddles</b>'],
['title="Vreme"', 'title="Time"'],
['title="Iskorišćene pomoći"', 'title="Hints used"'],
['title="Muzika" aria-label="Muzika"', 'title="Music" aria-label="Music"'],
['title="Zvučni efekti" aria-label="Zvučni efekti"', 'title="Sound effects" aria-label="Sound effects"'],
['title="Ceo ekran" aria-label="Igraj preko celog ekrana"', 'title="Full screen" aria-label="Play full screen"'],
['title="Uputstvo" aria-label="Uputstvo"', 'title="How to play" aria-label="How to play"'],
['aria-label="Dragulji"', 'aria-label="Gems"'],
// ---- intro
['<div class="eyebrow">Door 404 · Novi Sad</div>\n    <h1>Zid zagonetki</h1>\n    <div class="sub">Devet kutija. Devet dragulja. Jedan zid.</div>\n    <p>Pred vama je zid sa devet zaključanih kutija. U svakoj je po jedan dragulj, a u nekima i trag za sledeću kutiju. Skupite svih devet i zid je vaš.</p>',
 '<div class="eyebrow">Door 404 · Escape room games</div>\n    <h1>Wall of Riddles</h1>\n    <div class="sub">Nine chests. Nine gems. One wall.</div>\n    <p>In front of you is a wall with nine locked chests. Each one holds a gem, and some also hide a clue for another chest. Collect all nine gems and the wall is yours.</p>'],
['<li>Tri zelene kutije možete da rešite odmah.</li>\n      <li>Žute i crvene traže predmete koje nađete usput. Predmeti padaju u torbu na dnu ekrana.</li>\n      <li>Kliknite na predmet da ga pogledate. <b>Prevucite ga na kutiju</b> da ga upotrebite.</li>\n      <li>Zaglavili ste se? Svaka kutija ima dugme za pomoć.</li>\n      <li>Najlepše je u dvoje ili troje, pred istim ekranom. Pojačajte zvuk.</li>',
 '<li>The three green chests can be solved right away.</li>\n      <li>Yellow and red chests need items you find along the way. Items drop into the bag at the bottom of the screen.</li>\n      <li>Tap an item to look at it. <b>Drag it onto a chest</b> to use it.</li>\n      <li>Stuck? Every chest has a hint button.</li>\n      <li>Best played by two or three people at one screen. Turn the sound up.</li>'],
['<button class="btn" id="startBtn">Počni igru</button>\n      <button class="btn ghostb" id="startFsBtn">Igraj preko celog ekrana</button>\n      <button class="btn ghostb" id="resetBtn" style="display:none">Nova igra</button>',
 '<button class="btn" id="startBtn">Start game</button>\n      <button class="btn ghostb" id="startFsBtn">Play full screen</button>\n      <button class="btn ghostb" id="resetBtn" style="display:none">New game</button>'],
// ---- win
['<div class="eyebrow">Svih 9 dragulja</div>\n    <h1>Zid je pao!</h1>', '<div class="eyebrow">All 9 gems</div>\n    <h1>The wall is yours!</h1>'],
['<p>Ako vam je ovo bilo zabavno, prava soba je deset puta bolja: mrak, zvuci, mehanizmi koji se zaista otvaraju i 60 minuta na satu.</p>',
 '<p>Enjoyed it? A real escape room goes much further: darkness, sounds, mechanisms that really open and 60 minutes on the clock. Visit Door 404 in Novi Sad, Serbia.</p>'],
['target="_top" style="text-decoration:none">Rezerviši pravu sobu</a>\n      <button class="btn ghostb" id="shareBtn">Pošalji igru prijatelju</button>\n      <button class="btn ghostb" id="againBtn">Igraj ponovo</button>',
 'target="_blank" rel="noopener" style="text-decoration:none">Book a real room</a>\n      <button class="btn ghostb" id="shareBtn">Send to a friend</button>\n      <button class="btn ghostb" id="againBtn">Play again</button>'],
// ---- items
['text-anchor="middle" font-weight="800">JANUAR</text>', 'text-anchor="middle" font-weight="800">JANUARY</text>'],
['kalendar:{name:"Stoni kalendar"', 'kalendar:{name:"Desk calendar"'],
['folija:{name:"Siva folija"', 'folija:{name:"Grey film"'],
['svitak:{name:"Svitak sa simbolima"', 'svitak:{name:"Scroll with symbols"'],
['simboli:{name:"Papir sa simbolima"', 'simboli:{name:"Paper with symbols"'],
['strelice:{name:"Tabla sa strelicama"', 'strelice:{name:"Board with arrows"'],
['disk:{name:"Drveni disk"', 'disk:{name:"Wooden disc"'],
['kljuc:{name:"Mesingani ključ"', 'kljuc:{name:"Brass key"'],
// ---- clock plaque: M minutes, S seconds, H hours
['fill="#2a160a">Č</text>', 'fill="#2a160a">H</text>'],
// ---- switches: MAKER
['const COMBOS={"0,1,2":"M","0,4,5":"E","2,3,5":"R","1,3,4":"A","0,2,3":"K"};', 'const COMBOS={"0,1,2":"M","0,4,5":"A","2,3,5":"K","1,3,4":"E","0,2,3":"R"};'],
// ---- disks: CHEST (disk0 idx2, disk1 idx3, disk2 idx4, disk3 idx0, disk4 idx4)
['const DISKS=[{f:["V","\\\\","O","/","V","\\\\"],b:["S","N","T","B","I","R"]},{f:["O","V","\\\\","/","O","V"],b:["B","R","I","A","K","E"]},{f:["V","/","\\\\","V","O","/"],b:["Z","M","O","L","J","D"]},{f:["\\\\","O","V","/","O","V"],b:["N","T","R","S","P","O"]},{f:["O","/","\\\\","O","V","/"],b:["V","R","K","E","A","S"]}];',
 'const DISKS=[{f:["V","\\\\","O","/","V","\\\\"],b:["S","N","C","B","I","R"]},{f:["O","V","\\\\","/","O","V"],b:["B","R","I","H","K","A"]},{f:["V","/","\\\\","V","O","/"],b:["Z","M","O","L","E","D"]},{f:["\\\\","O","V","/","O","V"],b:["S","T","R","N","P","O"]},{f:["O","/","\\\\","O","V","/"],b:["V","R","K","E","T","A"]}];'],
// ---- disk plate: L C R
['{shape:"pentagon",letter:"D",phi:150,step:10}', '{shape:"pentagon",letter:"R",phi:150,step:10}'],
['opacity=".8">prazno ležište</text>', 'opacity=".8">empty socket</text>'],
['const SHAPE_NAME={star:"Zvezda",sqstar:"Zvezda od dva kvadrata",pentagon:"Petougao"},SLOT_NAME={L:"levo ležište",C:"srednje ležište",D:"desno ležište"};',
 'const SHAPE_NAME={star:"The star",sqstar:"The two-square star",pentagon:"The pentagon"},SLOT_NAME={L:"the left slot",C:"the center slot",R:"the right slot"};'],
['return p?`<b>${SHAPE_NAME[p.shape]}</b> i slovo <b>${p.letter}</b> su se spojili. Slovo ${p.letter} je ${SLOT_NAME[p.letter]}. Nađite isti oblik u uglu neke kutije na zidu: kocka sa njegovom šarom ide u to ležište.`:"Okrećite disk dok se neki oblik i slovo ne spoje u celinu."}',
 'return p?`<b>${SHAPE_NAME[p.shape]}</b> and the letter <b>${p.letter}</b> have lined up. ${p.letter} means ${SLOT_NAME[p.letter]}. Find the same shape in the corner of a chest on the wall: the cube with its pattern goes into that slot.`:"Turn the disc until a shape and a letter line up."}'],
// ---- chest titles
['title:"Šest slova"', 'title:"Six letters"'],
['title:"Tabla X i O"', 'title:"X and O board"'],
['title:"Četiri zastave"', 'title:"Four flags"'],
['title:"Četiri godišnja doba"', 'title:"Four seasons"'],
['title:"Dugmići i kompas"', 'title:"Buttons and compass"'],
['title:"Disk i kocke"', 'title:"Disc and cubes"'],
['title:"Sat koji stoji"', 'title:"The stopped clock"'],
['title:"Drveni diskovi"', 'title:"Wooden discs"'],
['title:"Četiri zagonetke"', 'title:"Four riddles"'],
['disks:{alpha:"ABCDEFGHIJKLMNOPQRSTUVWXYZ",code:"TAJNA"', 'disks:{alpha:"ABCDEFGHIJKLMNOPQRSTUVWXYZ",code:"CHEST"'],
['switches:{alpha:"ABCDEFGHIJKLMNOPQRSTUVWXYZ",code:"MERAK"', 'switches:{alpha:"ABCDEFGHIJKLMNOPQRSTUVWXYZ",code:"MAKER"'],
];
// hints block replaced wholesale
const hintsStart = s.indexOf('const HINTS={');
const hintsEnd = s.indexOf('};', hintsStart) + 2;
if (hintsStart < 0) throw new Error('HINTS not found');
const HINTS_EN = `const HINTS={
 xo:["Three small keyboards are drawn on the chest. Look only at the black keys.","The black keys show which three columns of the board to look at. Follow the O marks, not the X marks.","Columns 1 to 3 make the number 6, columns 3 to 5 make 2, columns 5 to 7 make 9. The code is 629."],
 clock:["Every hand on the clock has a different tip. The same tips are drawn on the chest.","The chest says M for minutes, S for seconds and H for hours. A hand pointing at III means 15 minutes.","Minutes 15, seconds 25, hours 7. The code is 15257."],
 riddles:["Each riddle gives exactly one character: a number or a letter.","Candles that keep burning burn down completely. Riddles II and IV are about letters in words, and riddle III asks about the word \\"it\\" only.","3 blown-out candles remain, the rest burn away. The answers are 3, A, 1 and M. The code is 3A1M."],
 calendar:["You need the calendar from one of the green chests. Drag it from the bag onto this chest.","The four pictures are the four seasons. The signs on the chest are the corners the black lines make around each picture.","Winter is January (7), summer August (1), autumn November (9), spring April (4). The order on the chest gives 7194."],
 flags:["You will need the grey film from the clock chest.","Drag the film from the bag onto the flags, then move it until it sits exactly on top of them.","The code is HOCT."],
 disks:["The scroll from the riddle chest shows five symbols, top to bottom. Drag it here.","Turn the discs so the golden frame shows the same symbols as the scroll, top to bottom: O / O \\\\ V. Then tap Look at the back and read the letters in the frame.","The back of the frame reads CHEST. That is the code."],
 branko:["The board with arrows is inside the wooden discs chest.","Each letter at the top of the board is a starting square. The arrows below it draw a path across the letters BRANKO.","The paths draw the digits 5, 7, 3 and 2. The code is 5732."],
 switches:["The paper with symbols is inside the flags chest.","Press the three buttons from one row of the paper and watch the compass. Release all buttons before the next row. Read the rows top to bottom.","The five rows give the letters M, A, K, E, R. The code is MAKER."],
 cubes:["Drag the disc from the bag into the socket and open the big chest with the key. Then turn the disc until a shape and a letter line up and glow gold. There are three such pairs: the star, the two-square star and the pentagon.","The letter says WHERE the cube goes: L is left, C center, R right. The shape says WHICH cube: the same shape sits in the corner of a chest on the wall, filled with a pattern. The cube with that pattern goes into that slot.","Example: the star lined up with L. The star is in the corner of the seasons chest and is filled with diagonal stripes, so the striped cube goes left. Likewise the two-square star is in the clock corner with a grid, that cube goes in the middle. The pentagon is in the riddles corner with arcs, that cube goes right."]
};`;
s = s.slice(0, hintsStart) + HINTS_EN + s.slice(hintsEnd);

R.push(
['const KEY="door404-zid-zagonetki-v1";', 'const KEY="ilwg-wall-of-riddles-v1";'],
['<div class="slotlab"><span>L</span><span>C</span><span>D</span></div>', '<div class="slotlab"><span>L</span><span>C</span><span>R</span></div>'],
// UI strings
['b.setAttribute("aria-label",p.title+(done?", rešeno":""));', 'b.setAttribute("aria-label",p.title+(done?", solved":""));'],
[`el.innerHTML='<span class="lab">Torba</span>';`, `el.innerHTML='<span class="lab">Bag</span>';`],
[`'<span class="empty">Torba je prazna. Predmeti iz otvorenih kutija padaju ovde.</span>'`, `'<span class="empty">Your bag is empty. Items from opened chests drop here.</span>'`],
['b.title=ITEMS[i].name+": kliknite da pogledate, prevucite na kutiju";', 'b.title=ITEMS[i].name+": tap to look, drag onto a chest";'],
['toast(S.solved[pid]?"Ova kutija je već otvorena.":"Ovo ovde ne pomaže.");', 'toast(S.solved[pid]?"This chest is already open.":"That does not help here.");'],
['toast("Folija je prislonjena na zastave.");', 'toast("The film is placed on the flags.");'],
['toast("Disk je u ležištu. Okrećite ga.");', 'toast("The disc is in the socket. Turn it.");'],
['toast("Velika kutija je otvorena.");', 'toast("The big chest is open.");'],
['aria-label="Zatvori">✕</button>', 'aria-label="Close">✕</button>'],
['data-hint>Pomoć</button>', 'data-hint>Hint</button>'],
['btn.textContent=n>=HINTS[id].length?"Nema više pomoći":`Pomoć ${n+1} od ${HINTS[id].length}`;', 'btn.textContent=n>=HINTS[id].length?"No more hints":`Hint ${n+1} of ${HINTS[id].length}`;'],
['`<p><b>Pomoć ${i+1}:</b> ${h}</p>`', '`<p><b>Hint ${i+1}:</b> ${h}</p>`'],
['const gemName=g=>g==="g"?"Zeleni":g==="y"?"Žuti":"Crveni";', 'const gemName=g=>g==="g"?"Green":g==="y"?"Yellow":"Red";'],
['`<div class="msg">Kutija je otvorena!</div>', '`<div class="msg">The chest is open!</div>'],
['${gemName(P[id].gem)} dragulj</div>', '${gemName(P[id].gem)} gem</div>'],
['toast(`${gemName(P[id].gem)} dragulj je vaš!`+(its.length?` U torbi: ${its.map(i=>ITEMS[i].name).join(", ")}.`:""));', 'toast(`The ${gemName(P[id].gem).toLowerCase()} gem is yours!`+(its.length?` In your bag: ${its.map(i=>ITEMS[i].name).join(", ")}.`:""));'],
['aria-label="Sledeći znak">▲</button>', 'aria-label="Next character">▲</button>'],
['aria-label="Prethodni znak">▼</button>', 'aria-label="Previous character">▼</button>'],
['`<div class="note">U torbi imate nešto što bi ovde moglo da pomogne. Prevucite to na kutiju.</div>`', '`<div class="note">Something in your bag could help here. Drag it onto the chest.</div>`'],
['title="Znak ove kutije"', 'title="This chest\'s sign"'],
// riddles text
[`<p style="margin:.1em 0 .8em"><b>I.</b> Na stolu gori pet sveća.<br>Vetar ugasi tri.<br>Koliko će sveća ostati na kraju?</p>
   <p style="margin:.1em 0 .8em"><b>II.</b> Početak avanture,<br>kraj zagonetke,<br>početak alarma<br>i kraj svake priče.</p>
   <p style="margin:.1em 0 .8em"><b>III.</b> Tri tigra trče kroz tamnu travu.<br>Koliko slova T ima u tome?</p>
   <p style="margin:.1em 0"><b>IV.</b> Šta se javlja jednom u minuti, dvaput u momentu, a nijednom u hiljadu godina?</p>`,
 `<p style="margin:.1em 0 .8em"><b>I.</b> Five candles burn on a table.<br>The wind blows out three.<br>How many candles are left in the end?</p>
   <p style="margin:.1em 0 .8em"><b>II.</b> I start every adventure,<br>I end every idea,<br>I open every alarm<br>and close every saga.</p>
   <p style="margin:.1em 0 .8em"><b>III.</b> Ten tiny turtles trot toward town.<br>How many letters T are in it?</p>
   <p style="margin:.1em 0"><b>IV.</b> What comes once in a minute, twice in a moment, but never in a thousand years?</p>`],
['`<div class="note">Na ovim slikama nema brojeva. Možda ih ima negde drugde.</div>`', '`<div class="note">There are no numbers in these pictures. Maybe they are somewhere else.</div>`'],
['id="foilBack">Vrati foliju u torbu</button>', 'id="foilBack">Put the film back in the bag</button>'],
['`<div class="note">Četiri zastave i katanac sa slovima. Nešto ovde nedostaje.</div>`', '`<div class="note">Four flags and a letter padlock. Something is missing here.</div>`'],
['aria-label="Okreni levo">⟲</button>', 'aria-label="Turn left">⟲</button>'],
['aria-label="Okreni desno">⟳</button>', 'aria-label="Turn right">⟳</button>'],
['id="flipBtn">${S.diskBack?"Pogledaj spreda":"Pogledaj diskove sa zadnje strane"}</button>', 'id="flipBtn">${S.diskBack?"Look at the front":"Look at the back"}</button>'],
['e.target.textContent=S.diskBack?"Pogledaj spreda":"Pogledaj diskove sa zadnje strane";', 'e.target.textContent=S.diskBack?"Look at the front":"Look at the back";'],
['`<div class="note">Šest slova i katanac sa brojevima. Kako se od slova dobija broj?</div>`', '`<div class="note">Six letters and a number padlock. How do letters turn into numbers?</div>`'],
['aria-label="Dugme ${i+1}"', 'aria-label="Button ${i+1}"'],
['`<div class="note">Kompas reaguje tek kad su pritisnuta tačno tri prava dugmeta.</div><div class="row" id="relRow" style="visibility:hidden"><button class="btn ghostb" id="relAll">Pusti sva dugmad</button></div>`',
 '`<div class="note">The compass only reacts when exactly the right three buttons are pressed.</div><div class="row" id="relRow" style="visibility:hidden"><button class="btn ghostb" id="relAll">Release all buttons</button></div>`'],
['toast("Najviše tri dugmeta odjednom. Pustite jedno ili kliknite Pusti sva dugmad.");', 'toast("Three buttons at most. Release one or tap Release all buttons.");'],
['id="rl">⟲ Okreni</button><button class="btn ghostb" id="rr">Okreni ⟳</button>', 'id="rl">⟲ Turn</button><button class="btn ghostb" id="rr">Turn ⟳</button>'],
['`<div class="note">Prazno ležište za disk i velika kutija sa ključaonicom.</div>`', '`<div class="note">An empty socket for a disc and a big chest with a keyhole.</div>`'],
['aria-label="Ležište ${i+1}"', 'aria-label="Slot ${i+1}"'],
['aria-label="Kocka"', 'aria-label="Cube"'],
['toast("Kocke stoje, ali ništa se ne dešava.")', 'toast("The cubes are in place, but nothing happens.")'],
['`<div class="cal" id="cal"></div><div class="note">Listajte mesece strelicama.</div>`', '`<div class="cal" id="cal"></div><div class="note">Flip through the months with the arrows.</div>`'],
['<div class="note">Providna siva folija sa nekoliko obojenih mrlja. Iste je širine kao jedan red na zidu.</div>', '<div class="note">A see-through grey film with a few coloured patches. It is as wide as one row on the wall.</div>'],
['<div class="note">Drveni disk sa rupom u sredini i oznakama po ivici. Negde na zidu mu je mesto.</div>', '<div class="note">A wooden disc with a hole in the middle and marks around the edge. It belongs somewhere on the wall.</div>'],
['<div class="note">Mali mesingani ključ.</div>', '<div class="note">A small brass key.</div>'],
['id="useHere">Upotrebi na ovoj kutiji</button><button class="btn ghostb" id="backBtn">Nazad na kutiju</button>`:`<span class="note">Prevucite predmet iz torbe na kutiju da ga upotrebite.</span>`',
 'id="useHere">Use on this chest</button><button class="btn ghostb" id="backBtn">Back to the chest</button>`:`<span class="note">Drag the item from your bag onto a chest to use it.</span>`'],
['const MONTHS=["Januar","Februar","Mart","April","Maj","Jun","Jul","Avgust","Septembar","Oktobar","Novembar","Decembar"]', 'const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"]'],
['aria-label="Prethodni mesec"', 'aria-label="Previous month"'],
['aria-label="Sledeći mesec"', 'aria-label="Next month"'],
['["PON","UTO","SRE","ČET","PET","SUB","NED"]', '["MON","TUE","WED","THU","FRI","SAT","SUN"]'],
['$("#winText").textContent=`Vreme: ${fmt(S.elapsed)}. Iskorišćene pomoći: ${h}. ${h===0?"Bez ijedne pomoći, svaka čast!":S.elapsed<1200?"Brzi ste, ovo je odličan rezultat.":"Rešili ste ceo zid, bravo!"}`;',
 '$("#winText").textContent=`Time: ${fmt(S.elapsed)}. Hints used: ${h}. ${h===0?"Not a single hint, well done!":S.elapsed<1200?"That was fast, a great result.":"You solved the whole wall, bravo!"}`;'],
['toast("Na iPhone-u: dugme Podeli, pa Dodaj na početni ekran, i igra se otvara preko celog ekrana.")', 'toast("On iPhone: tap Share, then Add to Home Screen, and the game opens full screen.")'],
['$("#resetBtn").textContent="Sigurno? Klikni još jednom";', '$("#resetBtn").textContent="Sure? Tap once more";'],
['$("#resetBtn").textContent="Nova igra";', '$("#resetBtn").textContent="New game";'],
['$("#startBtn").textContent=S.started?"Nastavi igru":"Počni igru";', '$("#startBtn").textContent=S.started?"Continue":"Start game";'],
['const url="https://www.escaperoom.co.rs/besplatna-escape-igra",text=`Rešio sam Zid zagonetki za ${fmt(S.elapsed)}. Probaj i ti, besplatno je:`;', 'const url="https://ilovewebgames.com/games/wall-of-riddles/",text=`I solved the Wall of Riddles in ${fmt(S.elapsed)}. Try it, it is free:`;'],
['await navigator.share({title:"Zid zagonetki",text,url})', 'await navigator.share({title:"Wall of Riddles",text,url})'],
['toast("Link je kopiran.")', 'toast("Link copied.")'],
['$("#startBtn").textContent="Pogledaj zid";', '$("#startBtn").textContent="View the wall";'],
['$("#startBtn").textContent="Nastavi igru";', '$("#startBtn").textContent="Continue";'],
['href="https://www.escaperoom.co.rs/rezervacija"', 'href="https://www.escaperoom.co.rs/rezervacija?utm_source=ilovewebgames&utm_medium=game&utm_campaign=wall_of_riddles"'],
);
let miss = [];
for (const [a, b] of R) {
  const n = s.split(a).length - 1;
  if (n === 0) { miss.push(a.slice(0, 70)); continue; }
  s = s.split(a).join(b);
}
fs.writeFileSync(out, s);
// leftover Serbian check
const left = s.match(/[čćžšđČĆŽŠĐ][^"<]{0,30}/g) || [];
console.log('missing:', miss.length); miss.forEach(m => console.log('  MISS', m));
console.log('leftover diacritics:', left.length); left.slice(0, 40).forEach(m => console.log('  ', m));
