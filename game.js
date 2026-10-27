// ===============================================================
// DEVIL DRIVE: Drive Mad meets Level Devil, in plain JavaScript.
// Map: 1 SETUP - 2 LEVELS - 3 INPUT - 4 LOADER - 5 PHYSICS - 6 DRAW - 7 SOUND - 8 LOOP.
// ===============================================================

// --- 1. SETUP: canvas + named constants. Tweak the game here! ---
const canvas = document.getElementById("game"); // the <canvas> in index.html
const ctx = canvas.getContext("2d");            // our paintbrush

const CANVAS_WIDTH = 960;   // playfield width in pixels
const CANVAS_HEIGHT = 540;  // playfield height in pixels
const LEVEL_WIDTH = 6000;   // every level is this wide (camera scrolls)
const ZOOM = 1.4;           // camera zoom (bigger = closer, more dramatic)
const VIEW_W = CANVAS_WIDTH / ZOOM;  // how much world fits across the screen
const VIEW_H = CANVAS_HEIGHT / ZOOM; // ...and top to bottom
const GROUND_Y = 450;       // normal height of flat ground
const KILL_Y = 750;         // car below this line = fell: level fails
const FLAG_R = 110;         // finish zone around the flag (generous!)
const START_X = 120;        // car spawn x

const ENGINE = 0.35;        // acceleration while driving on the ground
const JUMP = 8;             // jump hop strength (Space / Up / W, grounded only)
const FLY_UP = 0.35, FLY_SIDE = 0.25; // fly-mode thrust: Up climbs, Down dives, Left/Right steer
const SPIKE_H = 24;         // spike teeth height (touch them and you are spiked!)
const AIR_ENGINE = 0.08;    // weak push while airborne
const HEAT_UP = 0.012, HEAT_DOWN = 0.05, HEAT_MIN = 0.25; // throttle heat: builds slow, cools fast, 25% instant
const AIR_PITCH = 0.008;    // airborne throttle trim: slow direct pitch, no spin momentum
const ACCEL_TILT = 0.022;   // throttle pitches the nose down (too much = endo!)
const TIPOVER = 0.010;      // gravity pulls a leaning car further over
const ALIGN = 0.2;          // self-righting strength (quits when past 90°)
const MAX_TILT = 0.15;      // fastest tilt (flips stay controllable)
const FLIP_ROLL = 0.12;     // level 6 auto-roll while falling up
const MAX_SPEED = 9;        // fastest horizontal speed (x car's speed stat)
const MAX_RISE = 18;        // fastest upward speed (room for big jumps)
const MAX_FALL = 15;        // fastest fall speed (tames wild bounces)
const WHEEL_R = 13;         // wheel radius
const WHEEL_FWD = 24;       // wheels sit 24px left/right of car center
const WHEEL_DOWN = 14;      // wheels sit 14px below car center
const BODY_R = 10;          // invisible body circle (stops body sinking)

const SETTLE_SPEED = 1.2;   // softer impacts settle instead of bouncing
const BOUNCE_MAX = 7;       // trampoline max launch (level 4 stays playable)
const FLIP_LIMIT = 100;     // ~1.6s upside down before you fail
const BRIDGE_DELAY = 30;    // plank falls 0.5s (30 frames) after you touch it
const CLEAR_WAIT = 120;     // 2s on "LEVEL CLEAR!" before the next level
const CELEBRATE_SPIN = 0.1; // victory backflip speed (radians per frame)
const CONFETTI = ["#ff5a4e", "#ffd23f", "#7dff7d", "#66e0ff", "#b18cff", "#ff5fd0"]; // party palette!
const BLOCK_HP = 2;         // hits each breaker block takes
const BLOCK_COOL = 6;       // frames between damage hits on one block
const FLIP_POINT = 0.6;     // level 6 flips gravity past 60% of the level
const FLIP_GRAVITY = -0.5;  // upside-down gravity after the flip
const SCORE_PER_PX = 0.1;   // +1 point per 10px of forward progress
const SCORE_SMASH = 25;     // +25 per breaker block smashed
const SCORE_CLEAR = 500;    // +500 level-clear bonus
const SCORE_COIN = 50;      // +50 per coin grabbed
const SCORE_JEWEL = 200;    // +200 per jewel grabbed
const SCORE_SPLAT = 100;    // +100 per baddie smashed with star power
const STAR_TIME = 300;      // star power lasts 5 seconds (300 frames)
const JEWEL_COINS = 3;      // a jewel banks 3 coins (coins bank 1)
const SHOP_JUMP_PRICE = 3;  // extra-jump BASE price (x level each time!)
const SHOP_SPEED_PRICE = 2; // speed BASE price (x level each time!)
const SHOP_POWER_PRICE = 2; // power BASE price (x level each time!)
const SHOP_HIGH_PRICE = 3;  // high-jump BASE price (x level each time!)
const SHOP_MAX_LEVEL = 5;   // every ability maxes at level 5
const SHOP_STEP = 0.1;      // each level = +10% (extra jump: +1 air jump per level!)
const BOOST_TIME = 300;     // X unleashes upgrades for 5 seconds...
const BOOST_COOL = 600;     // ...then a 10s cooldown (no mashing it permanent!)
const BEAST_GAP = 700;      // the beast starts this far behind you (your head start!)
const BEAST_R = 40;         // caught when the car is within this of the beast's edge
const BEAST_PACE = 0.92;    // relentless beast runs at 92% of YOUR top speed (it keeps up with boosts!)
const TIME_WARN = 10;       // timed levels beep the final 10 seconds
const REST_FRAMES = 15;     // hops need a 0.25s landing first (mashing jump can't fly!)

// --- 2. LEVELS: same shape, different soul. groundPoints = [x, y] dots;
// every pair of dots is one solid line; null = gap (a pit!). Friction,
// bounciness, gravity + gimmick make each level feel totally different. ---
// Shortcut builders so pickup lines stay tiny: coin(x) floats at drive
// height (y 400) unless you pass a custom y. Same for jewel(x, y).
const coin = (x, y = 400) => ({ x: x, y: y, kind: "coin" });
const jewel = (x, y = 400) => ({ x: x, y: y, kind: "jewel" });
const LEVELS = [
  { name: "Tutorial", message: "Jump the spikes! Grab the coins!",
    groundPoints: [[0, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "none",
    spikes: [{ x: 2000, y: GROUND_Y, w: 64 }, { x: 4900, y: GROUND_Y, w: 64 }], // your first spikes: small, friendly, hop them!
    pickups: [coin(600, 340), coin(1500, 340), coin(2500, 340), jewel(3200, 320), coin(3600, 340),
      coin(4700, 340), coin(5300, 340), coin(5600, 340)], // jump for them!
    powerups: [{ x: 800, y: 400, kind: "shield" }], // free shield: try it out!
    flag: { x: 5880, y: GROUND_Y } },
  { name: "The Collapse", message: "That bridge looks old... and mind the imp!",
    groundPoints: [[0, GROUND_Y], [2550, GROUND_Y], null, [3250, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "collapse",
    bridge: { from: 2550, to: 3250, size: 50 }, // 14 planks across the pit
    enemies: [
      { type: "imp", x: 1900, x1: 1900, x2: 2150, y: 438, r: 12, speed: 1 }, // first baddie: slow, hop it!
      { type: "imp", x: 3350, x1: 3350, x2: 3500, y: 438, r: 12, speed: 1 }, // second: hop it, then hop the spikes!
      { type: "imp", x: 4700, x1: 4700, x2: 4900, y: 438, r: 12, speed: 1 }, // encore: one more hop!
    ],
    spikes: [{ x: 3800, y: GROUND_Y, w: 96 }, { x: 5300, y: GROUND_Y, w: 96 }], // room to land from the imp hop, THEN jump!
    pickups: [coin(1500, 340), coin(2800, 340), coin(3050, 340), jewel(3800, 320),
      coin(4800, 340), coin(5400, 330), jewel(5600, 320)],
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Ice Road", message: "Ice road! Go gentle...",
    groundPoints: [[0, GROUND_Y], [600, GROUND_Y], [1000, 390], [1400, GROUND_Y],
      [3300, GROUND_Y], [3700, 390], [4100, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.05, bounciness: 0.1, gravity: 0.5, gimmick: "ice",
    spikes: [{ x: 1500, y: GROUND_Y, w: 80 }, { x: 5000, y: GROUND_Y, w: 80 }], // slippery AND spiky: plan ahead!
    pickups: [coin(800, 340), coin(2000, 340), coin(3000, 340), jewel(3700, 320),
      coin(4700, 340), coin(5400, 340), coin(5650, 340)],
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Bouncy Castle", message: "Boing! Go gentle!",
    groundPoints: [[0, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]], // flat + bouncy = trampoline!
    friction: 0.7, bounciness: 1.5, gravity: 0.5, gimmick: "bouncy",
    pickups: [coin(1000, 300), coin(2000, 300), coin(3000, 300), jewel(3500, 280),
      coin(4700, 300), coin(5100, 300), coin(5500, 300), jewel(5800, 280)], // boing for them!
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Breaker Wall", message: "SMASH through the wall! Mind the guard!",
    groundPoints: [[0, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "blocks",
    wall: { x: 3800, cols: 3, rows: 4, size: 26 }, // 3x4 = 12 blocks
    enemies: [{ type: "imp", x: 3550, x1: 3550, x2: 3700, y: 438, r: 12, speed: 1 }, // guard imp: hop it, then smash!
      { type: "imp", x: 5300, x1: 5300, x2: 5500, y: 438, r: 12, speed: 1 }], // the wall had a brother. Sorry.
    spikes: [{ x: 1500, y: GROUND_Y, w: 96 }, { x: 2900, y: GROUND_Y, w: 96 }, // warm up, then warm up again!
      { x: 4800, y: GROUND_Y, w: 96 }], // ...then warm down past the rubble!
    pickups: [coin(1000, 340), coin(2200, 340), coin(2900, 330), jewel(3800, 320),
      coin(4500, 340), coin(5400, 330), jewel(5650, 320)],
    powerups: [{ x: 3400, y: 400, kind: "shield" }], // armor up before the wall
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Inverted", message: "Halfway... something feels wrong...",
    groundPoints: [[0, GROUND_Y], [3650, GROUND_Y]], // ground ends after the flip...
    ceilingPoints: [[0, 130], [LEVEL_WIDTH, 130]],   // ...so you drive on this!
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "flip", flip: true, // flip: gravity reverses past 60%!
    pickups: [coin(1000, 340), coin(2000, 340), coin(3890, 240), coin(4300, 160), coin(4800, 160),
      coin(5200, 160), jewel(5600, 170)], // flip at 3600: rise gift, then ceiling drive-bys!
    flag: { x: 5880, y: 130, down: true } }, // flag hangs from the ceiling
  { name: "Leap of Faith", message: "Jump the gaps - press jump TWICE!",
    groundPoints: [[0, GROUND_Y], [700, GROUND_Y], null, [840, GROUND_Y], [1400, GROUND_Y],
      null, [1560, GROUND_Y], [3600, GROUND_Y], null, [3780, GROUND_Y], [4800, GROUND_Y],
      null, [4900, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]], // one last gap, far away!
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "pits",
    spikes: [{ x: 2600, y: GROUND_Y, w: 80 }, { x: 5400, y: GROUND_Y, w: 80 }], // something to do on the long cruise
    pickups: [coin(1000, 340), coin(770, 340), coin(1480, 340), jewel(2600, 320), coin(3690, 340),
      coin(4850, 340), coin(5440, 330), jewel(5600, 320)],
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Meltdown", message: "Ice, a bridge, AND spikes?!",
    groundPoints: [[0, GROUND_Y], [900, GROUND_Y], null, [1500, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.05, bounciness: 0.1, gravity: 0.5, gimmick: "collapse",
    bridge: { from: 900, to: 1500, size: 50 }, // 12 planks, zero grip. Good luck!
    spikes: [{ x: 2500, y: GROUND_Y, w: 80 }, { x: 3500, y: GROUND_Y, w: 80 }, { x: 4800, y: GROUND_Y, w: 80 }],
    pickups: [coin(1100, 340), coin(1300, 340), coin(2500, 330), jewel(3500, 320), coin(4000, 340),
      coin(4500, 340), coin(5300, 340), jewel(5600, 320)],
    powerups: [{ x: 1800, y: 400, kind: "star" }], // star power for the spike run!
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Devil's Kitchen", message: "EVERYTHING you learned. GO!",
    groundPoints: [[0, GROUND_Y], [1400, GROUND_Y], null, [1560, GROUND_Y], [3650, GROUND_Y]],
    ceilingPoints: [[0, 130], [LEVEL_WIDTH, 130]],
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "flip", flip: true,
    spikes: [{ x: 1100, y: GROUND_Y, w: 64 }, { x: 4300, y: 130, w: 80, down: true }], // ceiling teeth, past the landing!
    wall: { x: 4600, cols: 4, rows: 2, size: 26, baseY: 130 }, // wall ON the ceiling!
    pickups: [coin(800, 340), jewel(1480, 320), coin(3890, 240), coin(4300, 240), coin(5000, 160),
      coin(5400, 160), jewel(5650, 160)], // rise gift, dip prize, ceiling cruise!
    powerups: [{ x: 4250, y: 170, kind: "shield" }], // armor for the ceiling run
    flag: { x: 5880, y: 130, down: true } },
  { name: "Hopscotch", message: "Don't stop jumping!",
    groundPoints: [[0, GROUND_Y], [500, GROUND_Y], null, [620, GROUND_Y], [1200, GROUND_Y],
      null, [1360, GROUND_Y], [3500, GROUND_Y], null, [3680, GROUND_Y], [4800, GROUND_Y],
      null, [4920, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]], // hop... hop... hop... hop!
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "pits",
    spikes: [{ x: 900, y: GROUND_Y, w: 64 }, { x: 1700, y: GROUND_Y, w: 80 }, { x: 4000, y: GROUND_Y, w: 64 }], // room to land from the pit hop first!
    pickups: [coin(560, 340), coin(1280, 340), coin(3590, 340), jewel(1700, 320), coin(2500, 340),
      coin(4860, 340), coin(5300, 340), jewel(5600, 320)],
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Moon Shot", message: "Moon gravity - fly!",
    groundPoints: [[0, GROUND_Y], [700, GROUND_Y], null, [900, GROUND_Y], [3750, GROUND_Y],
      null, [3950, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.8, bounciness: 0.1, gravity: 0.25, gimmick: "moon", // floaty! (huge flights: obstacles far apart)
    spikes: [{ x: 1600, y: GROUND_Y, w: 80 }, { x: 5100, y: GROUND_Y, w: 80 }], // moon flights are HUGE: obstacles far apart!
    pickups: [coin(800, 300), jewel(1600, 300), coin(2500, 330), coin(3850, 300),
      coin(4600, 300), jewel(5100, 300), coin(5500, 330)],
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Hell Frozen Over", message: "Everything... on ICE.",
    groundPoints: [[0, GROUND_Y], [600, GROUND_Y], null, [760, GROUND_Y], [1100, GROUND_Y],
      null, [1500, GROUND_Y], [3650, GROUND_Y]],
    ceilingPoints: [[0, 130], [LEVEL_WIDTH, 130]],
    friction: 0.05, bounciness: 0.1, gravity: 0.5, gimmick: "collapse", flip: true, // bridge AND flip!
    bridge: { from: 1100, to: 1500, size: 50 }, // 8 planks, zero grip
    spikes: [{ x: 4300, y: 130, w: 80, down: true }], // spikes on the ceiling!
    wall: { x: 4600, cols: 4, rows: 2, size: 26, baseY: 130 },
    pickups: [coin(400, 340), coin(1250, 340), coin(3890, 240), coin(4300, 240), coin(5000, 160),
      coin(5400, 160), jewel(5650, 160)],
    powerups: [{ x: 4250, y: 170, kind: "shield" }], // you'll want this. Trust me.
    flag: { x: 5880, y: 130, down: true } },
  { name: "Imp Patrol", message: "Time your jumps! Dashers CHARGE!",
    groundPoints: [[0, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "imps",
    enemies: [
      { type: "imp", x: 700, x1: 700, x2: 950, y: 438, r: 12, speed: 1.5 },
      { type: "imp", x: 1400, x1: 1400, x2: 1650, y: 438, r: 12, speed: 1.5 },
      { type: "imp", x: 3600, x1: 3600, x2: 3850, y: 438, r: 12, speed: 1.5 },
      { type: "dasher", x: 2700, x1: 2700, x2: 2950, y: 437, r: 13, speed: 1 },
      { type: "imp", x: 4700, x1: 4700, x2: 4950, y: 438, r: 12, speed: 1.5 }, // the night shift!
    ],
    pickups: [coin(1200, 340), coin(1950, 340), coin(3250, 340), jewel(2825, 330),
      coin(4825, 330), coin(5300, 340), jewel(5600, 320)],
    powerups: [{ x: 2100, y: 400, kind: "star" }], // go splat some imps!
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Bat Cave", message: "Watch the bats! And the wisps!",
    groundPoints: [[0, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "bats",
    enemies: [
      { type: "bat", x: 900, baseY: 400, amp: 55, speed: 0.035, phase: 0, r: 15 },
      { type: "bat", x: 1600, baseY: 400, amp: 55, speed: 0.035, phase: 2.1, r: 15 },
      { type: "bat", x: 2900, baseY: 400, amp: 55, speed: 0.035, phase: 5.0, r: 15 },
      { type: "bat", x: 3800, baseY: 400, amp: 55, speed: 0.035, phase: 4.2, r: 15 },
      { type: "wisp", x: 2300, x1: 2150, x2: 2450, baseY: 350, amp: 40, speed: 0.04, phase: 1, drift: 1, r: 13 },
      { type: "bat", x: 4900, baseY: 400, amp: 55, speed: 0.035, phase: 3.3, r: 15 }, // one more bat for the road!
    ],
    pickups: [coin(900, 350), coin(1600, 350), coin(2900, 350), coin(3800, 350), jewel(2300, 330),
      coin(4900, 350), coin(5300, 350), jewel(5600, 330)], // hop AND time the bats!
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Demon Run", message: "Run the gauntlet!",
    groundPoints: [[0, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "gauntlet",
    enemies: [
      { type: "imp", x: 600, x1: 600, x2: 800, y: 438, r: 12, speed: 1.5 },
      { type: "imp", x: 1500, x1: 1500, x2: 1700, y: 438, r: 12, speed: 1.5 },
      { type: "dasher", x: 2600, x1: 2600, x2: 2800, y: 437, r: 13, speed: 1 },
      { type: "bat", x: 3600, baseY: 400, amp: 55, speed: 0.035, phase: 1, r: 15 },
      { type: "dasher", x: 4800, x1: 4800, x2: 5000, y: 437, r: 13, speed: 1 }, // the gauntlet's bouncer!
    ],
    spikes: [{ x: 3950, y: GROUND_Y, w: 64 }],
    pickups: [coin(1100, 340), coin(2100, 330), jewel(2700, 320), coin(3300, 340), coin(4100, 340),
      coin(4900, 330), jewel(5300, 320), coin(5600, 340)],
    powerups: [{ x: 3700, y: 400, kind: "shield" }],
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Sky High", message: "JUMP to take off - FLY with the arrows!",
    groundPoints: [[0, GROUND_Y], [600, GROUND_Y], null, [3700, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    ceilingPoints: [[0, 60], [LEVEL_WIDTH, 60]], // lid on the sky (no flip here: fly free!)
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "fly",
    spikes: [{ x: 1200, y: 260, w: 96 }, { x: 3200, y: 445, w: 96 }], // floating teeth: thread between!
    pickups: [coin(500, 380), coin(1500, 320), coin(2500, 320), jewel(3200, 300), coin(3550, 340), coin(4000, 340),
      coin(4700, 320), coin(5200, 320), jewel(5600, 300)], // already sky-high: flying earns them!
    powerups: [{ x: 4050, y: 380, kind: "shield" }], // soft landing gift
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Outrun The Beast", message: "IT MATCHES YOUR SPEED. DON'T STOP!",
    groundPoints: [[0, GROUND_Y], [1200, GROUND_Y], null, [1320, GROUND_Y], [2400, GROUND_Y],
      null, [2520, GROUND_Y], [3300, GROUND_Y], null, [3420, GROUND_Y], [4800, GROUND_Y],
      null, [4920, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]], // the beast loves long chases!
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "chase", chase: 2.5, relentless: true, // 92% of YOUR top speed. RUN!
    spikes: [{ x: 1800, y: GROUND_Y, w: 64 }, { x: 2900, y: GROUND_Y, w: 80 }, { x: 5400, y: GROUND_Y, w: 64 }],
    pickups: [coin(1260, 340), coin(2460, 340), coin(3360, 340), jewel(2900, 320), coin(2000, 340), coin(3900, 340),
      coin(4860, 340), coin(5440, 330), jewel(5650, 320)],
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Beat The Clock", message: "Grab the coins! BEAT THE CLOCK!",
    groundPoints: [[0, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "timed", time: 34, // 34 seconds or you die!
    enemies: [
      { type: "imp", x: 600, x1: 600, x2: 800, y: 438, r: 12, speed: 1.5 },
      { type: "imp", x: 1100, x1: 1100, x2: 1300, y: 438, r: 12, speed: 1.5 },
      { type: "imp", x: 1600, x1: 1600, x2: 1800, y: 438, r: 12, speed: 1.5 },
      { type: "imp", x: 2100, x1: 2100, x2: 2300, y: 438, r: 12, speed: 1.5 },
      { type: "imp", x: 2600, x1: 2600, x2: 2800, y: 438, r: 12, speed: 1.5 },
      { type: "dasher", x: 3000, x1: 3000, x2: 3200, y: 437, r: 13, speed: 1 },
      { type: "dasher", x: 3600, x1: 3600, x2: 3800, y: 437, r: 13, speed: 1 },
      { type: "dasher", x: 4200, x1: 4200, x2: 4400, y: 437, r: 13, speed: 1 }, // 600px apart: room to land, rest, re-hop!
      { type: "imp", x: 4700, x1: 4700, x2: 4900, y: 438, r: 12, speed: 1.5 },
      { type: "dasher", x: 5300, x1: 5300, x2: 5500, y: 437, r: 13, speed: 1 }, // the clock's bodyguards!
    ],
    pickups: [coin(700, 340), coin(900, 340), coin(1200, 340), coin(1400, 340), coin(1700, 340),
      coin(1900, 340), coin(2200, 340), coin(2400, 340), coin(2700, 340), coin(2900, 340),
      coin(3100, 330), coin(3700, 330), coin(4100, 340), coin(4300, 330), coin(3500, 340), coin(3900, 340),
      jewel(1500, 320), jewel(2500, 320), jewel(3300, 320),
      coin(4800, 330), coin(5400, 330), coin(5650, 340), jewel(5000, 320)], // coins over EVERY monster!
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Triple Dip", message: "Five pits! Find your rhythm!",
    groundPoints: [[0, GROUND_Y], [800, GROUND_Y], null, [900, GROUND_Y], [1225, GROUND_Y],
      null, [1325, GROUND_Y], [1650, GROUND_Y], null, [1750, GROUND_Y], [2075, GROUND_Y],
      null, [2175, GROUND_Y], [2500, GROUND_Y], null, [2600, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "pits", // 325px strips: room to land, rest, re-hop!
    pickups: [coin(850, 340), coin(1275, 340), coin(1700, 340), coin(2125, 340), coin(2550, 340),
      jewel(2950, 320), coin(3500, 340), coin(4500, 340), coin(5000, 340), jewel(5500, 320)], // victory lap coins!
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Spike Alley", message: "Hop... hop... hop...",
    groundPoints: [[0, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "spikes",
    spikes: [{ x: 800, y: GROUND_Y, w: 64 }, { x: 1400, y: GROUND_Y, w: 80 },
      { x: 2000, y: GROUND_Y, w: 64 }, { x: 2600, y: GROUND_Y, w: 96 }, { x: 3200, y: GROUND_Y, w: 80 },
      { x: 3800, y: GROUND_Y, w: 96 }, { x: 4400, y: GROUND_Y, w: 80 }], // the alley got LONGER!
    pickups: [coin(600, 340), coin(832, 330), coin(1440, 330), coin(2032, 330), coin(2648, 330),
      coin(3240, 330), coin(3848, 330), coin(4440, 330), coin(5000, 340), coin(5400, 340), jewel(5700, 320)],
    powerups: [{ x: 2300, y: 400, kind: "shield" }], // a breather gift, mid-alley
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Heavy Traffic", message: "Imps AND dashers! No timer. Breathe.",
    groundPoints: [[0, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "traffic",
    enemies: [
      { type: "imp", x: 600, x1: 600, x2: 800, y: 438, r: 12, speed: 1.5 },
      { type: "dasher", x: 1100, x1: 1100, x2: 1300, y: 437, r: 13, speed: 1 },
      { type: "imp", x: 1600, x1: 1600, x2: 1800, y: 438, r: 12, speed: 1.5 },
      { type: "dasher", x: 2100, x1: 2100, x2: 2300, y: 437, r: 13, speed: 1 },
      { type: "imp", x: 2600, x1: 2600, x2: 2800, y: 438, r: 12, speed: 1.5 },
      { type: "dasher", x: 3100, x1: 3100, x2: 3300, y: 437, r: 13, speed: 1 },
      { type: "imp", x: 3600, x1: 3600, x2: 3800, y: 438, r: 12, speed: 1.5 },
      { type: "dasher", x: 4100, x1: 4100, x2: 4300, y: 437, r: 13, speed: 1 }, // rush hour!
    ],
    pickups: [coin(700, 330), coin(1200, 330), coin(1700, 330), coin(2200, 330), coin(2700, 330),
      coin(3200, 330), jewel(3600, 320), coin(3700, 330), coin(4200, 330), coin(4800, 340),
      coin(5300, 340), jewel(5600, 320)],
    powerups: [{ x: 1800, y: 400, kind: "star" }], // go splat the traffic!
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Moon Base", message: "Low gravity. High wall. SMASH!",
    groundPoints: [[0, GROUND_Y], [1500, GROUND_Y], null, [1700, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.8, bounciness: 0.1, gravity: 0.25, gimmick: "moon", // floaty smashing!
    wall: { x: 3500, cols: 3, rows: 4, size: 26 },
    spikes: [{ x: 2500, y: GROUND_Y, w: 64 }, { x: 4800, y: GROUND_Y, w: 64 }], // floaty encore!
    pickups: [coin(800, 330), coin(1600, 300), coin(2500, 320), coin(3000, 330), jewel(3500, 320),
      coin(4500, 330), coin(4840, 320), jewel(5400, 320), coin(5650, 330)],
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Bouncy Bridge", message: "The bridge is a trampoline. Whee!",
    groundPoints: [[0, GROUND_Y], [1800, GROUND_Y], null, [2300, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.7, bounciness: 1.2, gravity: 0.5, gimmick: "bouncy", // planks bounce too. WHEE!
    bridge: { from: 1800, to: 2300, size: 50 }, // 10 VERY springy planks
    // NO spikes past the bridge: the whole level is a trampoline. Just boing!
    pickups: [coin(1000, 340), coin(2050, 340), coin(2600, 360), coin(2900, 360), coin(3200, 360),
      coin(3600, 340), jewel(3800, 320), coin(4240, 340), coin(4800, 340), coin(5300, 340), jewel(5650, 320)], // bounce-field coins!
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Night Shift", message: "Nothing but wings. Time them all!",
    groundPoints: [[0, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "night",
    enemies: [
      { type: "bat", x: 800, baseY: 400, amp: 55, speed: 0.035, phase: 0, r: 15 },
      { type: "bat", x: 1500, baseY: 400, amp: 55, speed: 0.035, phase: 2, r: 15 },
      { type: "bat", x: 2200, baseY: 400, amp: 55, speed: 0.035, phase: 4, r: 15 },
      { type: "bat", x: 2900, baseY: 400, amp: 55, speed: 0.035, phase: 1, r: 15 },
      { type: "wisp", x: 1150, x1: 1000, x2: 1300, baseY: 350, amp: 40, speed: 0.04, phase: 1, drift: 1, r: 13 },
      { type: "wisp", x: 2550, x1: 2400, x2: 2700, baseY: 350, amp: 40, speed: 0.04, phase: 3, drift: 1, r: 13 },
      { type: "bat", x: 3600, baseY: 400, amp: 55, speed: 0.035, phase: 5, r: 15 },
      { type: "wisp", x: 4300, x1: 4150, x2: 4450, baseY: 350, amp: 40, speed: 0.04, phase: 0, drift: 1, r: 13 }, // overtime!
    ],
    pickups: [coin(800, 350), coin(1500, 350), coin(2200, 350), coin(2900, 350), jewel(1850, 330),
      coin(3600, 350), coin(4300, 350), jewel(5000, 330), coin(5500, 350)],
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Upside Down Town", message: "Three dips! Mind the ceiling teeth!",
    groundPoints: [[0, GROUND_Y], [3650, GROUND_Y]],
    ceilingPoints: [[0, 130], [LEVEL_WIDTH, 130]],
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "flip", flip: true,
    spikes: [{ x: 1100, y: GROUND_Y, w: 64 },
      { x: 3800, y: 130, w: 64, down: true }, { x: 4600, y: 130, w: 64, down: true },
      { x: 5300, y: 130, w: 64, down: true }], // THREE dips now (one is a rise flyby)!
    pickups: [coin(800, 340), coin(2000, 340), coin(3890, 240), coin(4300, 160), coin(4600, 240),
      coin(5000, 160), coin(5300, 240), jewel(5650, 160)],
    powerups: [{ x: 4550, y: 170, kind: "shield" }], // grab it mid-dip, thank me later
    flag: { x: 5880, y: 130, down: true } },
  { name: "Stormy Skies", message: "Storm! Thread the teeth!",
    groundPoints: [[0, GROUND_Y], [600, GROUND_Y], null, [3700, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    ceilingPoints: [[0, 60], [LEVEL_WIDTH, 60]], // lid on the sky (no flip: fly free!)
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "fly",
    spikes: [{ x: 1200, y: 260, w: 96 }, { x: 2100, y: 445, w: 96 }, { x: 2900, y: 260, w: 96 }], // slalom!
    pickups: [coin(500, 380), coin(1500, 320), coin(2500, 320), coin(3300, 340), coin(4000, 340),
      jewel(2100, 300), coin(4700, 320), coin(5200, 340), jewel(5600, 300)], // clear skies, full pockets!
    powerups: [{ x: 4050, y: 380, kind: "shield" }],
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Run The Line", message: "Imps AND the beast?! RUN!",
    groundPoints: [[0, GROUND_Y], [2000, GROUND_Y], null, [2120, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "gauntlet", chase: 2.5,
    enemies: [
      { type: "imp", x: 1000, x1: 1000, x2: 1200, y: 438, r: 12, speed: 1.5 },
      { type: "imp", x: 1600, x1: 1600, x2: 1800, y: 438, r: 12, speed: 1.5 },
      { type: "imp", x: 2600, x1: 2600, x2: 2800, y: 438, r: 12, speed: 1.5 },
      { type: "imp", x: 3200, x1: 3200, x2: 3400, y: 438, r: 12, speed: 1.5 },
      { type: "dasher", x: 3800, x1: 3800, x2: 4000, y: 437, r: 13, speed: 1 },
      { type: "imp", x: 4700, x1: 4700, x2: 4900, y: 438, r: 12, speed: 1.5 }, // last guard before home!
    ],
    pickups: [coin(1100, 330), coin(1700, 330), coin(2700, 330), coin(3300, 330), coin(3900, 330),
      jewel(2400, 320), coin(4800, 330), coin(5300, 340), jewel(5600, 320)],
    flag: { x: 5880, y: GROUND_Y } },
  { name: "Final Exam", message: "Everything. 54 seconds. GO!",
    groundPoints: [[0, GROUND_Y], [800, GROUND_Y], null, [1200, GROUND_Y], [LEVEL_WIDTH, GROUND_Y]],
    friction: 0.8, bounciness: 0.1, gravity: 0.5, gimmick: "final", time: 54, // the clock is ticking!
    bridge: { from: 800, to: 1200, size: 50 }, // 8 planks
    spikes: [{ x: 1600, y: GROUND_Y, w: 64 }, { x: 3500, y: GROUND_Y, w: 80 }, { x: 4500, y: GROUND_Y, w: 80 }],
    enemies: [
      { type: "imp", x: 2000, x1: 2000, x2: 2200, y: 438, r: 12, speed: 1.5 },
      { type: "imp", x: 2400, x1: 2400, x2: 2600, y: 438, r: 12, speed: 1.5 },
      { type: "imp", x: 5000, x1: 5000, x2: 5200, y: 438, r: 12, speed: 1.5 }, // one last pop quiz!
    ],
    wall: { x: 3000, cols: 3, rows: 4, size: 26 }, // 12 blocks
    pickups: [coin(1000, 340), coin(1600, 330), coin(2100, 330), coin(2500, 330), coin(3500, 330),
      coin(4000, 340), jewel(3000, 320), coin(4540, 330), coin(5100, 330), jewel(5350, 320), coin(5600, 340)],
    powerups: [{ x: 1350, y: 400, kind: "star" }, { x: 2800, y: 400, kind: "shield" }],
    flag: { x: 5880, y: GROUND_Y } },
];

// --- 3. INPUT: which keys are held? e.code names the key ("ArrowRight"). ---
const keys = {};
let jumpQueued = false; // a FRESH jump press (held keys don't retrigger: for double jump)
window.addEventListener("keydown", (e) => {
  if (!keys[e.code] && (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW")) jumpQueued = true;
  keys[e.code] = true;
  initAudio(); // browsers unlock sound on the first keypress
  if (e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "ArrowUp" || e.code === "ArrowDown" || e.code === "Space") e.preventDefault(); // no page scroll
  if (e.code === "KeyM") muted = !muted; // M toggles all sound
  if (state === "menu") { // menu keys: Left/Right paint, Up/Down body, 4-8 shop, Enter starts
    if (e.code === "ArrowLeft") { paint = (paint + PAINTS.length - 1) % PAINTS.length; saveShop(); }
    if (e.code === "ArrowRight") { paint = (paint + 1) % PAINTS.length; saveShop(); }
    if (e.code === "ArrowUp") { style = (style + STYLES.length - 1) % STYLES.length; saveShop(); }
    if (e.code === "ArrowDown") { style = (style + 1) % STYLES.length; saveShop(); }
    if (e.code === "Digit4") buyShop("jump"); // 3 coins: TRIPLE jump, forever!
    if (e.code === "Digit5") buyShop("speed"); // 2 coins: 20% faster, forever!
    if (e.code === "Digit6") buyShop("power"); // 2 coins: stronger engine, forever!
    if (e.code === "Digit7") buyShop("high"); // 3 coins: higher jumps, forever!
    if (e.code === "Digit8") buyStyle(); // buy the selected body style!
    if (e.code === "Backspace") { confirmReset = true; return; } // reset popup!
    if (confirmReset) { // popup open: only Y/N/Esc work!
      if (e.code === "KeyY") resetSave(); // Y: wipe it all!
      if (e.code === "KeyN" || e.code === "Escape") confirmReset = false; // N: phew!
      return;
    }
    if (e.code === "Enter" || e.code === "Space") {
      if (!ownedStyles[style] && !buyStyle()) return; // broke? no test drives!
      score = 0; collected = 0; powered = 0; loadLevel(0);
    }
    return;
  }
  if (e.code === "KeyR") restartLevel();
  if (e.code === "KeyN") nextLevel();
  if (e.code === "KeyX") boost(); // X unleashes your upgrades (in play)!
  if (e.code === "Digit0") { boardTop = loadScores(); state = "menu"; } // 0: menu, anytime!
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; });

// --- 4. STATE + LOADER: variables + loadLevel() builds from LEVELS. ---
let levelIndex = 0;    // which level (0 to 5)
let level = LEVELS[0]; // shortcut to the current level object
let state = "play";    // "play" | "clear" | "fail" | "win"
let failReason = "";   // text for the fail screen ("YOU FELL!"...)
let frame = 0;         // frames since level load (drives all timers)
let clearTimer = 0;    // counts up on the "LEVEL CLEAR!" screen
let gravityNow = 0.5;  // gravity right now (flips mid-level in level 6)
let flipped = false;   // has the level-6 flip happened yet?
let flipMsg = 0;       // "GRAVITY FLIP!" banner timer
let camX = 0;          // camera: top-left corner of the view (world x)
let camY = 200;        // ...and world y (follows the car up and down)
let ceilTop = -9999;   // ceiling height, if the level has one (for the safety net)
let solids = [];       // every collidable line: ground + ceiling + planks
let planks = [];       // level 2 bridge planks (each can fall)
let blocks = [];       // level 5 breaker blocks (each has HP)
let parts = [];        // debris particles (block chunks, crash burst)
let rings = [];        // explosion shockwave rings (expanding circles)
let wreck = [];        // blown-apart car chunks (body, window, wheels)
let enemies = [];      // live enemies (fresh copies built from level data)
let shake = 0;         // screen shake (kicks on death, fades away)
let stars = [];        // background stars, made once at the bottom
let car = {};          // the car, built fresh in loadLevel()
let paint = 0;         // paint-shop color index (0-7). One car, your color!
let style = 0;         // body-style index (0-3). Looks only: zero stat changes!
let ownedStyles = [true, false, false, false]; // Sedan is free; the rest cost coins
let score = 0;         // your points! progress + coins + smashing + clear bonuses
let scoreAtLevelStart = 0; // retrying (R) rolls the score back to this
let bestX = START_X;   // furthest x reached this level (progress points!)
let pickups = [];      // live coins/jewels (fresh copies from level data)
let powerups = [];     // live shield/star orbs (fresh copies from level data)
let beastX = -BEAST_GAP; // the chase monster's front edge (levels with chase: set)
let timeLeft = 0;        // timed levels: frames left on the clock (0 = no limit)
let lastTick = -1;       // last countdown second we beeped (so it beeps once!)
let collected = 0;     // coins + jewels grabbed this run (for the win screen!)
let powered = 0;       // power-ups grabbed this run

// --- LEADERBOARD: top 5 scores live in localStorage, so they survive
// reloading the page. Each entry is { score, car }. lastRank remembers
// where YOUR latest win landed (0 = didn't make the board).
const BEST_KEY = "devilDriveBest";
let boardTop = [];     // cached top 5 (refreshed on win + menu)
let lastRank = 0;
function loadScores() {
  try {
    const list = JSON.parse(localStorage.getItem(BEST_KEY));
    return Array.isArray(list) ? list : [];
  } catch (e) { return []; } // no storage (private mode?): play without saving
}
function saveScore() {
  const entry = { score: Math.floor(score), paint: PAINTS[paint].name, style: STYLES[style].name };
  const list = loadScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score); // biggest first!
  boardTop = list.slice(0, 5);
  lastRank = boardTop.indexOf(entry) + 1; // 0 = cut from the board
  try { localStorage.setItem(BEST_KEY, JSON.stringify(boardTop)); } catch (e) {}
}

// --- COIN SHOP: coins you grab go in a piggy bank (saved!). Spend them
// in the car menu (keys 4 and 5) on PERMANENT upgrades for every car.
let coinBank = 0;   // your savings, across all runs
let owned = { jump: 0, speed: 0, power: 0, high: 0 }; // upgrade LEVELS you bought (0-5!)
function loadShop() {
  try {
    coinBank = JSON.parse(localStorage.getItem("devilDriveCoins")) || 0;
    const o = JSON.parse(localStorage.getItem("devilDriveShop"));
    if (o) for (const k of ["jump", "speed", "power", "high"]) {
      if (o[k] === true) owned[k] = 1; // grandpa's save file: true = level 1
      else if (Number.isInteger(o[k])) owned[k] = clamp(o[k], 0, SHOP_MAX_LEVEL);
    }
    const pt = JSON.parse(localStorage.getItem("devilDrivePaint"));
    if (Number.isInteger(pt)) paint = clamp(pt, 0, PAINTS.length - 1);
    const st = JSON.parse(localStorage.getItem("devilDriveStyle"));
    if (Number.isInteger(st)) style = clamp(st, 0, STYLES.length - 1);
    const os = JSON.parse(localStorage.getItem("devilDriveStyles"));
    if (Array.isArray(os)) for (let i = 0; i < ownedStyles.length; i++) ownedStyles[i] = os[i] === true;
    ownedStyles[0] = true; // the Sedan is always yours
  } catch (e) {} // no storage: shop just won't save
}
function saveShop() {
  try {
    localStorage.setItem("devilDriveCoins", JSON.stringify(coinBank));
    localStorage.setItem("devilDriveShop", JSON.stringify(owned));
    localStorage.setItem("devilDrivePaint", JSON.stringify(paint));
    localStorage.setItem("devilDriveStyle", JSON.stringify(style));
    localStorage.setItem("devilDriveStyles", JSON.stringify(ownedStyles));
  } catch (e) {}
}
function shopPrice(which) { // level 1 costs base, level 2 costs 2x base...
  const base = { jump: SHOP_JUMP_PRICE, speed: SHOP_SPEED_PRICE, power: SHOP_POWER_PRICE, high: SHOP_HIGH_PRICE }[which];
  return base * (owned[which] + 1);
}
function buyShop(which) { // menu keys 4-7 call this. Returns true if bought!
  if (owned[which] >= SHOP_MAX_LEVEL || coinBank < shopPrice(which)) { sfx("deny"); return false; }
  coinBank -= shopPrice(which); owned[which]++; saveShop(); sfx("power");
  return true;
}
function boost() { // X: unleash ALL owned upgrades for 5 seconds!
  if (state !== "play") return;
  const hasAny = owned.jump + owned.speed + owned.power + owned.high > 0;
  if (!hasAny || car.boostT > 0 || car.boostCD > 0) { if (hasAny) sfx("deny"); return; }
  car.boostT = BOOST_TIME; car.boostCD = BOOST_COOL; sfx("power");
}

// --- PAINT SHOP: one car, 8 colors! Left/Right picks. Saved like the shop.
const PAINTS = [
  { name: "Red", color: "#e53030" }, { name: "Blue", color: "#2f7fe5" },
  { name: "Green", color: "#3fbf5f" }, { name: "Gold", color: "#ffd23f" },
  { name: "Purple", color: "#b18cff" }, { name: "Cyan", color: "#66e0ff" },
  { name: "Orange", color: "#ff7f2f" }, { name: "Pink", color: "#ff5fd0" },
];

// --- BODY SHOP: 4 looks, same car underneath! Up/Down picks, 8 buys.
// Every body fits the same footprint (58 wide, wheels at +-24), so the
// physics never changes: you are paying for style, not speed.
const STYLES = [
  { name: "Sedan", price: 0 },
  { name: "Truck", price: 5 },
  { name: "Racer", price: 10 },
  { name: "Buggy", price: 15 },
];
function buyStyle() { // menu key 8: buy the selected body (or just admire it)
  if (ownedStyles[style] || coinBank < STYLES[style].price) { sfx("deny"); return false; }
  coinBank -= STYLES[style].price; ownedStyles[style] = true; saveShop(); sfx("power");
  return true;
}
let confirmReset = false; // reset popup open? (Backspace opens it, Y wipes!)
function resetSave() { // Y in the reset popup: wipe coins, scores, upgrades, paint, body!
  coinBank = 0; owned = { jump: 0, speed: 0, power: 0, high: 0 }; paint = 0; style = 0;
  ownedStyles = [true, false, false, false]; boardTop = []; lastRank = 0;
  try {
    localStorage.removeItem("devilDriveCoins"); localStorage.removeItem("devilDriveShop");
    localStorage.removeItem("devilDrivePaint"); localStorage.removeItem("devilDriveStyle");
    localStorage.removeItem("devilDriveStyles"); localStorage.removeItem(BEST_KEY); // scores too!
  } catch (e) {}
  confirmReset = false; saveShop(); sfx("deny");
}

// Your car's abilities: balanced base (1.0), times shop levels ONLY while
// the X-boost is burning! (Upgrades stay OFF by default: they can kill you.)
function carSpec(active) {
  const on = active ? 1 : 0;
  return {
    speed: 1 + on * owned.speed * SHOP_STEP,
    power: 1 + on * owned.power * SHOP_STEP,
    jump: 1 + on * owned.high * SHOP_STEP,
  };
}

// Dots -> solid lines. A null dot means gap, so we skip that pair.
function addPointsAsSegments(points, isCeiling) {
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    if (a === null || b === null) continue;
    solids.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1], ceil: isCeiling });
  }
}

// Build level i: ground lines, planks, blocks, fresh car. Restarting just
// calls this again, so no junk carries over from the last try.
function loadLevel(i) {
  for (const k in keys) keys[k] = false; // forget held keys (no instant jump!)
  jumpQueued = false;
  levelIndex = i; level = LEVELS[i];
  state = "play"; frame = 0; clearTimer = 0; flipped = false; flipMsg = 0;
  gravityNow = level.gravity;
  scoreAtLevelStart = score; bestX = START_X; // bank the score; progress starts here
  beastX = START_X - BEAST_GAP; // the beast waits behind the start line...
  timeLeft = level.time ? level.time * 60 : 0; lastTick = -1; // wind the clock (if any)!
  planks = []; blocks = []; parts = []; rings = []; wreck = []; shake = 0; solids = [];
  camX = 0; camY = 200;
  enemies = (level.enemies || []).map((e) => ({ ...e, dir: 1 })); // fresh copies: patrols reset every retry
  pickups = (level.pickups || []).map((p) => ({ ...p, taken: false })); // coins come back on retry
  powerups = (level.powerups || []).map((p) => ({ ...p, taken: false }));
  addPointsAsSegments(level.groundPoints, false);
  ceilTop = level.ceilingPoints ? level.ceilingPoints[0][1] : -9999; // ceilings are flat: first dot's y
  if (level.ceilingPoints) addPointsAsSegments(level.ceilingPoints, true);
  if (level.bridge) { // lay planks across the pit (any level can have one!)
    for (let x = level.bridge.from; x < level.bridge.to; x += level.bridge.size) {
      const p = { x1: x, y1: GROUND_Y, x2: x + level.bridge.size, y2: GROUND_Y,
        ceil: false, touchedAt: -1, falling: false, fallY: 0, fallV: 0 };
      planks.push(p); solids.push(p);
    }
  }
  if (level.wall) { // stack a block wall (on the ground, or hanging from a ceiling!)
    const top = level.wall.baseY !== undefined ? level.wall.baseY : GROUND_Y - level.wall.rows * level.wall.size;
    for (let c = 0; c < level.wall.cols; c++) {
      for (let r = 0; r < level.wall.rows; r++) {
        blocks.push({ x: level.wall.x + c * level.wall.size, y: top + r * level.wall.size,
          w: level.wall.size, h: level.wall.size, hp: BLOCK_HP, cool: 0, dead: false });
      }
    }
  }
  car = { x: START_X, y: GROUND_Y - 60, vx: 0, vy: 0, angle: 0, angVel: 0, spin: 0,
    onGround: false, slope: 0, onCeil: false, upside: 0, roofHit: false, heat: 0, jumpT: 0,
    shield: false, starT: 0, airJumps: 0, restT: 0, airT: 0,
    boostT: 0, boostCD: 0 }; // boostT: X unleashed! boostCD: cooldown after
}

// R: restart this level (score rolls back: no farming points by dying!).
// On the win screen, R goes back to the car menu instead.
function restartLevel() {
  if (state === "win") { boardTop = loadScores(); state = "menu"; } // menu shows the board
  else { score = scoreAtLevelStart; loadLevel(levelIndex); }
}

// N: skip ahead (for testing). Works even after a crash.
function nextLevel() {
  if (state === "win") return;
  if (levelIndex + 1 < LEVELS.length) loadLevel(levelIndex + 1);
  else { state = "win"; saveScore(); sfx("win"); } // champion! record it!
}

// --- 5. PHYSICS: gravity, driving, circle-vs-segment collisions. ---
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); } // keep v between lo-hi

// Blend angle a toward b (the loops fix the -PI/PI wraparound).
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// World spot of one wheel (-1 rear, +1 front): rotate offsets, add car pos.
function wheelPos(side) {
  const c = Math.cos(car.angle), s = Math.sin(car.angle);
  const ox = side * WHEEL_FWD, oy = WHEEL_DOWN;
  return { x: car.x + ox * c - oy * s, y: car.y + ox * s + oy * c };
}

// Push a circle (wheel/body) out of one segment. Hit -> {angle, support}
// (support = does it hold us up vs gravity?); miss -> null.
function hitSegment(wx, wy, r, s) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  let t = ((wx - s.x1) * dx + (wy - s.y1) * dy) / (dx * dx + dy * dy);
  t = clamp(t, 0, 1); // closest point must stay ON the segment
  const px = s.x1 + dx * t, py = s.y1 + dy * t;
  let nx = wx - px, ny = wy - py; // surface normal: ground -> circle
  const dist = Math.hypot(nx, ny);
  if (dist >= r || dist === 0) return null;
  nx /= dist; ny /= dist;
  car.x += nx * (r - dist); car.y += ny * (r - dist); // 1) push out
  const vn = car.vx * nx + car.vy * ny; // speed "into the ground"
  if (vn < 0) { // 2) bounce it, 3) rub the along-ground part with friction
    let out = -vn * level.bounciness;
    if (-vn < SETTLE_SPEED) out = 0; // gentle touches settle: no jitter
    out = Math.min(out, BOUNCE_MAX);
    if (out > 3) sfx("boing"); else if (-vn > 6) sfx("thud"); // big bounce? hard landing?
    car.vx += (out - vn) * nx; car.vy += (out - vn) * ny;
    const tx = -ny, ty = nx, vt = car.vx * tx + car.vy * ty;
    car.vx -= vt * level.friction * 0.02 * tx; // small! both wheels do this
    car.vy -= vt * level.friction * 0.02 * ty;
  }
  if (s.touchedAt === -1) s.touchedAt = frame; // plank collapse timer starts
  return { angle: Math.atan2(dy, dx), support: ny * (gravityNow >= 0 ? -1 : 1) };
}

// Both wheels + body vs every solid line. Wheels plant the car; the body
// only stops sinking - except on the L6 ceiling, where the roof can plant.
function collideCar() {
  car.onGround = false;
  car.roofHit = false;
  for (const side of [-1, 1]) {
    for (const s of solids) {
      if (s.falling) continue;
      const w = wheelPos(side), hit = hitSegment(w.x, w.y, WHEEL_R, s);
      if (hit && hit.support > 0.25) { car.onGround = true; car.slope = hit.angle; car.onCeil = !!s.ceil; }
    }
  }
  for (const s of solids) {
    if (s.falling) continue;
    const hit = hitSegment(car.x, car.y, BODY_R, s);
    if (hit && hit.support > 0.25 && s.ceil && gravityNow < 0) {
      car.onGround = true; car.slope = hit.angle; car.onCeil = true;
    }
    // Roof slam: body touches normal ground while upside down = instant death.
    // (Ceiling touches don't count: level 6 lands its roof on purpose.)
    if (hit && !s.ceil && Math.cos(car.angle) < 0) car.roofHit = true;
  }
}

// One physics step: gravity, drive/tilt, move, collide, win/fail checks.
function updateCar() {
  const spec = carSpec(car.boostT > 0); // upgrades only bite while X burns!
  const flying = level.gimmick === "fly" && !car.onGround; // jumped in a sky level: you're flying!
  if (flying) car.vy *= 0.94; // no gravity up here, just gentle drag
  else car.vy += gravityNow;
  const grip = 0.25 + level.friction; // ice = weak engine, grippy = strong
  const topSpeed = MAX_SPEED * spec.speed;
  const speedLean = 0.4 + 0.6 * Math.abs(car.vx) / topSpeed; // faster = tippier
  if (keys["ArrowRight"] && car.onGround) car.heat = Math.min(1, car.heat + HEAT_UP); // pinned throttle heats up...
  else car.heat = Math.max(0, car.heat - HEAT_DOWN); // ...lifting cools it fast
  const heatTilt = HEAT_MIN + (1 - HEAT_MIN) * car.heat; // lean ramps up the longer you pin it
  const wantJump = keys["Space"] || keys["ArrowUp"] || keys["KeyW"];
  if (keys["ArrowLeft"]) {
    if (car.onGround) { // (jumping locks tilt torque out, even with arrows held)
      car.vx -= ENGINE * grip * spec.power * spec.speed; // boosted brakes match boosted engine!
      if (!wantJump) car.angVel -= ACCEL_TILT * 0.6 * speedLean; // braking lifts the nose
    }
    else if (!flying) { car.vx -= AIR_ENGINE; car.angle -= AIR_PITCH; } // airborne trim (fly mode steers below)
  }
  if (keys["ArrowRight"]) {
    if (car.onGround) {
      car.vx += ENGINE * grip * spec.power * spec.speed;
      if (!wantJump) car.angVel += ACCEL_TILT * speedLean * heatTilt; // throttle dives the nose, slowly more
    }
    else if (!flying) { car.vx += AIR_ENGINE; car.angle += AIR_PITCH; } // jump stays spin-locked, but throttle still pitches
  }
  if (!car.onGround && !flipped && car.jumpT > 0) car.angVel = 0; // mid-jump = spin locked (trim above still applies)
  if (flying) { // FLY MODE: arrows pilot the car (Up climbs, Down dives, sides steer)
    if (keys["ArrowUp"]) car.vy -= FLY_UP;
    if (keys["ArrowDown"]) car.vy += FLY_UP;
    if (keys["ArrowLeft"]) car.vx -= FLY_SIDE;
    if (keys["ArrowRight"]) car.vx += FLY_SIDE;
    car.angle = lerpAngle(car.angle, clamp(car.vy * 0.04, -0.4, 0.4), 0.1); // nose follows the climb
  }
  if (flipped && !car.onGround) car.angVel = FLIP_ROLL; // auto-roll to land on ceiling
  if (wantJump && car.onGround && car.restT <= 0) {
    car.vy = car.onCeil ? JUMP * spec.jump : -JUMP * spec.jump; // jump! pure lift...
    car.jumpT = 120; // ...and locked rotation until touchdown
    jumpQueued = false; // this press is spent (no instant double jump!)
    sfx("jump");
  }
  if (jumpQueued) { // DOUBLE JUMP: a fresh press mid-air leaps again (X + levels = more!)
    jumpQueued = false;
    const airCap = 1 + (car.boostT > 0 ? owned.jump : 0); // base double +1 per jump level!
    if (!car.onGround && car.airT >= 6 && car.restT <= 0 && car.airJumps < airCap) { // airT>=6 + rested: bounce-mashing can't burn the double!
      car.airJumps++;
      car.vy = (flying || !flipped) ? -JUMP * spec.jump * 0.9 : JUMP * spec.jump * 0.9;
      car.jumpT = 120; // rotation stays locked, same as jump one
      burst(car.x, car.y + 20, "#ffffff", 6, 4); // poof under your wheels!
      sfx("jump");
    }
  }
  if (car.onGround && !keys["ArrowLeft"] && !keys["ArrowRight"]) car.vx *= 1 - level.friction * 0.03; // coasting drag
  car.vx = clamp(car.vx, -topSpeed, topSpeed);
  car.vy = clamp(car.vy, -MAX_RISE, MAX_FALL);
  car.angVel = clamp(car.angVel, -MAX_TILT, MAX_TILT);
  car.x += car.vx; car.y += car.vy; car.angle += car.angVel; car.spin += car.vx * 0.06;
  const wasGround = car.onGround;
  collideCar();
  if (!car.onGround && wasGround) car.angVel = 0; // takeoff bleeds spin: jumps fly straight
  if (!car.onGround) car.airT++; // count this flight's length...
  else {
    if (!wasGround) { // touchdown!
      car.jumpT = 0;
      if (car.airT >= 6) car.restT = REST_FRAMES; // real landing: rest! (plank-seam flickers don't count)
      car.airT = 0;
    }
    if (car.restT <= 0) car.airJumps = 0; // fully rested on the ground: double jump recharges!
  }
  if (car.restT > 0) car.restT--; // landing rest ticks always (landing bounces don't extend it!)
  if (car.starT > 0) { // star power ticks down, with a gold sparkle trail
    car.starT--;
    if (frame % 4 === 0) burst(car.x - 20, car.y, "#ffe066", 1, 5);
  }
  if (car.boostT > 0) car.boostT--; // X-burn ticks down...
  else if (car.boostCD > 0) car.boostCD--; // ...then the cooldown ticks down
  if (level.time) { // timed level: the clock is ticking. Zero = death!
    timeLeft--;
    const secs = Math.ceil(timeLeft / 60);
    if (secs <= TIME_WARN && secs !== lastTick && timeLeft > 0) { lastTick = secs; sfx("tick"); } // final countdown!
    if (timeLeft <= 0) return fail("OUT OF TIME!");
  }
  car.vx = clamp(car.vx, -topSpeed, topSpeed); // bounces add speed: clamp again
  car.vy = clamp(car.vy, -MAX_RISE, MAX_FALL);
  if (car.roofHit && !flipped) return fail("UPSIDE DOWN!"); // (after a flip, upside down is correct!)
  if (flipped && car.y < ceilTop + 20) { car.y = ceilTop + 20; car.vy = Math.max(car.vy, 0); } // safety net: never pass through the ceiling
  if (car.onGround) { // balance like a broom: small leans self-fix, big leans fall over
    const target = car.onCeil ? car.slope + Math.PI : car.slope;
    let lean = target - car.angle;
    while (lean > Math.PI) lean -= Math.PI * 2;
    while (lean < -Math.PI) lean += Math.PI * 2;
    car.angle = lerpAngle(car.angle, target, ALIGN * Math.max(0, Math.cos(lean)));
    car.angVel += TIPOVER * Math.sin(-lean); // gravity tips a leaning car further
    car.angVel *= 0.5;
  } else car.angVel *= 0.99;
  car.x = clamp(car.x, 20, LEVEL_WIDTH - 20);
  if (car.x > bestX) { score += (car.x - bestX) * SCORE_PER_PX; bestX = car.x; } // points for pushing forward!
  const death = updateGimmicks();
  if (death) return fail(death); // spikes and enemies kill: hop over, dodge past!
  const f = level.flag; // win: close to the flag?
  if (Math.hypot(car.x - f.x, car.y - f.y) < FLAG_R) {
    state = "clear"; clearTimer = 0; score += SCORE_CLEAR; // LEVEL CLEAR + 500!
    burst(f.x, f.y, "#ffd23f", 24); confetti(f.x, f.y - 60, 60); sfx("clear"); // gold boom + confetti!
  }
  if (Math.cos(car.angle) < 0 && !flipped) car.upside++; else car.upside = 0;
  if (car.upside > FLIP_LIMIT) return fail("FLIPPED OVER!");
  if (car.y > KILL_Y) return fail("YOU FELL!");
}

// Per-level tricks: spikes, enemies, planks, blocks, gravity flip.
// Returns a death message when something killed the car, else null.
function updateGimmicks() {
  if (level.chase) { // THE BEAST: ever-advancing doom. Don't stop moving!
    // Relentless levels: the beast matches 92% of YOUR top speed (boost and it keeps up!)
    const pace = level.relentless ? MAX_SPEED * carSpec(car.boostT > 0).speed * BEAST_PACE : level.chase;
    beastX += pace;
    if (car.x < beastX + BEAST_R) return "THE BEAST GOT YOU!";
    if (car.x < beastX + 400 && sfxCool <= 0) { sfxCool = 90; sfx("roar"); } // too close?!
  }
  if (level.spikes) { // any wheel/body overlap with a spike strip = death
    for (const s of level.spikes) {
      // Forgiving hitbox: slightly smaller than the teeth you see.
      // down:true hangs teeth DOWN from a ceiling instead of up from ground.
      const top = s.down ? s.y : s.y - SPIKE_H + 4;
      const r = { x: s.x + 6, y: top, w: s.w - 12, h: SPIKE_H - 4 };
      const w1 = wheelPos(-1), w2 = wheelPos(1);
      const hit = pushOutOfRect(w1.x, w1.y, WHEEL_R, r) || pushOutOfRect(w2.x, w2.y, WHEEL_R, r) ||
          pushOutOfRect(car.x, car.y, BODY_R + 6, r);
      if (!hit) continue;
      if (car.starT > 0) { burst(car.x, car.y, "#ffe066", 6, 5); continue; } // STAR: smash through!
      if (car.shield) { // shield eats the hit and pops!
        car.shield = false; sfx("shieldoff"); burst(car.x, car.y, "#66ccff", 12, 6); continue;
      }
      return "SPIKED!";
    }
  }
  for (const e of enemies) { // imps pace, dashers charge, bats bob, wisps drift
    if (e.dead) continue; // splatted by star power: gone!
    if (e.type === "imp") {
      e.x += e.dir * e.speed;
      if (e.x < e.x1) { e.x = e.x1; e.dir = 1; }
      if (e.x > e.x2) { e.x = e.x2; e.dir = -1; }
    } else if (e.type === "dasher") { // strolls... until you get close. Then it CHARGES!
      const near = Math.abs(car.x - e.x) < 250 && Math.abs(car.y - e.y) < 80;
      if (near) e.dir = car.x >= e.x ? 1 : -1; // face the car!
      e.x += e.dir * e.speed * (near ? 2.5 : 1);
      if (e.x < e.x1) { e.x = e.x1; if (!near) e.dir = 1; } // pinned but charging: keep glaring!
      if (e.x > e.x2) { e.x = e.x2; if (!near) e.dir = -1; }
    } else if (e.type === "wisp") { // sine hover + slow drift, ping-pongs its lane
      e.phase += e.speed;
      e.y = e.baseY + Math.sin(e.phase) * e.amp;
      e.x += e.dir * e.drift;
      if (e.x < e.x1) { e.x = e.x1; e.dir = 1; }
      if (e.x > e.x2) { e.x = e.x2; e.dir = -1; }
    } else {
      e.phase += e.speed;
      e.y = e.baseY + Math.sin(e.phase) * e.amp;
    }
  }
  if (enemies.length) { // touching an enemy = death. Dodge! (or star-splat it)
    const w1 = wheelPos(-1), w2 = wheelPos(1);
    for (const e of enemies) {
      if (e.dead) continue;
      if (circleHit(w1.x, w1.y, WHEEL_R, e.x, e.y, e.r) ||
          circleHit(w2.x, w2.y, WHEEL_R, e.x, e.y, e.r) ||
          circleHit(car.x, car.y, BODY_R + 6, e.x, e.y, e.r)) {
        if (car.starT > 0) { // SPLAT! star power turns YOU into the weapon
          e.dead = true; score += SCORE_SPLAT;
          burst(e.x, e.y, "#ffe066", 10, 6); sfx("smash"); continue;
        }
        if (car.shield) { // shield eats the hit and pops!
          car.shield = false; sfx("shieldoff"); burst(car.x, car.y, "#66ccff", 12, 6); continue;
        }
        if (e.type === "imp") return "CAUGHT BY AN IMP!";
        if (e.type === "dasher") return "DASHER GOT YOU!";
        if (e.type === "wisp") return "WISP BURN!";
        return "BAT SLAM!";
      }
    }
  }
  { // coins, jewels, power-ups: drive through them to grab them!
    const w1 = wheelPos(-1), w2 = wheelPos(1);
    const grabs = (x, y) => circleHit(w1.x, w1.y, WHEEL_R + 14, x, y, 10) ||
      circleHit(w2.x, w2.y, WHEEL_R + 14, x, y, 10) ||
      circleHit(car.x, car.y, BODY_R + 20, x, y, 10);
    for (const p of pickups) {
      if (p.taken || !grabs(p.x, p.y)) continue;
      p.taken = true; collected++;
      coinBank += p.kind === "jewel" ? JEWEL_COINS : 1; saveShop(); // coins go in the bank!
      score += p.kind === "jewel" ? SCORE_JEWEL : SCORE_COIN;
      sfx(p.kind === "jewel" ? "jewel" : "coin");
      burst(p.x, p.y, p.kind === "jewel" ? "#66e0ff" : "#ffd23f", 8, 5);
    }
    for (const p of powerups) {
      if (p.taken || !grabs(p.x, p.y)) continue;
      p.taken = true; powered++;
      if (p.kind === "shield") car.shield = true; else car.starT = STAR_TIME;
      sfx("power");
      burst(p.x, p.y, p.kind === "shield" ? "#66ccff" : "#ffe066", 12, 6);
    }
  }
  for (const p of planks) { // touched planks fall 0.5s later. Troll!
    if (!p.falling && p.touchedAt >= 0 && frame - p.touchedAt > BRIDGE_DELAY) { p.falling = true; sfx("plank"); }
    if (p.falling) { p.fallV += 0.5; p.fallY += p.fallV; }
  }
  for (const b of blocks) { // grind through: each overlap costs the block HP
    if (b.dead) continue;
    if (b.cool > 0) b.cool--;
    const w1 = wheelPos(-1), w2 = wheelPos(1);
    if (pushOutOfRect(w1.x, w1.y, WHEEL_R, b) || pushOutOfRect(w2.x, w2.y, WHEEL_R, b) ||
        pushOutOfRect(car.x, car.y, BODY_R + 6, b)) {
      car.vx *= 0.97;
      if (b.cool <= 0) {
        b.cool = BLOCK_COOL; b.hp--; sfx("smash");
        if (b.hp <= 0) { b.dead = true; score += SCORE_SMASH; burst(b.x + b.w / 2, b.y + b.h / 2, "#ff7847", 8); }
      }
    }
  }
  if (level.flip && !flipped && car.x > LEVEL_WIDTH * FLIP_POINT) {
    flipped = true; gravityNow = FLIP_GRAVITY; flipMsg = 150; sfx("flip"); // GRAVITY FLIP!
  }
  if (flipMsg > 0) flipMsg--;
  updateParts();
  return null; // still alive!
}

// Circle-vs-circle: do these two balls overlap?
function circleHit(x1, y1, r1, x2, y2, r2) {
  const dx = x1 - x2, dy = y1 - y2;
  return dx * dx + dy * dy < (r1 + r2) * (r1 + r2);
}

// Push a circle out of a rectangle. True = they overlapped.
function pushOutOfRect(cx, cy, r, b) {
  const nx = clamp(cx, b.x, b.x + b.w), ny = clamp(cy, b.y, b.y + b.h);
  const dx = cx - nx, dy = cy - ny, d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 === 0) { car.y -= r; return true; }
  const d = Math.sqrt(d2);
  car.x += (dx / d) * (r - d); car.y += (dy / d) * (r - d);
  return true;
}

// Debris falls and fades; rings expand; wreck chunks tumble with gravity.
function updateParts() {
  for (const p of parts) { p.vy += 0.3; p.x += p.vx; p.y += p.vy; p.life--; }
  parts = parts.filter((p) => p.life > 0);
  for (const r of rings) { r.r += 5; r.life--; }
  rings = rings.filter((r) => r.life > 0);
  for (const w of wreck) { w.vy += 0.4; w.x += w.vx; w.y += w.vy; w.angle += w.spin; w.vx *= 0.99; w.life--; }
  wreck = wreck.filter((w) => w.life > 0);
}

// Party time! n rainbow confetti squares that flutter down slowly.
function confetti(x, y, n) {
  for (let i = 0; i < n; i++) {
    parts.push({ x: x + (Math.random() - 0.5) * 120, y: y + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 3, vy: Math.random() * -3 - 0.5,
      life: 90 + Math.random() * 60, color: CONFETTI[i % CONFETTI.length], size: 5 });
  }
}

// Spawn n colored debris squares at (x, y). Bigger size = chunkier fire!
function burst(x, y, color, n, size = 6) {
  for (let i = 0; i < n; i++) {
    parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 6, vy: Math.random() * -4 - 1,
      life: 40 + Math.random() * 20, color: color, size: size });
  }
}

// Crash with a reason for the fail screen: big fire + the car flies apart!
function fail(reason) {
  state = "fail"; failReason = reason;
  burst(car.x, car.y, "#ffdd55", 14, 8); burst(car.x, car.y, "#ff9933", 14, 8);
  burst(car.x, car.y, "#ff5522", 14, 8); burst(car.x, car.y, "#555555", 10, 7);
  spawnWreck(); // the car itself blows apart!
  rings.push({ x: car.x, y: car.y, r: 6, life: 30 });
  rings.push({ x: car.x, y: car.y, r: 6, life: 48 }); // second, slower ring
  shake = 18;
  if (reason === "SPIKED!") sfx("clang"); // metallic shriek first
  sfx("crash"); boom();
}

// Blow the car apart: body, window, and both wheels become tumbling debris.
// (Each chunk starts where that part sits on the car, then flies free.)
function spawnWreck() {
  wreck = [];
  const c = Math.cos(car.angle), s = Math.sin(car.angle);
  const bits = [{ ox: 0, oy: 0, kind: "body" }, { ox: 1, oy: -12, kind: "window" },
    { ox: -WHEEL_FWD, oy: WHEEL_DOWN, kind: "wheel" }, { ox: WHEEL_FWD, oy: WHEEL_DOWN, kind: "wheel" }];
  for (const b of bits) {
    wreck.push({ x: car.x + b.ox * c - b.oy * s, y: car.y + b.ox * s + b.oy * c,
      vx: car.vx * 0.4 + (Math.random() - 0.5) * 7, vy: -3 - Math.random() * 4,
      angle: car.angle, spin: (Math.random() - 0.5) * 0.4, life: 110, kind: b.kind });
  }
}

// Every frame: physics, or the "LEVEL CLEAR!" countdown. Camera follows.
function update() {
  frame++;
  if (sfxCool > 0) sfxCool--; // shared sound cooldown ticks down
  if (shake > 0.3) shake *= 0.88; else shake = 0; // screen shake fades fast
  engineUpdate(); // vroom.
  if (state === "play") {
    updateCar();
    camX = clamp(car.x - VIEW_W / 2, 0, LEVEL_WIDTH - VIEW_W); // follow left-right
    camY = clamp(car.y - VIEW_H * 0.55, -120, 500); // ...and up-down (car below center)
  } else if (state === "clear") {
    clearTimer++; updateParts();
    car.angle -= CELEBRATE_SPIN; // victory backflip while the crowd goes wild!
    if (clearTimer % 12 === 0) confetti(car.x, car.y - 80, 6); // steady confetti rain
    if (clearTimer > CLEAR_WAIT) nextLevel();
  } else if (state === "fail") {
    updateParts(); // explosion keeps animating behind the fail text
  }
}

// --- 6. DRAW: sky, ground, car, flag, text. translate(-camX, 0) shifts
// the whole world left so the car stays on screen while world-x works. ---
function draw() {
  if (state === "menu") { drawSky(); drawMenu(); return; } // garage first!
  drawSky();
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  ctx.save();
  ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2); ctx.scale(ZOOM, ZOOM); // zoom in!
  ctx.translate(-(camX + VIEW_W / 2) + sx, -(camY + VIEW_H / 2) + sy); // ...on the car
  drawGround(); drawPlanks(); drawBlocks(); drawBeast(); drawSpikes(); drawPickups(); drawEnemies(); drawFlag(); drawParts();
  if (state === "fail") drawWreck(); else drawCar(); // exploded? draw the chunks!
  ctx.restore();
  drawHUD(); drawOverlay();
}

// Night sky: red gradient, twinkling stars, devil moon, parallax hills.
function drawSky() {
  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  sky.addColorStop(0, "#12060f"); sky.addColorStop(0.6, "#33101d"); sky.addColorStop(1, "#571b22");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "#ffd9a0";
  for (const s of stars) {
    ctx.globalAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(frame * 0.05 + s.x));
    ctx.fillRect(s.x, s.y, 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ff4d4d";
  ctx.beginPath(); ctx.arc(830, 90, 42, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#d63a3a";
  ctx.beginPath(); ctx.arc(815, 80, 9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(845, 100, 6, 0, Math.PI * 2); ctx.fill();
  drawHills(0.25 * ZOOM, 380, "#2a0f22", 90); drawHills(0.5 * ZOOM, 430, "#1c0a18", 70);
}

// Round hill silhouettes. factor < 1 scrolls slower (parallax); % wraps seamlessly.
function drawHills(factor, baseY, color, r) {
  ctx.fillStyle = color;
  const off = camX * factor;
  for (let x = -r; x < CANVAS_WIDTH + r; x += r) {
    ctx.beginPath(); ctx.arc(x - (off % r), baseY, r * 0.9, Math.PI, 0); ctx.fill();
  }
}

// Ground: filled earth + bright rim. Colors come from the gimmick.
function drawGround() {
  let dirt = "#5b3a29", rim = "#8a5a3b";
  if (level.friction < 0.2) { dirt = "#9fd8ef"; rim = "#ffffff"; } // slippery = icy
  if (level.gravity < 0.5 && level.gravity > 0) { dirt = "#8a8a9a"; rim = "#e8e8f2"; } // floaty = moon-gray
  if (level.gimmick === "bouncy") { dirt = "#e8641f"; rim = "#ffd23f"; }
  if (level.gimmick === "flip") { dirt = "#3b2a55"; rim = "#b18cff"; }
  for (const s of solids) {
    if (s.touchedAt !== undefined) continue; // planks draw themselves
    ctx.fillStyle = dirt;
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2);
    if (!s.ceil) { ctx.lineTo(s.x2, 1200); ctx.lineTo(s.x1, 1200); }
    else { ctx.lineTo(s.x2, -600); ctx.lineTo(s.x1, -600); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rim; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    if (level.gimmick === "bouncy") { // yellow castle stripes along the top
      ctx.fillStyle = "#ffd23f";
      for (let x = s.x1 + 20; x < s.x2; x += 80) {
        const t = (x - s.x1) / (s.x2 - s.x1);
        ctx.fillRect(x, s.y1 + (s.y2 - s.y1) * t - 14, 34, 14);
      }
    }
  }
}

// Bridge planks: wobble when touched, then plunge.
function drawPlanks() {
  for (const p of planks) {
    if (p.fallY > 900) continue;
    const shake = (!p.falling && p.touchedAt >= 0) ? Math.random() * 4 - 2 : 0;
    const y = p.y1 - 8 + p.fallY + shake;
    ctx.fillStyle = p.touchedAt >= 0 ? "#a86a2c" : "#c98a3f";
    ctx.fillRect(p.x1 + 1, y, p.x2 - p.x1 - 2, 10);
    ctx.strokeStyle = "#5e3a17"; ctx.lineWidth = 2;
    ctx.strokeRect(p.x1 + 1, y, p.x2 - p.x1 - 2, 10);
  }
}

// Breaker blocks: orange, cracked at 1 HP, gone at 0.
function drawBlocks() {
  for (const b of blocks) {
    if (b.dead) continue;
    ctx.fillStyle = b.hp >= BLOCK_HP ? "#ff7847" : "#ffb347";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = "#7a2d12"; ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    if (b.hp < BLOCK_HP) {
      ctx.beginPath(); ctx.moveTo(b.x + 4, b.y + 4); ctx.lineTo(b.x + b.w - 4, b.y + b.h - 4); ctx.stroke();
    }
  }
}

// Spikes: a row of sharp 16px teeth. Touch them and you are spiked!
// down:true teeth hang from a ceiling (level 9!) instead of the ground.
function drawSpikes() {
  if (!level.spikes) return;
  for (const s of level.spikes) {
    const tip = s.down ? s.y + SPIKE_H : s.y - SPIKE_H; // where tooth tips point
    for (let x = s.x; x < s.x + s.w; x += 16) {
      ctx.fillStyle = "#c0c0c0";
      ctx.beginPath(); ctx.moveTo(x, s.y); ctx.lineTo(x + 8, tip); ctx.lineTo(x + 16, s.y); ctx.fill();
      ctx.strokeStyle = "#550000"; ctx.lineWidth = 2; ctx.stroke();
    }
  }
}

// Enemies: pacing imps (red, horned) and bobbing bats (dark, flapping).
// The beast: a wall of living darkness with teeth and glowing red eyes.
// It covers everything behind it, so RUN!
function drawBeast() {
  if (!level.chase) return;
  ctx.fillStyle = "#0d0208";
  ctx.fillRect(beastX - 1200, -300, 1200, 1100);
  ctx.fillStyle = "#3d0a1e"; // jagged teeth along the front edge
  for (let y = -260; y < 700; y += 90) {
    ctx.beginPath(); ctx.moveTo(beastX, y); ctx.lineTo(beastX + 46, y + 45); ctx.lineTo(beastX, y + 90); ctx.fill();
  }
  ctx.fillStyle = "#ff2f2f"; // glowing eyes watching you
  for (let i = 0; i < 6; i++) {
    const ex = beastX - 60 - (i % 3) * 90, ey = 120 + Math.floor(i / 3) * 160 + (i % 2) * 40;
    ctx.beginPath(); ctx.arc(ex, ey, 9, 0, Math.PI * 2); ctx.fill();
  }
}

// Coins spin, jewels sparkle, power-ups bob. Taken ones vanish!
function drawPickups() {
  for (const p of pickups) {
    if (p.taken) continue;
    const y = p.y + Math.sin(frame * 0.1 + p.x) * 4; // gentle hover
    if (p.kind === "coin") {
      const squish = Math.abs(Math.cos(frame * 0.08 + p.x)); // spin: wide <-> thin
      ctx.fillStyle = "#b8860b";
      ctx.beginPath(); ctx.ellipse(p.x, y, 10, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath(); ctx.ellipse(p.x, y, 4 + 6 * squish, 10, 0, 0, Math.PI * 2); ctx.fill();
    } else { // jewel: cyan diamond + white sparkle dot
      ctx.fillStyle = "#66e0ff";
      ctx.beginPath(); ctx.moveTo(p.x, y - 12); ctx.lineTo(p.x + 9, y);
      ctx.lineTo(p.x, y + 12); ctx.lineTo(p.x - 9, y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#e8fbff"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#ffffff"; ctx.fillRect(p.x - 2, y - 6, 4, 4);
    }
  }
  for (const p of powerups) {
    if (p.taken) continue;
    const y = p.y + Math.sin(frame * 0.08 + p.x) * 5;
    if (p.kind === "shield") { // blue orb in a ring: armor in a bubble!
      ctx.strokeStyle = "#66ccff"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, y, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#1a5f9e";
      ctx.beginPath(); ctx.arc(p.x, y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c8ecff";
      ctx.beginPath(); ctx.arc(p.x - 2, y - 2, 3, 0, Math.PI * 2); ctx.fill();
    } else { // star: 10-point zigzag path, gold and glowing
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? 14 : 6, a = -Math.PI / 2 + i * Math.PI / 5;
        if (i === 0) ctx.moveTo(p.x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else ctx.lineTo(p.x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fillStyle = "#ffe066"; ctx.fill();
      ctx.strokeStyle = "#b8860b"; ctx.lineWidth = 2; ctx.stroke();
    }
  }
}

function drawEnemies() {
  for (const e of enemies) {
    if (e.dead) continue; // splatted: don't draw the ghost!
    if (e.type === "dasher") { // purple bruiser with a mohawk: it CHARGES!
      ctx.fillStyle = "#7a1f5e";
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#3d0e2e"; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#ff5fd0"; // mohawk fin
      ctx.beginPath(); ctx.moveTo(e.x - 6, e.y - e.r + 3); ctx.lineTo(e.x, e.y - e.r - 9);
      ctx.lineTo(e.x + 6, e.y - e.r + 3); ctx.fill();
      const f = e.dir >= 0 ? 1 : -1; // white glaring eyes
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(e.x + f * 5 - 4, e.y - 2, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + f * 5 + 4, e.y - 2, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111111";
      ctx.beginPath(); ctx.arc(e.x + f * 6 - 4, e.y - 2, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + f * 6 + 4, e.y - 2, 1.8, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === "wisp") { // spooky glow-ball: halo + core + eyes
      ctx.fillStyle = "rgba(102, 224, 255, 0.3)";
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c8f4ff";
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#2a7a9e"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#0e2a3d";
      ctx.beginPath(); ctx.arc(e.x - 4, e.y - 2, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + 4, e.y - 2, 2.4, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === "imp") {
      ctx.fillStyle = "#c22a2a";
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#5e0e0e"; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#ffd23f"; // little horns
      ctx.beginPath(); ctx.moveTo(e.x - 8, e.y - e.r + 2); ctx.lineTo(e.x - 4, e.y - e.r - 8); ctx.lineTo(e.x, e.y - e.r + 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(e.x, e.y - e.r + 2); ctx.lineTo(e.x + 4, e.y - e.r - 8); ctx.lineTo(e.x + 8, e.y - e.r + 2); ctx.fill();
      const f = e.dir >= 0 ? 1 : -1; // angry eyes look where it's walking
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(e.x + f * 5 - 4, e.y - 2, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + f * 5 + 4, e.y - 2, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111111";
      ctx.beginPath(); ctx.arc(e.x + f * 6 - 4, e.y - 2, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + f * 6 + 4, e.y - 2, 1.8, 0, Math.PI * 2); ctx.fill();
    } else {
      const flap = Math.sin(frame * 0.3 + e.phase) * 12; // wings flap with time
      ctx.fillStyle = "#3a2a55"; // two triangle wings first (behind the body)
      ctx.beginPath(); ctx.moveTo(e.x - 6, e.y); ctx.lineTo(e.x - 28, e.y - 6 - flap); ctx.lineTo(e.x - 8, e.y + 8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(e.x + 6, e.y); ctx.lineTo(e.x + 28, e.y - 6 - flap); ctx.lineTo(e.x + 8, e.y + 8); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#150f25"; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#ff2f2f"; // glowing red eyes
      ctx.beginPath(); ctx.arc(e.x - 5, e.y - 2, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + 5, e.y - 2, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// Checkered flag (hangs from the ceiling in level 6).
function drawFlag() {
  const f = level.flag, dir = f.down ? 1 : -1;
  ctx.strokeStyle = "#e8e8e8"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x, f.y + dir * 80); ctx.stroke();
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath(); ctx.arc(f.x, f.y + dir * 80, 5, 0, Math.PI * 2); ctx.fill();
  const top = dir === -1 ? f.y - 80 : f.y;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? "#111111" : "#ffffff";
      ctx.fillRect(f.x + c * 10, top + r * 10, 10, 10);
    }
  }
}

// One devil-horn triangle pair, sitting on top of y (every body wears them!).
function drawHorns(x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x - 6, y - 7); ctx.lineTo(x - 3, y); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 3, y); ctx.lineTo(x + 6, y - 7); ctx.lineTo(x + 9, y); ctx.fill();
}

// The body art for style s, drawn around (0, 0). Looks ONLY: every style
// fits the same 58x16 footprint, so wheels and physics never notice.
function drawBodyArt(s, color, trim) {
  ctx.fillStyle = color; ctx.strokeStyle = "#401010";
  if (s === 1) { // TRUCK: flat bed at the back, tall cab up front
    ctx.fillRect(-29, -4, 36, 12); ctx.lineWidth = 3; ctx.strokeRect(-29, -4, 36, 12);
    ctx.fillStyle = trim; ctx.fillRect(-29, 2, 36, 4); // stripe along the bed
    ctx.fillStyle = color; ctx.fillRect(4, -24, 25, 32); ctx.strokeRect(4, -24, 25, 32); // the cab
    ctx.fillStyle = "#9fd8ef"; ctx.fillRect(7, -21, 16, 9); // windshield
    ctx.strokeStyle = "#401010"; ctx.lineWidth = 2; ctx.strokeRect(7, -21, 16, 9);
    ctx.fillStyle = "#fff8d0"; ctx.fillRect(26, 0, 4, 5); // headlight!
    drawHorns(16, -24, trim); // horns on the cab roof
  } else if (s === 2) { // RACER: low wedge + rear spoiler, built for speed (looks!)
    ctx.beginPath(); ctx.moveTo(-29, 8); ctx.lineTo(29, 8); ctx.lineTo(20, -6); ctx.lineTo(-22, -6);
    ctx.closePath(); ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = trim; ctx.fillRect(-22, 2, 48, 3); // stripe
    ctx.fillStyle = "#9fd8ef"; ctx.fillRect(-9, -14, 18, 8); // cockpit
    ctx.strokeStyle = "#401010"; ctx.lineWidth = 2; ctx.strokeRect(-9, -14, 18, 8);
    ctx.fillStyle = color; ctx.fillRect(20, -18, 5, 14); // spoiler strut...
    ctx.fillRect(12, -23, 22, 5); ctx.strokeRect(12, -23, 22, 5); // ...and wing!
    drawHorns(0, -14, trim); // horns on the cockpit
  } else if (s === 3) { // BUGGY: open frame, roll cage, and a devil driver!
    ctx.fillRect(6, -4, 23, 12); ctx.lineWidth = 3; ctx.strokeRect(6, -4, 23, 12); // nose
    ctx.fillRect(-20, -4, 24, 12); ctx.strokeRect(-20, -4, 24, 12); // seat tub
    ctx.fillStyle = trim; ctx.fillRect(-20, 2, 49, 3); // stripe
    ctx.fillStyle = color; ctx.fillRect(-18, -24, 5, 22); ctx.fillRect(-2, -24, 5, 22); // cage bars
    ctx.fillRect(-18, -26, 21, 5); // cage roof
    ctx.fillStyle = "#9fd8ef"; // the driver's helmet...
    ctx.beginPath(); ctx.arc(-10, -12, 7, 0, Math.PI * 2); ctx.fill();
    drawHorns(-10, -18, trim); // ...WITH HORNS. Obviously.
  } else { // SEDAN: the classic rectangle + window + stripe
    ctx.fillRect(-29, -8, 58, 16); ctx.lineWidth = 3; ctx.strokeRect(-29, -8, 58, 16);
    ctx.fillStyle = trim; ctx.fillRect(-29, 2, 58, 4); // racing stripe!
    ctx.fillStyle = "#9fd8ef"; ctx.fillRect(-10, -16, 22, 9); // window
    ctx.strokeStyle = "#401010"; ctx.lineWidth = 2; ctx.strokeRect(-10, -16, 22, 9);
    drawHorns(1, -16, trim); // horns!
  }
}

// The car: style body + two spinning wheels, in your paint color.
function drawCar() {
  const spec = { color: PAINTS[paint].color, trim: "#ffd23f" }; // your paint!
  ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);
  drawBodyArt(style, spec.color, spec.trim); // your body style!
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * WHEEL_FWD, WHEEL_DOWN); ctx.rotate(car.spin);
    ctx.fillStyle = "#222222";
    ctx.beginPath(); ctx.arc(0, 0, WHEEL_R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#000000"; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = "#bbbbbb"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  if (car.shield) { // bubble shield ring (drawn unrotated, around the car)
    ctx.strokeStyle = "rgba(102, 204, 255, 0.8)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(car.x, car.y, 42, 0, Math.PI * 2); ctx.stroke();
  }
  if (car.starT > 0) { // star power: flashing gold ring!
    if (Math.floor(frame / 4) % 2 === 0) {
      ctx.strokeStyle = "#ffe066"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(car.x, car.y, 46, 0, Math.PI * 2); ctx.stroke();
    }
  }
  if (car.boostT > 0) { // X-boost: white-hot ring!
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(car.x, car.y, 50, 0, Math.PI * 2); ctx.stroke();
  }
}

// The blown-apart car: tumbling body chunk, window, and both wheels.
function drawWreck() {
  const spec = { color: PAINTS[paint].color, trim: "#ffd23f" }; // your paint, in pieces!
  for (const w of wreck) {
    ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.angle);
    ctx.globalAlpha = clamp(w.life / 40, 0, 1);
    if (w.kind === "wheel") {
      ctx.fillStyle = "#222222";
      ctx.beginPath(); ctx.arc(0, 0, WHEEL_R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#bbbbbb"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
    } else if (w.kind === "window") {
      ctx.fillStyle = "#9fd8ef"; ctx.fillRect(-11, -4, 22, 9); // a shard of glass
    } else {
      drawBodyArt(style, spec.color, spec.trim); // your body, in pieces!
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// Debris squares + shockwave rings, fading out.
function drawParts() {
  for (const p of parts) {
    ctx.globalAlpha = clamp(p.life / 40, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  for (const r of rings) {
    ctx.globalAlpha = clamp(r.life / 30, 0, 1);
    ctx.strokeStyle = "#ffcc66"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// HUD: level name top-left, hints top-right, banners.
function drawHUD() {
  ctx.textBaseline = "top";
  ctx.font = "bold 20px system-ui, sans-serif"; // outlined text reads over sky
  ctx.lineWidth = 4; ctx.strokeStyle = "#000000";
  const left = level.name + "  (Level " + (levelIndex + 1) + " / " + LEVELS.length + ")";
  ctx.strokeText(left, 12, 10); ctx.fillStyle = "#ffffff"; ctx.fillText(left, 12, 10);
  ctx.font = "16px system-ui, sans-serif";
  const scoreLine = "SCORE " + Math.floor(score) + "   COINS " + coinBank;
  ctx.strokeText(scoreLine, 12, 36); ctx.fillStyle = "#ffd23f"; ctx.fillText(scoreLine, 12, 36);
  let powerLine = "", powerColor = "#ffffff";
  const hasUp = owned.jump + owned.speed + owned.power + owned.high > 0;
  if (car.boostT > 0) { powerLine = "BOOST " + Math.ceil(car.boostT / 60) + "s!"; powerColor = "#ffe066"; }
  else if (car.starT > 0) { powerLine = "STAR " + Math.ceil(car.starT / 60) + "s!"; powerColor = "#ffe066"; }
  else if (car.shield) { powerLine = "SHIELD!"; powerColor = "#66ccff"; }
  else if (car.boostCD > 0 && hasUp) { powerLine = "BOOST..." + Math.ceil(car.boostCD / 60) + "s"; powerColor = "#8a6f5f"; }
  else if (hasUp) { powerLine = "X: BOOST!"; powerColor = "#7dff7d"; }
  if (powerLine) { ctx.strokeText(powerLine, 12, 58); ctx.fillStyle = powerColor; ctx.fillText(powerLine, 12, 58); }
  const right = "R: restart   N: skip", w = ctx.measureText(right).width;
  ctx.strokeText(right, CANVAS_WIDTH - w - 12, 12);
  ctx.fillStyle = "#ffd9a0"; ctx.fillText(right, CANVAS_WIDTH - w - 12, 12);
  if (state === "play" && frame < 240) centerText(level.message, 120, 30, "#ffffff");
  if (flipMsg > 0) centerText("GRAVITY FLIP!", 200, 54, "#b18cff");
  if (level.chase && state === "play" && car.x < beastX + 400) centerText("RUN!", 200, 54, "#ff2f2f");
  if (level.time && state === "play") centerText("TIME " + Math.max(0, Math.ceil(timeLeft / 60)), 36, 26,
    timeLeft < TIME_WARN * 60 ? "#ff3b3b" : "#ffffff"); // the clock! (red when low)
  // Progress bar (top center): your car dot races the little checkered flag!
  const barW = 300, barX = (CANVAS_WIDTH - barW) / 2, barY = 70;
  const prog = clamp((car.x - START_X) / (level.flag.x - START_X), 0, 1); // 0 = start, 1 = flag!
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; ctx.fillRect(barX - 4, barY - 4, barW + 8, 22); // plate
  ctx.fillStyle = "#333344"; ctx.fillRect(barX, barY, barW, 14); // empty track
  ctx.fillStyle = "#7dff7d"; ctx.fillRect(barX, barY, barW * prog, 14); // driven part!
  ctx.fillStyle = PAINTS[paint].color; // your car dot, in your paint!
  ctx.beginPath(); ctx.arc(barX + barW * prog, barY + 7, 7, 0, Math.PI * 2); ctx.fill();
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) { // tiny checkered flag!
    ctx.fillStyle = (r + c) % 2 === 0 ? "#111111" : "#ffffff";
    ctx.fillRect(barX + barW + 8 + c * 7, barY + r * 7, 7, 7);
  }
}

// Big centered outlined text (banners + overlays).
function centerText(text, y, size, color) {
  ctx.font = "bold " + size + "px system-ui, sans-serif";
  ctx.textAlign = "center"; ctx.lineWidth = 6; ctx.strokeStyle = "#000000";
  ctx.strokeText(text, CANVAS_WIDTH / 2, y);
  ctx.fillStyle = color; ctx.fillText(text, CANVAS_WIDTH / 2, y);
  ctx.textAlign = "left";
}

// Dim + big message for LEVEL CLEAR / fail / YOU WIN.
function drawOverlay() {
  if (state === "play") return;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  if (state === "clear") {
    centerText("LEVEL CLEAR!  +500", 200, 54, "#7dff7d"); centerText("Get ready...", 280, 24, "#ffffff");
    centerText("SCORE " + Math.floor(score), 320, 22, "#ffd23f");
  } else if (state === "fail") {
    centerText(failReason, 170, 54, "#ff3b3b"); centerText("SCORE " + Math.floor(score), 240, 24, "#ffd23f");
    centerText("Press R to retry  (N skips)", 290, 24, "#ffffff");
  } else if (state === "win") {
    centerText("You Win!", 70, 64, "#ffd23f");
    centerText("FINAL SCORE " + Math.floor(score), 150, 30, "#ffd23f");
    centerText(lastRank > 0 ? "NEW BEST! Rank #" + lastRank + "!" : "Nice run! (No board spot)", 190, 22,
      lastRank > 0 ? "#7dff7d" : "#c9a98f");
    for (let i = 0; i < boardTop.length; i++) { // the top-5 leaderboard!
      centerText("#" + (i + 1) + "  " + boardTop[i].score + "  " + (boardTop[i].paint || boardTop[i].car) + (boardTop[i].style ? " " + boardTop[i].style : ""), 225 + i * 26, 20,
        i + 1 === lastRank ? "#ffd23f" : "#ffffff"); // your row glows gold
    }
    centerText(collected + " coins/jewels  -  " + powered + " power-ups!", 395, 20, "#66e0ff");
    centerText("Press R for the car menu", 430, 22, "#ffd9a0");
  }
}

// --- 7. SOUND: bleeps from nothing! Web Audio builds every sound live
// with oscillators, so the game needs zero audio files. Browsers block
// sound until your first keypress, so the engine starts in initAudio()
// (called from the keydown handler). M mutes everything. ---
let actx = null;   // the AudioContext (created on first keypress)
let master = null; // master volume knob every sound plugs into
let muted = false; // M key flips this
let sfxCool = 0;   // shared cooldown so rapid sounds don't machine-gun
let engO = null, engG = null; // engine hum nodes (pitch follows your speed)

// Start (or wake up) the audio engine. Safe to call on every keypress.
function initAudio() {
  if (actx) { if (actx.state === "suspended") actx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; // Safari's old name
  if (!AC) return; // really old browser: game stays silent, still works
  actx = new AC();
  master = actx.createGain();
  master.gain.value = 0.5; // overall volume: 0 = silent ... 1 = loud
  master.connect(actx.destination);
}

// One beep: an oscillator (pitch) into a gain (volume) that fades out
// over `dur` seconds. `slide` bends the pitch up/down (chirps and falls).
function tone(freq, dur, type, vol, slide) {
  if (!actx || muted) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, actx.currentTime + dur);
  g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(actx.currentTime + dur);
}

// Play a named sound. Try changing the numbers to invent your own!
function sfx(name) {
  if (!actx || muted) return;
  if (name === "jump") tone(300, 0.15, "square", 0.15, 620); // rising chirp
  else if (name === "boing") { if (sfxCool <= 0) { sfxCool = 12; tone(180, 0.18, "triangle", 0.25, 520); } }
  else if (name === "thud") { if (sfxCool <= 0) { sfxCool = 12; tone(110, 0.12, "sine", 0.3, 55); } }
  else if (name === "smash") { if (sfxCool <= 0) { sfxCool = 8; tone(220, 0.08, "sawtooth", 0.22, 70); } }
  else if (name === "plank") tone(480, 0.06, "square", 0.12, 190); // bridge crack
  else if (name === "flip") tone(180, 0.45, "sine", 0.25, 880); // gravity sweep up
  else if (name === "coin") { tone(990, 0.07, "square", 0.14); setTimeout(() => tone(1320, 0.12, "square", 0.14), 70); } // cha-ching!
  else if (name === "jewel") { // sparkly 3-note shimmer
    [880, 1174, 1568].forEach((f, i) => setTimeout(() => tone(f, 0.12, "triangle", 0.16), i * 70));
  }
  else if (name === "power") { // power-up fanfare: 4 climbing notes
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.12, "square", 0.16), i * 80));
  }
  else if (name === "shieldoff") tone(700, 0.2, "sawtooth", 0.2, 150); // shield pops like a bubble
  else if (name === "deny") tone(160, 0.15, "square", 0.15, 110); // broke buzz: can't afford it!
  else if (name === "roar") tone(90, 0.5, "sawtooth", 0.3, 50); // the beast growls behind you!
  else if (name === "tick") tone(1200, 0.05, "square", 0.12); // clock tick: hurry!
  else if (name === "crash") tone(170, 0.3, "sawtooth", 0.3, 45); // death buzz
  else if (name === "clang") tone(880, 0.12, "square", 0.2, 180); // spike shriek
  else if (name === "clear") { // happy 3-note jingle
    tone(523, 0.12, "square", 0.18);
    setTimeout(() => tone(659, 0.12, "square", 0.18), 110);
    setTimeout(() => tone(784, 0.2, "square", 0.18), 220);
  }
  else if (name === "win") { // fanfare: 6 climbing notes!
    [440, 523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.2, "square", 0.2), i * 130));
  }
}

// Engine hum: one quiet sawtooth whose pitch follows your speed.
// Created once, then re-pitched every frame; silent outside of play.
function engineUpdate() {
  if (actx && !muted && state === "play") {
    if (!engO) {
      engO = actx.createOscillator(); engG = actx.createGain();
      engO.type = "sawtooth"; engG.gain.value = 0;
      engO.connect(engG); engG.connect(master); engO.start();
    }
    engO.frequency.value = 55 + Math.abs(car.vx) * 13 + (keys["ArrowRight"] ? 18 : 0);
    engG.gain.value = 0.045;
  } else if (engG) engG.gain.value = 0;
}

// Explosion boom: a burst of noise (random static) through a low rumble,
// plus a deep sine thump underneath. Called by fail().
function boom() {
  if (!actx || muted) return;
  const dur = 0.5, buf = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = actx.createBufferSource(); src.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900;
  const g = actx.createGain(); g.gain.value = 0.5;
  src.connect(f); f.connect(g); g.connect(master); src.start();
  tone(90, 0.4, "sine", 0.4, 35); // deep thump under the noise
}

// Paint + upgrade menu: big preview, color swatches, stat bars, shop.
function drawMenu() {
  ctx.textBaseline = "top";
  centerText("DEVIL DRIVE", 30, 60, "#ff5a4e");
  centerText("paint your ride!", 100, 22, "#ffd9a0");
  drawMiniCar(480, 178, PAINTS[paint].color); // your car in your color!
  for (let i = 0; i < PAINTS.length; i++) { // swatch row: Left/Right picks
    const x = 340 + i * 40, y = 232;
    ctx.fillStyle = PAINTS[i].color;
    ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
    if (i === paint) { ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 4; ctx.stroke(); }
  }
  const s = carSpec(true); // bars show your BOOSTED potential (press X in-game!)
  statBar(405, 258, "SPD", s.speed);
  statBar(405, 276, "PWR", s.power);
  statBar(405, 294, "JMP", s.jump);
  const st = STYLES[style]; // body browser: Up/Down picks, 8 buys!
  const stTxt = "< " + st.name + " >" + (ownedStyles[style] ? " OWNED!" : " (" + st.price + "c: press 8!)");
  centerText(stTxt, 312, 14, ownedStyles[style] ? "#7dff7d" : (coinBank >= st.price ? "#ffffff" : "#8a6f5f"));
  centerText("COINS: " + coinBank, 330, 18, "#ffd23f");
  shopLine(4, "EXTRA JUMP", "jump", 350);
  shopLine(5, "SPEED", "speed", 367);
  shopLine(6, "POWER", "power", 384);
  shopLine(7, "HIGH JUMP", "high", 401);
  if (boardTop.length > 0) centerText("BEST: " + boardTop[0].score + " " + (boardTop[0].paint || boardTop[0].car) + (boardTop[0].style ? " " + boardTop[0].style : ""), 420, 16, "#ffd23f");
  centerText("left/right: paint - up/down: body - 4-8: shop - ENTER: drive!", 444, 16, "#ffffff");
  centerText("X: 5s boost - 0: menu - BACKSPACE: reset save", 466, 14, "#c9a98f");
  centerText("bodies are looks only: free speed is a lie!", 486, 14, "#c9a98f");
  if (confirmReset) drawResetPopup(); // the "are you sure?" popup, on top!
}

// The "ARE YOU SURE?" popup: dims the menu, Y wipes, N cancels.
function drawResetPopup() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "#2a1a2e"; ctx.fillRect(230, 170, 500, 200); // the box
  ctx.strokeStyle = "#ff5a4e"; ctx.lineWidth = 4; ctx.strokeRect(230, 170, 500, 200);
  centerText("RESET EVERYTHING?", 195, 34, "#ff5a4e");
  centerText("coins, board scores, upgrades,", 245, 20, "#ffffff");
  centerText("paint + bodies: ALL wiped!", 272, 20, "#ffffff");
  centerText("Y: wipe it all! - N: keep playing", 315, 20, "#ffd23f");
}

// One shop row: "4: EXTRA JUMP Lv1->2 (4c)". Green = MAXED, dim = broke.
function shopLine(key, label, which, y) {
  const lv = owned[which];
  const txt = lv >= SHOP_MAX_LEVEL ? " - MAX!" : " Lv" + lv + "->" + (lv + 1) + " (" + shopPrice(which) + "c)";
  const color = lv >= SHOP_MAX_LEVEL ? "#7dff7d" : (coinBank >= shopPrice(which) ? "#ffffff" : "#8a6f5f");
  centerText(key + ": " + label + txt, y, 15, color);
}

// A tiny car preview: your body style, in a paint color.
function drawMiniCar(x, y, color) {
  ctx.save(); ctx.translate(x, y);
  drawBodyArt(style, color, "#ffd23f"); // same art as the real car!
  ctx.fillStyle = "#222222";
  for (const wx of [-24, 24]) { ctx.beginPath(); ctx.arc(wx, 14, 13, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// One stat bar (label + red bar). Scale 1.5 wraps the best cars.
function statBar(x, y, label, val) {
  ctx.font = "bold 13px system-ui, sans-serif"; ctx.textAlign = "left";
  ctx.fillStyle = "#c9a98f"; ctx.fillText(label, x, y);
  ctx.fillStyle = "#551111"; ctx.fillRect(x + 36, y, 114, 12);
  ctx.fillStyle = "#ff5a4e"; ctx.fillRect(x + 36, y, 114 * val / 1.5, 12);
}

// --- 8. GAME LOOP: update moves, draw paints, rAF calls loop again. ---
function loop() { update(); draw(); requestAnimationFrame(loop); }

for (let i = 0; i < 90; i++) stars.push({ x: Math.random() * CANVAS_WIDTH, y: Math.random() * 330 }); // stars, made once
loadShop(); // wallet + upgrades from last time (if any)
state = "menu"; // menu first; ENTER starts level 1!
requestAnimationFrame(loop);
