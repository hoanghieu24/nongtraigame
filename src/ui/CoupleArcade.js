// ============================================================================
// CoupleArcade.js — Khu Vui Chơi & Trò Chơi Đôi Cho Hiếu 💙 & Huyền 💖
// Bao gồm 5 chế độ giải trí siêu cuốn:
//   1. 💕 Góc Tình Yêu Hiếu ❤️ Huyền (Bắn tim, Tặng quà, Đố vui cặp đôi, Vòng quay thử thách)
//   2. 🔨 Đập Chuột Chũi Cứu Vườn Dâu (Phản xạ nhanh 25s + Đua điểm Hiếu vs Huyền)
//   3. 🍓 Hứng Dâu Tây & Tim Hồng (Di chuyển giỏ hứng quà rơi 25s)
//   4. 🃏 Lật Thẻ Tâm Đầu Ý Hợp (Siêu trí nhớ 16 ô cặp đôi)
//   5. 🐾 Đua Thú Cưng Nông Trại (Cổ vũ Mèo Mimi, Cún Bông, Vịt Vàng, Thỏ Trắng)
// ============================================================================
import { esc } from '../core/util.js';
import { ARCADE_DAILY_LIMITS } from '../economy/Economy.js';

const LOVE_RANKS = [
  { lvl: 1, need: 0, title: '🌱 Mới Quen Ngại Ngùng' },
  { lvl: 2, need: 60, title: '🌸 Chớm Nở Tương Tư' },
  { lvl: 3, need: 160, title: '💑 Cặp Đôi Nông Trại' },
  { lvl: 4, need: 320, title: '🔥 Tâm Đầu Ý Hợp' },
  { lvl: 5, need: 550, title: '💍 Định Mệnh Hiếu & Huyền' },
];

const COUPLE_QUIZZES = [
  {
    q: 'Khi Huyền tự nhiên im lặng hoặc bảo "Không sao đâu", Hiếu nên làm gì chuẩn nhất?',
    opts: [
      'Mua ngay Trà Sữa + đồ ăn ngon rồi dỗ dành ngọt ngào 🧋💖',
      'Tưởng không sao thật rồi đi câu cá tiếp 🎣',
      'Hỏi lý lẽ đúng sai tới cùng 🧐',
    ],
    ans: 0,
    reward: 150,
  },
  {
    q: 'Món ăn nào trong Quán Ăn Làng hợp nhất cho buổi hẹn hò của Hiếu & Huyền?',
    opts: [
      'Pizza Đút Lò nóng hổi + 2 ly Trà Sữa Trân Châu 🍕🧋',
      'Chỉ uống nước lọc qua ngày 💧',
      'Bánh cháy đen trong lò 🔥',
    ],
    ans: 0,
    reward: 150,
  },
  {
    q: 'Trong nông trại Hiếu & Huyền, khi 2 người cùng tưới nước và thu hoạch 1 ô cây thì được gì?',
    opts: [
      'Được thưởng Teamwork +1 nông sản miễn phí 🤝✨',
      'Cây bị ngập úng 🌧️',
      'Không có gì thay đổi',
    ],
    ans: 0,
    reward: 140,
  },
  {
    q: 'Ai là người đáng yêu nhất trong Nông Trại Hạnh Phúc hôm nay?',
    opts: [
      'Cả Hiếu 💙 và Huyền 💖 đều số 1!',
      'Mấy con Zombie ban đêm 🧟',
      'Tên trộm nông sản 🦹',
    ],
    ans: 0,
    reward: 160,
  },
  {
    q: 'Khi Lò Nướng Pizza ở Quán Ăn bốc cháy đỏ rực, Hiếu & Huyền cần làm gì?',
    opts: [
      'Chụp ngay Bình Chữa Cháy 🧯 đứng giữ 3 giây rồi vứt đồ cháy vào Thùng Rác!',
      'Đứng nhìn lửa cháy cho ấm 🔥',
      'Bưng luôn bánh cháy ra cho khách ăn 😅',
    ],
    ans: 0,
    reward: 150,
  },
];

const COUPLE_DARES = [
  { text: '💌 Nhắn ngay 1 câu khen đối phương siêu ngọt vào khung Chat!', bonus: 120, love: 25 },
  { text: '📸 Hai người chạy lại đứng sát cạnh nhau ngoài vườn và cùng bấm biểu tượng Thả Tim ❤️!', bonus: 140, love: 30 },
  { text: '🍕 Cùng nhau vào Quán Ăn 2.5D phục vụ đủ 3 khách liên tiếp đạt Fever ×2!', bonus: 180, love: 35 },
  { text: '🎁 Quà Bất Ngờ: Thưởng nóng +160 🪙 vào ví và +30 💕 Điểm Tình Yêu cho Hiếu & Huyền!', bonus: 160, love: 30 },
  { text: '🔨 Thi xem ai đạt trên 180 điểm ở trò Đập Chuột Chũi ngay bây giờ!', bonus: 130, love: 25 },
  { text: '🌹 Hãy nói hoặc nhắn 1 điều bạn thích nhất ở người kia ngay lúc này!', bonus: 150, love: 35 },
];

export class CoupleArcade {
  constructor(ui) {
    this.ui = ui;
    this.tab = 'love'; // 'love' | 'mole' | 'catch' | 'memory' | 'race'
    this.quizIdx = 0;
    this.dareText = '';
    this.bestMole = 0;
    this.bestCatch = 0;

    // Trạng thái Đập Chuột Chũi
    this.mole = {
      active: false,
      timeLeft: 25,
      score: 0,
      combo: 0,
      holes: new Array(9).fill(null), // { kind: 'mole'|'gold'|'heart'|'bomb', ttl }
      spawnT: 0,
    };

    // Trạng thái Hứng Quả Ngọt
    this.catcher = {
      active: false,
      timeLeft: 25,
      score: 0,
      combo: 0,
      basketCol: 2, // 0..4
      items: [], // { col: 0..4, row: 0..5, kind: 'straw'|'peach'|'heart'|'star'|'bomb' }
      stepT: 0,
    };

    // Trạng thái Lật Thẻ Trí Nhớ
    this.memory = {
      cards: [],
      flipped: [],
      matched: 0,
      moves: 0,
      locked: false,
      won: false,
    };
    this.initMemory();

    // Trạng thái Đua Thú Cưng
    this.race = {
      active: false,
      picked: 0,
      winner: -1,
      pets: [
        { id: 0, name: 'Mèo Mimi', icon: '🐱', pos: 0 },
        { id: 1, name: 'Cún Bông', icon: '🐶', pos: 0 },
        { id: 2, name: 'Vịt Vàng', icon: '🐥', pos: 0 },
        { id: 3, name: 'Thỏ Hồng', icon: '🐰', pos: 0 },
      ],
    };
  }

  get g() {
    return this.ui.g;
  }

  getLoveInfo(st) {
    const xp = st?.economy?.loveXp || 0;
    let cur = LOVE_RANKS[0];
    let next = LOVE_RANKS[1];
    for (let i = 0; i < LOVE_RANKS.length; i++) {
      if (xp >= LOVE_RANKS[i].need) {
        cur = LOVE_RANKS[i];
        next = LOVE_RANKS[i + 1] || null;
      }
    }
    const pct = next ? Math.min(100, Math.round(((xp - cur.need) / Math.max(1, next.need - cur.need)) * 100)) : 100;
    return { xp, cur, next, pct };
  }

  // ---------------- CẬP NHẬT THEO THỜI GIAN THỰC ----------------
  update(dt) {
    if (this.ui.panel !== 'arcade') return;
    let needRefresh = false;

    // 1. Update Whack-a-Mole
    if (this.mole.active) {
      const m = this.mole;
      m.timeLeft = Math.max(0, m.timeLeft - dt);
      m.spawnT -= dt;
      for (let i = 0; i < 9; i++) {
        if (m.holes[i]) {
          m.holes[i].ttl -= dt;
          if (m.holes[i].ttl <= 0) {
            m.holes[i] = null;
            needRefresh = true;
          }
        }
      }
      if (m.spawnT <= 0) {
        m.spawnT = Math.max(0.32, 0.65 - (25 - m.timeLeft) * 0.012);
        const free = [];
        for (let i = 0; i < 9; i++) if (!m.holes[i]) free.push(i);
        if (free.length) {
          const idx = free[(Math.random() * free.length) | 0];
          const r = Math.random();
          const kind = r < 0.16 ? 'gold' : r < 0.32 ? 'heart' : r < 0.46 ? 'bomb' : 'mole';
          m.holes[idx] = { kind, ttl: kind === 'gold' ? 1.05 : 1.35 };
          needRefresh = true;
        }
      }
      if (m.timeLeft <= 0) {
        m.active = false;
        m.holes.fill(null);
        this.finishMoleGame();
        needRefresh = true;
      } else if (Math.floor((m.timeLeft + dt) * 2) !== Math.floor(m.timeLeft * 2)) {
        needRefresh = true;
      }
    }

    // 2. Update Fruit Catcher
    if (this.catcher.active) {
      const c = this.catcher;
      c.timeLeft = Math.max(0, c.timeLeft - dt);
      c.stepT -= dt;
      if (c.stepT <= 0) {
        c.stepT = Math.max(0.24, 0.42 - (25 - c.timeLeft) * 0.006);
        // Move existing items down
        const nextItems = [];
        for (const it of c.items) {
          it.row += 1;
          if (it.row >= 5) {
            if (it.col === c.basketCol) {
              this.onCatchItem(it.kind);
            } else if (it.kind !== 'bomb') {
              c.combo = 0;
            }
          } else {
            nextItems.push(it);
          }
        }
        c.items = nextItems;
        // Spawn new falling item at row 0
        if (Math.random() < 0.85) {
          const col = (Math.random() * 5) | 0;
          const r = Math.random();
          const kind = r < 0.18 ? 'star' : r < 0.36 ? 'heart' : r < 0.52 ? 'bomb' : r < 0.76 ? 'peach' : 'straw';
          c.items.push({ col, row: 0, kind });
        }
        needRefresh = true;
      }
      if (c.timeLeft <= 0) {
        c.active = false;
        c.items = [];
        this.finishCatcherGame();
        needRefresh = true;
      }
    }

    // 3. Update Pet Race
    if (this.race.active) {
      const rc = this.race;
      rc.stepT = (rc.stepT || 0) - dt;
      if (rc.stepT <= 0) {
        rc.stepT = 0.12;
        for (const pet of rc.pets) {
          const boost = Math.random() < 0.25 ? 6.5 : 2.8 + Math.random() * 3.5;
          pet.pos = Math.min(100, pet.pos + boost);
          if (pet.pos >= 100 && rc.winner === -1) {
            rc.winner = pet.id;
            rc.active = false;
            this.finishPetRace();
            break;
          }
        }
        needRefresh = true;
      }
    }

    if (needRefresh) {
      this.ui.render(true);
    }
  }

  // ---------------- XỬ LÝ SỰ KIỆN CLICK ----------------
  act(a, d) {
    const g = this.g;
    g.audio.sfx('click');

    if (a === 'arcTab') {
      this.tab = d.t || 'love';
      this.ui.render(true);
      return true;
    }

    // 1. Góc Tình Yêu Hiếu & Huyền
    if (a === 'arcLoveGift') {
      const msgs = {
        heart: 'Gửi ngàn trái tim yêu thương tới đằng ấy! 💖✨',
        rose: 'Tặng bó hoa hồng tươi thắm & 120 Xu ăn vặt nè! 🌹💝',
        boba: 'Mời người thương 1 ly Trà Sữa Trân Châu ngọt ngào! 🧋💕',
      };
      const coins = d.k === 'rose' ? 120 : d.k === 'boba' ? 100 : 80;
      const love = d.k === 'rose' ? 30 : 25;
      const msg = msgs[d.k] || msgs.heart;
      this.ui.send({ type: 'economy.sendLoveGift', msg, love, giftCoins: coins });
      g.session.sendChat(`💖 ${msg}`);
      this.ui.render(true);
      return true;
    }

    if (a === 'arcQuizAns') {
      const q = COUPLE_QUIZZES[this.quizIdx % COUPLE_QUIZZES.length];
      const pick = +d.idx;
      if (pick === q.ans) {
        g.audio.sfx('levelup');
        g.confetti?.();
        this.ui.send({
          type: 'economy.arcadeReward',
          coins: q.reward,
          xp: 12,
          love: 25,
          label: 'Tâm Đầu Ý Hợp Hiếu & Huyền',
        });
        this.quizIdx = (this.quizIdx + 1) % COUPLE_QUIZZES.length;
      } else {
        g.audio.sfx('fail');
        this.ui.toast('Chưa đúng ý người thương rồi, chọn lại nhé! 😆', 'warn');
      }
      this.ui.render(true);
      return true;
    }

    if (a === 'arcSpinDare') {
      const item = COUPLE_DARES[(Math.random() * COUPLE_DARES.length) | 0];
      this.dareText = item.text;
      g.audio.sfx('levelup');
      this.ui.send({
        type: 'economy.arcadeReward',
        coins: item.bonus,
        xp: 10,
        love: item.love,
        label: 'Vòng Quay Thử Thách Cặp Đôi',
      });
      g.session.sendChat(`🎡 Thử thách Hiếu & Huyền: ${item.text}`);
      this.ui.render(true);
      return true;
    }

    // 2. Đập Chuột Chũi
    if (a === 'arcMoleStart') {
      this.mole.active = true;
      this.mole.timeLeft = 25;
      this.mole.score = 0;
      this.mole.combo = 0;
      this.mole.holes.fill(null);
      this.mole.spawnT = 0.1;
      g.audio.sfx('bell');
      this.ui.render(true);
      return true;
    }

    if (a === 'arcMoleHit') {
      const idx = +d.idx;
      const h = this.mole.holes[idx];
      if (!this.mole.active || !h) return true;
      this.mole.holes[idx] = null;
      if (h.kind === 'bomb') {
        this.mole.score = Math.max(0, this.mole.score - 20);
        this.mole.combo = 0;
        g.audio.sfx('fail');
      } else {
        this.mole.combo++;
        const base = h.kind === 'gold' ? 35 : h.kind === 'heart' ? 25 : 15;
        const bonus = Math.min(20, (this.mole.combo - 1) * 3);
        this.mole.score += base + bonus;
        g.audio.sfx('pop');
      }
      this.ui.render(true);
      return true;
    }

    // 3. Hứng Quả Ngọt
    if (a === 'arcCatchStart') {
      this.catcher.active = true;
      this.catcher.timeLeft = 25;
      this.catcher.score = 0;
      this.catcher.combo = 0;
      this.catcher.basketCol = 2;
      this.catcher.items = [];
      this.catcher.stepT = 0.15;
      g.audio.sfx('bell');
      this.ui.render(true);
      return true;
    }

    if (a === 'arcCatchMove') {
      const col = +d.col;
      if (col >= 0 && col <= 4) {
        this.catcher.basketCol = col;
        // Check immediate catch if an item is at row 4
        this.catcher.items = this.catcher.items.filter((it) => {
          if (it.row >= 4 && it.col === col) {
            this.onCatchItem(it.kind);
            return false;
          }
          return true;
        });
        this.ui.render(true);
      }
      return true;
    }

    // 4. Lật Thẻ Trí Nhớ
    if (a === 'arcMemReset') {
      this.initMemory();
      g.audio.sfx('pop');
      this.ui.render(true);
      return true;
    }

    if (a === 'arcMemFlip') {
      const idx = +d.idx;
      const m = this.memory;
      if (m.locked || m.won) return true;
      const card = m.cards[idx];
      if (!card || card.open || card.done) return true;
      card.open = true;
      m.flipped.push(idx);
      g.audio.sfx('pop');

      if (m.flipped.length === 2) {
        m.moves++;
        const [i1, i2] = m.flipped;
        const c1 = m.cards[i1], c2 = m.cards[i2];
        if (c1.icon === c2.icon) {
          c1.done = c2.done = true;
          m.flipped = [];
          m.matched++;
          g.audio.sfx('coin');
          if (m.matched >= 8) {
            m.won = true;
            const reward = Math.max(120, 300 - Math.max(0, m.moves - 8) * 10);
            g.confetti?.();
            this.ui.send({
              type: 'economy.arcadeReward',
              coins: reward,
              xp: 18,
              love: 35,
              label: `Siêu Trí Nhớ (${m.moves} lượt)`,
            });
            g.session.sendChat(`🃏 Mình vừa phá đảo Lật Thẻ Tâm Đầu Ý Hợp chỉ với ${m.moves} lượt (+${reward} 🪙)!`);
          }
        } else {
          m.locked = true;
          setTimeout(() => {
            c1.open = c2.open = false;
            m.flipped = [];
            m.locked = false;
            this.ui.render(true);
          }, 520);
        }
      }
      this.ui.render(true);
      return true;
    }

    // 5. Đua Thú Cưng
    if (a === 'arcRacePick') {
      if (this.race.active) return true;
      this.race.picked = +d.idx;
      this.ui.render(true);
      return true;
    }

    if (a === 'arcRaceStart') {
      if (this.race.active) return true;
      this.race.active = true;
      this.race.winner = -1;
      for (const p of this.race.pets) p.pos = 0;
      g.audio.sfx('bell');
      this.ui.render(true);
      return true;
    }

    return false;
  }

  onCatchItem(kind) {
    const c = this.catcher, g = this.g;
    if (kind === 'bomb') {
      c.score = Math.max(0, c.score - 25);
      c.combo = 0;
      g.audio.sfx('fail');
    } else {
      c.combo++;
      const pts = kind === 'star' ? 35 : kind === 'heart' ? 30 : kind === 'peach' ? 20 : 15;
      c.score += pts + Math.min(15, (c.combo - 1) * 3);
      g.audio.sfx('pop');
    }
  }

  finishMoleGame() {
    const s = this.mole.score;
    if (s > this.bestMole) this.bestMole = s;
    const coins = Math.max(40, Math.min(450, Math.round(s * 0.9)));
    this.g.confetti?.();
    this.ui.send({
      type: 'economy.arcadeReward',
      coins,
      xp: 15,
      love: 25,
      label: `Đập Chuột Chũi (${s} điểm)`,
    });
    this.g.session.sendChat(`🔨 Đập Chuột Chũi đạt ${s} điểm! Nhận +${coins} 🪙 (Kỷ lục: ${this.bestMole}đ)`);
  }

  finishCatcherGame() {
    const s = this.catcher.score;
    if (s > this.bestCatch) this.bestCatch = s;
    const coins = Math.max(45, Math.min(450, Math.round(s * 0.95)));
    this.g.confetti?.();
    this.ui.send({
      type: 'economy.arcadeReward',
      coins,
      xp: 15,
      love: 25,
      label: `Hứng Dâu & Tim Hồng (${s} điểm)`,
    });
    this.g.session.sendChat(`🍓 Hứng Quả Ngọt đạt ${s} điểm! Nhận +${coins} 🪙 (Kỷ lục: ${this.bestCatch}đ)`);
  }

  finishPetRace() {
    const rc = this.race;
    const won = rc.winner === rc.picked;
    const winPet = rc.pets[rc.winner];
    const coins = won ? 260 : 95;
    if (won) this.g.confetti?.();
    this.ui.send({
      type: 'economy.arcadeReward',
      coins,
      xp: 14,
      love: 20,
      label: won ? `Đoán trúng ${winPet.name} Về Nhất` : `Cổ vũ Đua Thú Cưng`,
    });
    this.g.session.sendChat(
      `🏁 ${winPet.icon} ${winPet.name} đã về Nhất! ${won ? 'Đoán trúng thưởng lớn +260 🪙!' : 'Thưởng cổ vũ +95 🪙!'}`
    );
  }

  initMemory() {
    const icons = ['👦💙', '👧💖', '🍓', '🍕', '🧋', '🐱', '💍', '🌹'];
    const deck = [...icons, ...icons].map((icon, i) => ({ id: i, icon, open: false, done: false }));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    this.memory = { cards: deck, flipped: [], matched: 0, moves: 0, locked: false, won: false };
  }

  // ---------------- RENDER GIAO DIỆN ----------------
  render(st, me) {
    const lv = this.getLoveInfo(st);
    const arcadeLeft = Math.max(0, ARCADE_DAILY_LIMITS.coins - (st.daily?.arcadeRewards?.[me?.id]?.coins || 0));
    const giftsLeft = Math.max(0, ARCADE_DAILY_LIMITS.gifts - (st.daily?.loveGifts || 0));
    const tabs = [
      ['love', '💕 Hiếu ❤️ Huyền'],
      ['mole', '🔨 Đập Chuột'],
      ['catch', '🍓 Hứng Dâu'],
      ['memory', '🃏 Lật Thẻ Đôi'],
      ['race', '🐾 Đua Thú'],
    ];

    let h = `
      <div class="arcLoveHeader">
        <div class="arcCoupleAv"><span>👦💙</span><b>Hiếu</b><i>❤️</i><b>Huyền</b><span>👧💖</span></div>
        <div class="arcLoveMeta">
          <div class="row between"><b>${lv.cur.title} (Cấp ${lv.cur.lvl})</b><small>💕 ${lv.xp}${lv.next ? ` / ${lv.next.need}` : ' MAX'} Điểm Tình Yêu</small></div>
          <i class="bar xp"><u style="width:${lv.pct}%;background:linear-gradient(90deg,#ec4899,#f43f5e,#fbbf24)"></u></i>
        </div>
      </div>
      <p class="muted">🎁 Hôm nay còn ${arcadeLeft}/${ARCADE_DAILY_LIMITS.coins} xu thưởng trò chơi cho bạn • ${giftsLeft}/${ARCADE_DAILY_LIMITS.gifts} quà xu cho cả nhà. Làm mới lúc 00:00 Việt Nam.</p>
      <div class="tabs">${tabs.map(([k, n]) => `<button class="b ${this.tab === k ? 'on' : ''}" data-a="arcTab" data-t="${k}">${n}</button>`).join('')}</div>
    `;

    if (this.tab === 'love') {
      const q = COUPLE_QUIZZES[this.quizIdx % COUPLE_QUIZZES.length];
      h += `
        <div class="mc">
          <h5>💌 Tương Tác Ngọt Ngào Giữa Hiếu & Huyền <small>${giftsLeft ? `Còn ${giftsLeft} quà xu chung hôm nay` : 'Tiếp tục gửi yêu thương 💕'}</small></h5>
          <div class="row wrap">
            <button class="b go" data-a="arcLoveGift" data-k="heart">💖 Bắn Mưa Tim${giftsLeft ? ' (+80🪙)' : ''}</button>
            <button class="b" data-a="arcLoveGift" data-k="rose">🌹 Tặng Hoa Hồng${giftsLeft ? ' (+120🪙)' : ''}</button>
            <button class="b" data-a="arcLoveGift" data-k="boba">🧋 Mời Trà Sữa${giftsLeft ? ' (+100🪙)' : ''}</button>
          </div>
        </div>
        <div class="mc">
          <h5>🎡 Vòng Quay Thử Thách Đáng Yêu</h5>
          <p class="arcDareBox">${this.dareText ? `✨ <b>${esc(this.dareText)}</b>` : 'Bấm quay để nhận 1 thử thách dễ thương hoặc quà bất ngờ cho Hiếu & Huyền!'}</p>
          <button class="b go" data-a="arcSpinDare">🎡 Quay Thử Thách Ngay (+Xu & 💕)</button>
        </div>
        <div class="mc">
          <h5>🧠 Đố Vui Tâm Đầu Ý Hợp (Thưởng +${q.reward} 🪙 & +25 💕)</h5>
          <p style="margin:6px 0 10px;font-weight:700;color:#ffe4e6">❓ ${esc(q.q)}</p>
          <div class="arcQuizOpts">
            ${q.opts.map((opt, idx) => `<button class="b ghost arcOptBtn" data-a="arcQuizAns" data-idx="${idx}">${idx + 1}. ${esc(opt)}</button>`).join('')}
          </div>
        </div>
      `;
      return h;
    }

    if (this.tab === 'mole') {
      const m = this.mole;
      const iconMap = { mole: '🐹', gold: '👑', heart: '💖', bomb: '💣' };
      const labelMap = { mole: '+15đ', gold: '+35đ', heart: '+25đ', bomb: 'Né!' };
      h += `
        <div class="mc">
          <div class="row between">
            <div><b>🔨 Đập Chuột Chũi Cứu Vườn Dâu</b><small style="display:block">Chạm thật nhanh vào Chuột 🐹, Vua Chuột 👑, Tim 💖 và né Bom 💣!</small></div>
            <button class="b ${m.active ? 'on' : 'go'}" data-a="arcMoleStart">${m.active ? `⏱️ Còn ${Math.ceil(m.timeLeft)}s` : '▶️ Bắt Đầu Chơi (25s)'}</button>
          </div>
          <div class="arcStatsBar">
            <span>🏆 Điểm: <b>${m.score}</b></span>
            <span>🔥 Combo: <b>×${m.combo}</b></span>
            <span>👑 Kỷ lục: <b>${this.bestMole}</b></span>
          </div>
          <div class="arcMoleGrid">
            ${m.holes.map((hItem, i) => `
              <button class="arcMoleHole ${hItem ? 'up ' + hItem.kind : ''}" data-a="arcMoleHit" data-idx="${i}">
                <span class="arcMoleEmoji">${hItem ? iconMap[hItem.kind] : '🕳️'}</span>
                ${hItem ? `<small>${labelMap[hItem.kind]}</small>` : '<small>Ô đất</small>'}
              </button>
            `).join('')}
          </div>
        </div>
      `;
      return h;
    }

    if (this.tab === 'catch') {
      const c = this.catcher;
      const icMap = { straw: '🍓', peach: '🍑', heart: '💖', star: '🌟', bomb: '💣' };
      let gridHtml = '';
      for (let r = 0; r < 5; r++) {
        for (let col = 0; col < 5; col++) {
          const found = c.items.find((it) => it.row === r && it.col === col);
          gridHtml += `<div class="arcCatchCell" data-a="arcCatchMove" data-col="${col}">${found ? `<span>${icMap[found.kind]}</span>` : ''}</div>`;
        }
      }
      h += `
        <div class="mc">
          <div class="row between">
            <div><b>🍓 Hứng Dâu Tây & Mưa Tim Hồng</b><small style="display:block">Chạm vào cột bất kỳ bên dưới để hứng 🍓🍑💖🌟 và né Bom 💣!</small></div>
            <button class="b ${c.active ? 'on' : 'go'}" data-a="arcCatchStart">${c.active ? `⏱️ Còn ${Math.ceil(c.timeLeft)}s` : '▶️ Bắt Đầu Hứng (25s)'}</button>
          </div>
          <div class="arcStatsBar">
            <span>🍓 Điểm: <b>${c.score}</b></span>
            <span>🔥 Combo: <b>×${c.combo}</b></span>
            <span>👑 Kỷ lục: <b>${this.bestCatch}</b></span>
          </div>
          <div class="arcCatchBoard">${gridHtml}</div>
          <div class="arcBasketRow">
            ${[0, 1, 2, 3, 4].map((col) => `
              <button class="b ${c.basketCol === col ? 'go' : 'ghost'} arcBasketBtn" data-a="arcCatchMove" data-col="${col}">
                ${c.basketCol === col ? '🧺 Giỏ' : '⬅️➡️'}
              </button>
            `).join('')}
          </div>
        </div>
      `;
      return h;
    }

    if (this.tab === 'memory') {
      const m = this.memory;
      h += `
        <div class="mc">
          <div class="row between">
            <div><b>🃏 Lật Thẻ Tâm Đầu Ý Hợp (Hiếu & Huyền)</b><small style="display:block">Tìm đủ 8 cặp hình giống nhau với ít lượt lật nhất để nhận tới +300 🪙!</small></div>
            <button class="b sm" data-a="arcMemReset">🔄 Chơi Ván Mới</button>
          </div>
          <div class="arcStatsBar">
            <span>✨ Đã ghép: <b>${m.matched}/8 cặp</b></span>
            <span>👆 Số lượt lật: <b>${m.moves}</b></span>
            <span>${m.won ? '🎉 ĐÃ CHIẾN THẮNG!' : '💡 Hãy nhớ vị trí các ô nhé!'}</span>
          </div>
          <div class="arcMemGrid">
            ${m.cards.map((c, idx) => `
              <button class="arcMemCard ${c.open || c.done ? 'open' : ''} ${c.done ? 'done' : ''}" data-a="arcMemFlip" data-idx="${idx}">
                <span>${c.open || c.done ? c.icon : '💖'}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
      return h;
    }

    if (this.tab === 'race') {
      const rc = this.race;
      h += `
        <div class="mc">
          <div class="row between">
            <div><b>🐾 Đua Thú Cưng Nông Trại (Thưởng ×3)</b><small style="display:block">Chọn bé thú cưng bạn yêu thích rồi bấm Bắt Đầu Đua! Về Nhất thưởng +260 🪙!</small></div>
            <button class="b ${rc.active ? 'on' : 'go'}" data-a="arcRaceStart">${rc.active ? '🏁 Đang chạy đua...' : '🏁 Bắt Đầu Đua!'}</button>
          </div>
          <div class="row wrap" style="margin:8px 0">
            ${rc.pets.map((p, i) => `
              <button class="b ${rc.picked === i ? 'on' : 'ghost'}" data-a="arcRacePick" data-idx="${i}">
                ${p.icon} Cổ vũ ${p.name} ${rc.picked === i ? '✔' : ''}
              </button>
            `).join('')}
          </div>
          <div class="arcRaceTrack">
            ${rc.pets.map((p, i) => `
              <div class="arcRaceLane ${rc.winner === i ? 'win' : ''}">
                <span class="arcLaneLabel">${p.icon} ${p.name}</span>
                <div class="arcLaneBar">
                  <div class="arcLaneRunner" style="left:${Math.min(92, p.pos)}%">${p.icon}${rc.active ? '💨' : ''}</div>
                </div>
                <b class="arcLaneFlag">${rc.winner === i ? '🏆 Nhất!' : '🏁'}</b>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      return h;
    }

    return h;
  }
}

