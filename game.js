(() => {
  const $ = (id) => document.getElementById(id);
  const buttons = [...document.querySelectorAll('.action-button')];
  const foods = [
    { name: 'wild berries', icon: '🫐', kind: 'forage' },
    { name: 'tender greens', icon: '🌿', kind: 'forage' },
    { name: 'mushrooms', icon: '🍄', kind: 'forage' },
    { name: 'steak', icon: '🥩', kind: 'market' },
    { name: 'onions', icon: '🧅', kind: 'market' },
    { name: 'bell peppers', icon: '🫑', kind: 'market' },
    { name: 'garlic', icon: '🧄', kind: 'market' },
    { name: 'peppercorn', icon: '🫒', kind: 'market' },
    { name: 'noodles', icon: '🍜', kind: 'market' },
    { name: 'crab', icon: '🦀', kind: 'market' },
    { name: 'lobster', icon: '🦞', kind: 'market' }
  ];
  const chapters = [
    {tag:'CHAPTER ONE · THE FIRST NIGHT', title:'A place to begin.', text:'You and Mom found a little shelter at the edge of the woods. The roof leans, and the path is unfamiliar. But it is somewhere to rest. You’re ten, and tonight you’ll make it a little safer together.'},
    {tag:'CHAPTER ONE · LEARNING THE PATHS', title:'Small things add up.', text:'The woods are starting to feel a little less unfamiliar. Mom takes her time on the long walk for food, and you look after the clearing. Together, you’re figuring out what helps.'},
    {tag:'CHAPTER TWO · MAKING IT SAFER', title:'A home takes tending.', text:'The hut is still rough, but it’s yours to care for. A swept path, a dry bundle of kindling, a meal shared by the fire: none of it is small.'},
    {tag:'CHAPTER TWO · A HARD DAY', title:'It’s okay to feel it.', text:'Some days are heavy. Mom gets quiet, and your eyes sting. You sit close, and she holds your hand. Being sad doesn’t mean you’ve stopped being brave.'},
    {tag:'CHAPTER THREE · STILL HERE', title:'You made a little home.', text:'The shelter has held through another night. The food is simple, the days take patience, and you keep finding ways to care for one another.'}
  ];
  const state = {};
  function freshState() {
    Object.assign(state, { day: 1, hours: 8, foods: [...foods.slice(0, 2)], wood: 1, energy: 68, fullness: 38, hope: 62, momMood: 'okay', kidMood: 'trying', cleared: false, cooked: false, searched: false, gatherCount: 0, meals: 0, snakeHandled: false, ended: false, finished: false, age: 10, time: 'EARLY MORNING' });
    document.body.classList.remove('night', 'snake-visible', 'ending');
    $('sceneCaption').textContent = 'The woods are quiet, for now.';
    $('weatherText').textContent = 'Clouds gathering beyond the trees';
    $('storyTitle').textContent = chapters[0].title;
    $('storyText').textContent = chapters[0].text;
    $('chapterTag').textContent = chapters[0].tag;
    $('dayCount').textContent = 'DAY 1';
    $('heartNote').textContent = 'You have each other. That counts for something.';
    $('momMood').innerHTML = '♡ <small>okay</small>';
    $('kidMood').innerHTML = '✦ <small>trying</small>';
    $('sceneFire').style.display = 'none';
    $('smoke').style.opacity = '0';
    document.querySelectorAll('.chapter-progress i').forEach((dot, i) => dot.classList.toggle('active', i === 0));
    $('endDay').innerHTML = '<span>Settle in for the night</span><span>→</span>';
    $('endDay').disabled = false;
    $('timeLabel').textContent = state.time;
    render();
  }
  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
  }
  function setStory(title, text) { $('storyTitle').textContent = title; $('storyText').textContent = text; }
  function adjust(key, delta) { state[key] = Math.max(0, Math.min(100, state[key] + delta)); }
  function spend(hours, time) { state.hours -= hours; state.time = time; }
  function random(list) { return list[Math.floor(Math.random() * list.length)]; }
  function addFood(item) { state.foods.push(item); }
  function render() {
    $('energyValue').textContent = `${state.energy}%`; $('foodValue').textContent = `${state.fullness}%`; $('hopeValue').textContent = `${state.hope}%`;
    $('energyBar').style.width = `${state.energy}%`; $('foodBar').style.width = `${state.fullness}%`; $('hopeBar').style.width = `${state.hope}%`;
    $('woodCount').textContent = `${state.wood} ${state.wood === 1 ? 'bundle' : 'bundles'}`;
    $('basketCount').textContent = `${state.foods.length} ${state.foods.length === 1 ? 'thing' : 'things'}`;
    document.querySelectorAll('.chapter-progress i').forEach((dot, i) => dot.classList.toggle('active', i <= (state.finished ? 4 : state.day - 1)));
    $('kidAge').textContent = state.age;
    $('hoursLeft').textContent = state.ended ? 'the day is done' : `${state.hours} hours left`;
    $('inventory').innerHTML = state.foods.length ? state.foods.map((f, i) => `<span class="food-chip" title="${f.name}"><span>${f.icon}</span>${f.name}</span>`).join('') : '<div class="empty-inventory">Nothing in the basket yet. There will be another chance.</div>';
    buttons.forEach(btn => {
      const action = btn.dataset.action;
      let cost = ({'mom-search':3, gather:2, clear:2, cook:4, rest:2})[action];
      let blocked = state.ended || state.finished || state.hours < cost;
      if (action === 'mom-search' && state.searched) blocked = true;
      if (action === 'clear' && state.cleared) blocked = true;
      if (action === 'cook' && (state.foods.length < 2 || state.wood < 1)) blocked = true;
      if (action === 'gather' && state.gatherCount >= 2) blocked = true;
      btn.disabled = blocked;
      if (action === 'mom-search' && state.searched) btn.querySelector('small').textContent = 'Mom is home for today · rest her feet';
      else if (action === 'clear' && state.cleared) btn.querySelector('small').textContent = 'The path is clear and checked';
      else if (action === 'cook' && (state.foods.length < 2 || state.wood < 1)) btn.querySelector('small').textContent = state.foods.length < 2 ? 'Needs two things to cook together' : 'Needs one bundle of kindling';
      else if (action === 'gather' && state.gatherCount >= 2) btn.querySelector('small').textContent = 'You’ve gathered all you can today';
      else btn.querySelector('small').textContent = ({'mom-search':'Takes 2–3 hours · finds a few things',gather:'Look for berries, greens & kindling',clear:'Make a safe, clear path for snakes',cook:'Takes 4 hours · needs food & a fire',rest:'Take a breath and make a plan'})[action];
    });
    $('endDay').disabled = false;
  }
  function search() {
    spend(3, 'MIDDAY'); state.searched = true; state.energy -= 7;
    const found = [random(foods.slice(3)), random(foods.slice(3))]; found.forEach(addFood);
    $('sceneCaption').textContent = 'Mom is back from the long walk.';
    setStory('She came back with a little something.', `Mom walked slowly along the creek and the old trail. It took nearly three hours. She found ${found[0].name} and ${found[1].name}—enough to add a little variety to your basket.`);
    $('heartNote').textContent = 'She takes her time. She always comes back.';
    toast(`Mom found ${found[0].name} and ${found[1].name}.`); render();
  }
  function gather() {
    spend(2, 'LATE MORNING'); state.energy -= 5; state.gatherCount++;
    const found = random(foods.slice(0, 3)); addFood(found); state.wood += 1;
    $('sceneCaption').textContent = 'You found a familiar patch.';
    setStory('You know where to look.', `You stay close to the hut and pick only the plants you recognize. There are ${found.name} for the basket${state.wood > 1 ? ', and a dry bundle of kindling' : ''}. You leave the rest growing for another day.`);
    toast(`Added ${found.name} to the basket.`); render();
  }
  function clearPath() {
    spend(2, 'LATE MORNING'); state.energy -= 4; state.cleared = true; state.snakeHandled = true;
    document.body.classList.remove('snake-visible');
    $('sceneCaption').textContent = 'The path around the hut is clear.';
    setStory('A little room to breathe.', 'You tap the ground with a long stick and rustle the brush from a safe distance. The snake slips away into the grass. You never try to touch it. The path is clear now, and the hut feels a little safer.');
    $('weatherText').textContent = 'A breeze moves gently through the clearing';
    toast('The snake moved away. The path is clear.'); render();
  }
  function cook() {
    if (state.foods.length < 2 || state.wood < 1) return;
    spend(4, 'EVENING'); state.wood--; state.foods.splice(0, 2); state.meals++; state.cooked = true; state.fullness += 31; state.energy += 8; state.hope += 7;
    $('sceneFire').style.display = 'block'; $('smoke').style.opacity = '1';
    $('sceneCaption').textContent = 'A warm meal, shared together.';
    setStory('Four slow hours, then supper.', 'You wait together while the little fire does its work. The stew is simple—made from whatever you could find—but it smells good. Mom smiles when you ask for another bite. For tonight, you have enough.');
    $('heartNote').textContent = 'A shared meal is its own kind of warmth.';
    toast('A warm meal lifts everyone’s spirits.'); render();
  }
  function rest() {
    spend(2, 'AFTERNOON'); state.energy += 10; state.hope += 4;
    $('sceneCaption').textContent = 'You sit together in the shade.';
    setStory('A quiet moment counts, too.', 'You sit beside Mom and watch the leaves shift overhead. There’s nothing you have to fix this minute. She tells you one thing she’s grateful for. You tell her yours.');
    $('heartNote').textContent = 'A little rest is a good choice.';
    toast('You took a little time to rest together.'); render();
  }
  function act(action) { if (state.ended || state.finished) return; if (action === 'mom-search') search(); if (action === 'gather') gather(); if (action === 'clear') clearPath(); if (action === 'cook') cook(); if (action === 'rest') rest(); }
  function endDay() {
    if (state.ended || state.finished) return;
    state.ended = true; document.body.classList.add('night'); $('timeLabel').textContent = 'AFTER DARK'; $('sceneCaption').textContent = 'The fireflies blink outside your shelter.';
    state.fullness = Math.max(0, state.fullness - 11); state.energy = Math.max(0, state.energy - 4);
    if (!state.cleared) {
      if (Math.random() > .43) { document.body.classList.add('snake-visible'); $('sceneCaption').textContent = 'Something rustles near the hut.'; setStory('A visitor in the grass.', 'You hear a soft rustle near the path. Mom keeps you safely inside while the snake passes by on its own. Tomorrow, you can make the space around the hut clearer together.'); state.hope = Math.max(0, state.hope - 2); }
      else setStory('The night stays quiet.', 'You tuck in close under the blanket. The woods are full of little sounds, but the hut holds. Tomorrow is another chance to make it safer.');
    } else setStory(state.cooked ? 'You fall asleep feeling a little steadier.' : 'You made it through another day.', state.cooked ? 'The fire has gone low, the basket is put away, and Mom is right beside you. Tomorrow you’ll try again, one small thing at a time.' : 'The day wasn’t easy, but you stayed close and made a plan. The shelter is here. Mom is here. Tomorrow brings another chance.');
    if (state.day === 3 && !state.cooked) { state.momMood = 'sad'; $('momMood').innerHTML = '♡ <small>a little sad</small>'; $('kidMood').innerHTML = '✦ <small>here for her</small>'; $('heartNote').textContent = 'You can sit together when the day feels heavy.'; }
    if (state.day === 3) { setStory('It’s okay to feel it.', 'Mom gets quiet, and your eyes sting. You sit close, and she holds your hand. Being sad doesn’t mean you’ve stopped being brave. The two of you have made it this far, together.'); $('momMood').innerHTML = '♡ <small>a little sad</small>'; $('kidMood').innerHTML = '✦ <small>here for her</small>'; }
    state.hope = Math.min(100, state.hope + (state.cooked ? 2 : 0));
    $('endDay').innerHTML = '<span>Wake up to morning</span><span>→</span>';
    $('endDay').disabled = false;
    render();
  }
  function nextDay() {
    if (!state.ended || state.finished) return;
    if (state.day >= 5) { finishStory(); return; }
    state.day++; state.hours = 8; state.ended = false; state.searched = false; state.cleared = false; state.cooked = false; state.gatherCount = 0; state.snakeHandled = false;
    state.energy = Math.min(100, state.energy + 16); state.hope = Math.min(100, state.hope + 3); state.momMood = 'okay';
    document.body.classList.remove('night', 'snake-visible'); $('sceneFire').style.display = 'none'; $('smoke').style.opacity = '0';
    $('timeLabel').textContent = 'EARLY MORNING'; $('dayCount').textContent = `DAY ${state.day}`;
    $('chapterTag').textContent = chapters[Math.min(state.day - 1, 4)].tag;
    $('storyTitle').textContent = chapters[Math.min(state.day - 1, 4)].title; $('storyText').textContent = chapters[Math.min(state.day - 1, 4)].text;
    $('sceneCaption').textContent = 'Morning finds you here again.'; $('weatherText').textContent = state.day === 4 ? 'Rain clouds gathering over the ridge' : 'A pale sun warms the treetops';
    $('endDay').innerHTML = '<span>Settle in for the night</span><span>→</span>';
    render(); toast(`Day ${state.day}. You’re still here, together.`);
  }
  function finishStory() {
    state.finished = true; state.age = 15; document.body.classList.add('ending');
    document.body.classList.remove('night', 'snake-visible'); $('timeLabel').textContent = 'FIVE YEARS LATER'; $('dayCount').textContent = 'FIVE YEARS ON'; $('chapterTag').textContent = 'A SMALL, BRAVE ENDING';
    $('storyTitle').textContent = 'At least you have a place.';
    $('storyText').textContent = 'Five years later, the woods are still your home. You’re fifteen now. The hut has a stronger roof, and the path is one you know by heart. Some days are still hard; you and Mom still look for food, share what you find, and take your time. But you have a place. You have each other. That is not everything—but it is something real.';
    $('sceneCaption').textContent = 'Your home, five years later.'; $('weatherText').textContent = 'The clearing feels familiar now'; $('heartNote').textContent = 'Five years of showing up for each other.';
    $('chapterTag').textContent = 'A SMALL, BRAVE ENDING'; $('endDay').innerHTML = '<span>Begin the story again</span><span>↻</span>'; $('endDay').disabled = false;
    $('momMood').innerHTML = '♡ <small>steady</small>'; $('kidMood').innerHTML = '✦ <small>15 years old</small>';
    buttons.forEach(btn => btn.disabled = true); toast('Five years on. The hut is still here.'); render();
  }
  $('endDay').addEventListener('click', () => {
    if (state.finished) freshState();
    else if (state.ended) nextDay();
    else endDay();
  });
  buttons.forEach(btn => btn.addEventListener('click', () => act(btn.dataset.action)));
  $('restartBtn').addEventListener('click', freshState);
  const modal = $('modal');
  $('helpBtn').addEventListener('click', () => modal.showModal());
  $('modalClose').addEventListener('click', () => modal.close());
  $('modalAction').addEventListener('click', () => modal.close());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
  freshState();
})();
